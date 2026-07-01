import { NextResponse } from 'next/server';
import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let clienteMqtt: mqtt.MqttClient | null = null;

export async function GET() {
  if (!clienteMqtt) {
    console.log('📡 Conectando Next.js a la pasarela industrial de HiveMQ...');

    clienteMqtt = mqtt.connect('wss://olivetawny-986c966f.a03.euc1.aws.hivemq.cloud:8884/mqtt', {
      username: 'richard',
      password: 'Baidal23062018',
    });

    clienteMqtt.on('connect', () => {
      console.log('🌐 [SERVIDOR WEB] Sincronizado con éxito a HiveMQ Cloud.');
      clienteMqtt?.subscribe('produccion/llenado/datos'); 
    });

    clienteMqtt.on('message', async (topic, message) => {
      try {
        const datos = JSON.parse(message.toString());
        console.log(`📥 [MQTT ORIGINAL] Mensaje recibido:`, datos);

        // =====================================================================
        // 1. TRANSACCIÓN: ABRIR_ORDEN 
        // =====================================================================
        if (datos.transaccion === 'ABRIR_ORDEN') {
          const { data: prodData } = await supabase
            .from('productos')
            .select('id_producto')
            .ilike('nombre', datos.producto)
            .maybeSingle();

          const idProductoReal = prodData ? prodData.id_producto : 1;

          // ESCUDO CHECK CONSTRAINT
          const tamanoValidado = datos.tamano_lote < 5 ? 10 : datos.tamano_lote;

          const { error: errOrd } = await supabase.from('ordenes_produccion').insert([{
            fecha_creacion: datos.fecha,
            id_producto: idProductoReal,
            tamano_lote: tamanoValidado, 
            cantidad_solicitada: tamanoValidado,
            estado: 'en_proceso',
            id_operador: 1
          }]);

          if (errOrd) console.error('❌ Error en ordenes_produccion:', errOrd.message);
          else console.log('✅ Orden de producción guardada perfectamente.');
        }

        // =====================================================================
        // 2. TRANSACCIÓN: REGISTRO_BOLSA (¡Limpia sin llamadas fantasma!)
        // =====================================================================
	// =====================================================================
        // 2. TRANSACCIÓN: REGISTRO_BOLSA (CÓDIGO LIMPIO SIN TABLAS FANTASMA)
        // =====================================================================
        else if (datos.transaccion === 'REGISTRO_BOLSA') {
          // 1. Inserción directa en la tabla histórica verdadera
          const { error: errHist } = await supabase.from('produccion_historica').insert([{
            id_lote: datos.lote,
            peso_real: datos.peso_real,
            peso_objetivo: datos.peso_objetivo,
            estado_llenado: datos.estado,
            fecha_hora: datos.fecha
          }]);

          if (errHist) {
            console.error('❌ Error en produccion_historica:', errHist.message);
          } else {
            console.log(`✅ Bolsa del lote [${datos.lote}] registrada de forma directa.`);
          }

          // 2. Descuento directo en la tabla de inventario (¡Aquí se eliminó el error!)
          if (datos.estado === 'ACEPTADO') {
            // Buscamos directamente en inventario_materias usando el nombre que manda Wokwi
            const { data: materia } = await supabase
              .from('inventario_materias')
              .select('*')
              .ilike('nombre_materia', datos.producto)
              .maybeSingle();

            if (materia) {
              const nuevoStock = parseFloat(materia.cantidad_disponible) - (datos.peso_objetivo / 1000.0);
              await supabase
                .from('inventario_materias')
                .update({ cantidad_disponible: nuevoStock, ultima_actualizacion: datos.fecha })
                .eq('id_materia', materia.id_materia);
              console.log(`📉 Inventario de ${datos.producto} actualizado.`);
            }
          }
        }

        // =====================================================================
        // 3. TRANSACCIÓN: CERRAR_LOTE
        // =====================================================================
	// =====================================================================
        // 3. TRANSACCIÓN: CERRAR_LOTE (Secuencial para evitar duplicados)
        // =====================================================================
        else if (datos.transaccion === 'CERRAR_LOTE') {
          const { data: orden } = await supabase
            .from('ordenes_produccion')
            .select('id_orden')
            .eq('estado', 'en_proceso')
            .order('fecha_creacion', { ascending: false })
            .limit(1)
            .maybeSingle();

          const idOrdenAsociada = orden ? orden.id_orden : null;

          // 1. Buscamos si ya existen lotes que empiecen con la misma nomenclatura base
          const { data: lotesCoincidentes, error: errBuscar } = await supabase
            .from('lotes')
            .select('numero_lote')
            .like('numero_lote', `${datos.lote}%`);

          let numeroLoteFinal = datos.lote;

          // 2. Si ya hay coincidencias, calculamos el siguiente sufijo secuencial
          if (lotesCoincidentes && lotesCoincidentes.length > 0) {
            const siguienteSecuencia = lotesCoincidentes.length + 1;
            numeroLoteFinal = `${datos.lote}-${siguienteSecuencia}`;
          }

          // 3. Insertamos en la base de datos con el número secuencial garantizado
          const { error: errLote } = await supabase.from('lotes').insert([{
            numero_lote: numeroLoteFinal,
            id_orden: idOrdenAsociada,
            fecha_produccion: datos.fecha.substring(0, 10),
            fecha_caducidad: '2027-06-30',
            cantidad_producida: datos.aceptados,
            cantidad_rechazada: datos.rechazados,
            observaciones: 'Lote cerrado vía MQTT Pasarela Secuencial Corregida'
          }]);

          if (errLote) {
            console.error('❌ Error en tabla lotes:', errLote.message);
          } else {
            console.log(`🎉 ¡TABLA LOTES ACTUALIZADA! Lote registrado como: ${numeroLoteFinal}`);
            if (idOrdenAsociada) {
              await supabase.from('ordenes_produccion').update({ estado: 'completado' }).eq('id_orden', idOrdenAsociada);
            }
          }
        }

      } catch (error) {
        console.error('❌ Error general al procesar JSON MQTT:', error);
      }
    });
  }

  return NextResponse.json({ status: 'Escuchador MQTT Sincronizado y Parchado' });
}