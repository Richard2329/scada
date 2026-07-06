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

    // Conexión WebSocket Segura obligatoria para el entorno web de HiveMQ Cloud
    clienteMqtt = mqtt.connect('wss://olivetawny-986c966f.a03.euc1.aws.hivemq.cloud:8884/mqtt', {
      username: 'richard',
      password: 'Baidal23062018',
    });

    clienteMqtt.on('connect', () => {
      console.log('🌐 [SERVIDOR WEB] Sincronizado con éxito a HiveMQ Cloud.');
      // Suscripción al tópico idéntico que envía el ESP32 en Wokwi
      clienteMqtt?.subscribe('produccion/llenado/datos'); 
    });

    clienteMqtt.on('message', async (topic, message) => {
      try {
        const datos = JSON.parse(message.toString());
        console.log(`📥 [MQTT ORIGINAL] Mensaje recibido en [${topic}]:`, datos);

        // =====================================================================
        // 1. TRANSACCIÓN: ABRIR_ORDEN (Parchado para Check Constraint)
        // =====================================================================
        if (datos.transaccion === 'ABRIR_ORDEN') {
          const { data: prodData } = await supabase
            .from('productos')
            .select('id_producto')
            .ilike('nombre', datos.producto)
            .maybeSingle();

          const idProductoReal = prodData ? prodData.id_producto : 1;

          // PARCHE: Estabilizar el tamaño del lote para cumplir con el check constraint de la base de datos
          let tamanoValidado = parseInt(datos.tamano_lote);
          
          if (isNaN(tamanoValidado) || tamanoValidado <= 0) {
            tamanoValidado = 10; 
          } else {
            // Redondea al múltiplo de 10 más cercano (ej: un tamaño de 18 pasa a 20)
            tamanoValidado = Math.round(tamanoValidado / 10) * 10;
            if (tamanoValidado === 0) tamanoValidado = 10;
          }

          const { error: errOrd } = await supabase.from('ordenes_produccion').insert([{
            fecha_creacion: datos.fecha,
            id_producto: idProductoReal,
            tamano_lote: tamanoValidado, 
            cantidad_solicitada: tamanoValidado,
            estado: 'en_proceso',
            id_operador: 1
          }]);

          if (errOrd) {
            console.error('❌ Error crítico en ordenes_produccion:', errOrd.message);
          } else {
            console.log(`✅ Orden de producción guardada perfectamente con lote adaptado a: ${tamanoValidado}`);
          }
        }

        // =====================================================================
        // 2. TRANSACCIÓN: REGISTRO_BOLSA
        // =====================================================================
        else if (datos.transaccion === 'REGISTRO_BOLSA') {
          // Inserción en la tabla de historial real
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

          // Lógica de descuento de stock en inventario_materias
          if (datos.estado === 'ACEPTADO') {
            const { data: materia } = await supabase
              .from('inventario_materias')
              .select('*')
              .ilike('nombre', datos.producto) // CORREGIDO: 'nombre' coincide con tu tabla real en Supabase
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
        else if (datos.transaccion === 'CERRAR_LOTE') {
          const { data: orden } = await supabase
            .from('ordenes_produccion')
            .select('id_orden')
            .eq('estado', 'en_proceso')
            .order('fecha_creacion', { ascending: false })
            .limit(1)
            .maybeSingle();

          const idOrdenAsociada = orden ? orden.id_orden : null;

          // Buscamos si ya existen lotes con la misma nomenclatura base para calcular la secuencia
          const { data: lotesCoincidentes } = await supabase
            .from('lotes')
            .select('numero_lote')
            .like('numero_lote', `${datos.lote}%`);

          let numeroLoteFinal = datos.lote;

          if (lotesCoincidentes && lotesCoincidentes.length > 0) {
            const siguienteSecuencia = lotesCoincidentes.length + 1;
            numeroLoteFinal = `${datos.lote}-${siguienteSecuencia}`;
          }

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
              await supabase
                .from('ordenes_produccion')
                .update({ estado: 'completado' })
                .eq('id_orden', idOrdenAsociada);
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
