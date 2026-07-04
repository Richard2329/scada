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
        console.log(`📥 [MQTT ORIGINAL] Mensaje recibido en [${topic}]:`, datos);

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
        // 2. TRANSACCIÓN: REGISTRO_BOLSA
        // =====================================================================
        else if (datos.transaccion === 'REGISTRO_BOLSA') {
          // Inserción directa en la tabla de historial real
          const { error: errHist } = await supabase.from('produccion_historica').insert([{
            id_lote: String(datos.lote), // Forzamos a String para que coincida con el VARCHAR de la tabla
            peso_real: datos.peso_real,
            peso_objetivo: datos.peso_objetivo,
            estado_llenado: datos.estado,
            fecha_hora: datos.fecha
          }]);

          if (errHist) {
            console.error('❌ Error en produccion_historica:', errHist.message);
          } else {
            console.log(`✅ Bolsa del lote [${datos.lote}] registrada con éxito.`);
          }

          // Lógica de descuento de stock corregida con la columna "nombre" real
          if (datos.estado === 'ACEPTADO') {
            const { data: materia } = await supabase
              .from('inventario_materias')
              .select('*')
              .ilike('nombre', datos.producto) // CORRECCIÓN: 'nombre' en lugar de 'nombre_materia'
              .maybeSingle();

            if (materia) {
              const stockActual = parseFloat(materia.cantidad_disponible);
              const pesoEnKilos = datos.peso_objetivo / 1000.0;
              const nuevoStock = stockActual - pesoEnKilos;

              const { error: errInv } = await supabase
                .from('inventario_materias')
                .update({ cantidad_disponible: nuevoStock, ultima_actualizacion: datos.fecha })
                .eq('id_materia', materia.id_materia);

              if (errInv) console.error('❌ Error actualizando inventario:', errInv.message);
              else console.log(`📉 Inventario de ${datos.producto} actualizado. Anterior: ${stockActual} -> Nuevo: ${nuevoStock}`);
            } else {
              console.log(`⚠️ No se encontró la materia prima "${datos.producto}" en la base de datos.`);
            }
          }
        }

        // =====================================================================
        // 3. TRANSACCIÓN: CERRAR_LOTE
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

          const { data: lotesCoincidentes } = await supabase
            .from('lotes')
            .select('numero_lote')
            .like('numero_lote', `${datos.lote}%`);

          let numeroLoteFinal = datos.lote;

          if (lotesCoincidentes && lotesCoincidentes.length > 0) {
            const siguienteSecuencia = lotesCoincidentes.length + 1;
            numeroLoteFinal = `${datos.lote}-${siguienteSecuencia}`;
          }

          // Calculamos dinámicamente un formato de fecha limpio YYYY-MM-DD
          const fechaProduccionLimpia = datos.fecha ? datos.fecha.substring(0, 10) : new Date().toISOString().substring(0, 10);

          const { error: errLote } = await supabase.from('lotes').insert([{
            numero_lote: numeroLoteFinal,
            id_orden: idOrdenAsociada,
            fecha_produccion: fechaProduccionLimpia,
            fecha_caducidad: '2027-06-30',
            cantidad_producida: parseInt(datos.aceptados) || 0,
            cantidad_rechazada: parseInt(datos.rechazados) || 0,
            observaciones: 'Lote cerrado vía MQTT Pasarela Secuencial Corregida v2'
          }]);

          if (errLote) {
            console.error('❌ Error en tabla lotes:', errLote.message);
          } else {
            console.log(`🎉 ¡TABLA LOTES ACTUALIZADA! Lote registrado como: ${numeroLoteFinal}`);
            if (idOrdenAsociada) {
              await supabase
                .from('ordenes_produccion')
                .update({ estado: 'completado' })
                .eq('id_orden', idOrdenAsociada);
              console.log(`💼 Orden #${idOrdenAsociada} marcada como COMPLETADA.`);
            }
          }
        }

      } catch (error) {
        console.error('❌ Error crítico general al procesar JSON MQTT:', error);
      }
    });
  }

  return NextResponse.json({ status: 'Escuchador MQTT Sincronizado y Parchado' });
}
