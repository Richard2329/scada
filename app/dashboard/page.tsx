'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardPage() {
  // Estados para contadores y datos del SCADA
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [productosActivos, setProductosActivos] = useState(0);
  const [itemsInventario, setItemsInventario] = useState(0);
  const [ordenesProcesadas, setOrdenesProcesadas] = useState(0);

  // Estados para las tablas e interfaz
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [lineaProducto, setLineaProducto] = useState('Mani');
  const [presentacion, setPresentacion] = useState('250ml');
  const [estadoValvula, setEstadoValvula] = useState('CERRADA (ESPERA)');
  
  // Estados de control HMI
  const [enviandoProceso, setEnviandoProceso] = useState(false);
  const [mensajeHMI, setMensajeHMI] = useState<{ texto: string; tipo: 'SUCCESS' | 'ERROR' | 'INFO' | null }>({
    texto: '',
    tipo: null,
  });

  // =====================================================================
  // FUNCIÓN CRÍTICA: LECTURA COMPLETA DE LA BASE DE DATOS
  // =====================================================================
  const consultarBaseDatos = async () => {
    try {
      // 1. Cargar Usuarios
      const { data: dataUsuarios, error: errUser } = await supabase
        .from('usuarios')
        .select('*');
      if (!errUser && dataUsuarios) {
        setUsuarios(dataUsuarios);
        setTotalUsuarios(dataUsuarios.length);
      }

      // 2. Cargar Conteo de Productos Activos
      const { data: dataProds, error: errProds } = await supabase
        .from('productos')
        .select('id_producto');
      if (!errProds && dataProds) {
        setProductosActivos(dataProds.length);
      }

      // 3. Cargar Inventario de Materias Primas (Columna Real: "nombre")
      const { data: dataInv, error: errInv } = await supabase
        .from('inventario_materias')
        .select('id_materia, nombre, cantidad_disponible, unidad_medida');
      if (!errInv && dataInv) {
        setInventario(dataInv);
        // Sumamos los items únicos en inventario
        setItemsInventario(dataInv.length);
      }

      // 4. Cargar Cantidad de Órdenes Completadas o Procesadas
      const { data: dataOrdenes, error: errOrd } = await supabase
        .from('ordenes_produccion')
        .select('id_orden');
      if (!errOrd && dataOrdenes) {
        setOrdenesProcesadas(dataOrdenes.length);
      }

    } catch (err) {
      console.error('❌ Error interno al realizar el barrido de datos:', err);
    }
  };

  // =====================================================================
  // CONTROLADOR: SINCRONIZAR PLANTA / ACTIVAR ESCUCHADOR MQTT
  // =====================================================================
  const despacharNuevoProcesoWokwi = async () => {
    try {
      setEnviandoProceso(true);
      setMensajeHMI({ texto: '📡 Estableciendo enlace telemático con HiveMQ...', tipo: 'INFO' });

      // Despierta la pasarela API local para que Next.js escuche al ESP32
      const respuesta = await fetch('/api/mqtt');
      if (!respuesta.ok) throw new Error(`HTTP Error ${respuesta.status}`);
      
      const resultado = await respuesta.json();
      console.log('📡 Pasarela MQTT Sincronizada:', resultado);

      // Trae los datos más frescos de la base de datos para pintar la pantalla
      await consultarBaseDatos();

      setMensajeHMI({ texto: '⚡ ENLACE TELEINFORMÁTICO ESTABLECIDO CON SUPABASE', tipo: 'SUCCESS' });
    } catch (error: any) {
      console.error('❌ Error al despachar orden:', error);
      setMensajeHMI({ 
        texto: `❌ Error al despachar orden: ${error.message || 'Servidor Inalcanzable'}`, 
        tipo: 'ERROR' 
      });
    } finally {
      setEnviandoProceso(false);
    }
  };

  // Inicialización Automática al cargar la página
  useEffect(() => {
    const inicializarSistema = async () => {
      // Intenta encender el puente MQTT automáticamente en segundo plano
      fetch('/api/mqtt').catch((e) => console.log('Pasarela dormida en arranque:', e));
      // Llena los paneles gráficos con los datos reales
      await consultarBaseDatos();
    };
    
    inicializarSistema();

    // Opcional: Tiempo de refresco automático del SCADA cada 5 segundos
    const intervalo = setInterval(consultarBaseDatos, 5000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="min-h-screen bg-[#080d1a] text-white p-6 font-sans">
      {/* ENCABEZADO SCADA */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-slate-100 flex items-center gap-2">
            📊 PANEL DE CONTROL SCADA
          </h1>
          <p className="text-xs font-bold text-green-400 mt-1 tracking-wide uppercase">
            🌐 ENLACE TELEINFORMÁTICO ESTABLECIDO CON SUPABASE
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Operador Activo: <span className="text-blue-400 font-semibold">Operador Principal</span></p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={despacharNuevoProcesoWokwi}
            disabled={enviandoProceso}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-blue-900/40"
          >
            {enviandoProceso ? '⏳ Sincronizando...' : '🔄 Sincronizar Planta'}
          </button>
          <button className="bg-red-950/40 hover:bg-red-900 text-red-400 border border-red-900/60 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1">
            🔒 Salir
          </button>
        </div>
      </div>

      {/* FEEDBACK HMI */}
      {mensajeHMI.texto && (
        <div className={`mb-6 p-3 rounded-lg text-xs font-bold border transition-all ${
          mensajeHMI.tipo === 'SUCCESS' ? 'bg-green-950/40 border-green-500/50 text-green-400' :
          mensajeHMI.tipo === 'ERROR' ? 'bg-red-950/40 border-red-500/50 text-red-400' :
          'bg-blue-950/40 border-blue-500/50 text-blue-400'
        }`}>
          {mensajeHMI.texto}
        </div>
      )}

      {/* TARJETAS DE INDICADORES KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#101626] border border-slate-800/80 p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Usuarios</p>
          <h3 className="text-3xl font-black mt-1 text-slate-100">{totalUsuarios}</h3>
        </div>
        <div className="bg-[#101626] border border-slate-800/80 p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Productos Activos</p>
          <h3 className="text-3xl font-black mt-1 text-blue-400">{productosActivos}</h3>
        </div>
        <div className="bg-[#101626] border border-slate-800/80 p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items en Inventario</p>
          <h3 className="text-3xl font-black mt-1 text-amber-400">{itemsInventario}</h3>
        </div>
        <div className="bg-[#101626] border border-slate-800/80 p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Órdenes Procesadas</p>
          <h3 className="text-3xl font-black mt-1 text-purple-400">{ordenesProcesadas}</h3>
        </div>
      </div>

      {/* SECCIÓN INTERACTIVA MANDO Y ACTUADOR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* MANDO DE DOSIFICACIÓN */}
        <div className="bg-[#101626] border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black tracking-wider text-slate-200 border-b border-slate-800 pb-2 mb-4 flex items-center gap-1.5">
              🎛️ MANDO DE DOSIFICACIÓN
            </h2>
            
            <div className="mb-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">1. Seleccionar Línea de Producto</label>
              <select 
                value={lineaProducto} 
                onChange={(e) => setLineaProducto(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Mani">Maní</option>
                <option value="Coco">Coco</option>
                <option value="Almendra">Almendra</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">2. Presentación</label>
              <div className="grid grid-cols-3 gap-2">
                {['250ml', '500ml', '1000ml'].map((tam) => (
                  <button
                    key={tam}
                    onClick={() => setPresentacion(tam)}
                    className={`text-xs py-2 font-bold rounded-lg border transition-all ${
                      presentacion === tam 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-md' 
                        : 'bg-[#0a0f1d] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {tam}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={() => setEstadoValvula('ABRIR_ORDEN (PROCESANDO)')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black py-3 rounded-lg uppercase tracking-wider transition-all mt-4 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/20"
          >
            ▶️ Iniciar Proceso
          </button>
        </div>

        {/* MONITOR DEL ACTUADOR AUTOMÁTICO */}
        <div className="bg-[#101626] border border-slate-800 p-5 rounded-xl md:col-span-2 flex flex-col justify-between">
          <h2 className="text-sm font-black tracking-wider text-slate-200 border-b border-slate-800 pb-2 mb-4">
            🧪 MONITOR DEL ACTUADOR AUTOMÁTICO
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center my-auto">
            {/* Contenedor Animación o Gráfico */}
            <div className="flex justify-center items-center h-32 bg-[#0a0f1d] rounded-xl border border-slate-800/60 relative overflow-hidden">
              <div className="absolute bottom-0 w-16 bg-blue-500/30 border-t-2 border-blue-400 transition-all duration-1000" style={{ height: estadoValvula.includes('ABRIR_ORDEN') ? '80%' : '15%' }}></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest z-10">Tanque de Llenado</span>
            </div>

            {/* Datos de la Válvula */}
            <div className="bg-[#0a0f1d] border border-slate-800 p-4 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado de Válvula</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`w-2 h-2 rounded-full ${estadoValvula.includes('ABRIR_ORDEN') ? 'bg-orange-500 animate-pulse' : 'bg-slate-500'}`}></span>
                <span className="text-xs font-black tracking-wide text-slate-200">{estadoValvula}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* REGISTROS BAJO EL SCADA (TABLAS DE BASE DE DATOS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* REGISTRO DE USUARIOS */}
        <div className="bg-[#101626] border border-slate-800 p-5 rounded-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
            <h2 className="text-xs font-black tracking-wider text-slate-200 uppercase">👥 Registro de Usuarios</h2>
            <span className="text-[10px] font-bold bg-[#0a0f1d] px-2 py-0.5 rounded border border-slate-800 text-slate-400">Filtro Activo</span>
          </div>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 font-bold">
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Correo</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-300 divide-y divide-slate-850">
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-500 font-bold">No hay operadores registrados</td>
                  </tr>
                ) : (
                  usuarios.map((user) => (
                    <tr key={user.id_usuario} className="hover:bg-[#0a0f1d]/50">
                      <td className="py-2 text-slate-500">#{user.id_usuario}</td>
                      <td className="py-2 font-bold text-slate-200">{user.nombre}</td>
                      <td className="py-2 text-slate-400">{user.correo}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ESTADO DEL INVENTARIO */}
        <div className="bg-[#101626] border border-slate-800 p-5 rounded-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
            <h2 className="text-xs font-black tracking-wider text-slate-200 uppercase">📦 Estado del Inventario</h2>
            <span className="text-[10px] font-bold bg-[#0a0f1d] px-2 py-0.5 rounded border border-slate-800 text-slate-400">Línea Crítica</span>
          </div>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 font-bold">
                  <th className="pb-2">Materia Prima</th>
                  <th className="pb-2 text-right">Stock Disponible</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-300 divide-y divide-slate-850">
                {inventario.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-500 font-bold">No hay registros dinámicos</td>
                  </tr>
                ) : (
                  inventario.map((inv) => (
                    <tr key={inv.id_materia} className="hover:bg-[#0a0f1d]/50">
                      <td className="py-2 font-bold text-slate-200">✨ {inv.nombre}</td>
                      <td className="py-2 text-right font-black text-amber-400">
                        {parseFloat(inv.cantidad_disponible).toFixed(2)} {inv.unidad_medida || 'Kg'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
