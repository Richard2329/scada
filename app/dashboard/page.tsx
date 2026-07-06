'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardPage() {
  // --- NAVEGACIÓN Y CONFIGURACIÓN INDUSTRIAL ---
  const [pantallaActiva, setPantallaActiva] = useState<string>('principal');
  const [rolSimulado, setRolSimulado] = useState<string>('supervisor');
  const [alarmas, setAlarmas] = useState<any[]>([]);

  // --- PARAMETROS DE CONTROL DESPACHO ---
  const [productoSeleccionado, setProductoSeleccionado] = useState<string>('');
  const [pesoPresentacion, setPesoPresentacion] = useState<number>(25);
  const [tamanoLoteInput, setTamanoLoteInput] = useState<number>(10);
  const [mensajeHMI, setMensajeHMI] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null);

  // --- ESTADOS METRICOS ---
  const [totalUsuarios, setTotalUsuarios] = useState<number>(0);
  const [productosActivos, setProductosActivos] = useState<number>(0);
  const [ordenesProcesadas, setOrdenesProcesadas] = useState<number>(0);
  const [materiaPrimaCount, setMateriaPrimaCount] = useState<number>(0);

  // --- CONTADORES ESTADÍSTICOS DE CALIDAD ---
  const [aceptados, setAceptados] = useState<number>(0);
  const [rechazados, setRechazados] = useState<number>(0);
  const [eficienciaOEE, setEficienciaOEE] = useState<number>(0);
  const [registroMermas, setRegistroMermas] = useState<number>(0);
  const [estadoCelda, setEstadoCelda] = useState<string>('CONCLUIDO');
  const [ultimoLoteId, setUltimoLoteId] = useState<string>('N/A');

  // --- LISTAS DE TABLAS ---
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [lotesConcluidos, setLotesConcluidos] = useState<any[]>([]);
  const [ordenesProduccion, setOrdenesProduccion] = useState<any[]>([]);
  const [catalogoProductos, setCatalogoProductos] = useState<any[]>([]);
  const [historicoBolsas, setHistoricoBolsas] = useState<any[]>([]);

  // --- INTERFAZ DE FILTRADO CONTROLADO (SÉLECTOR EXCLUSIVO POR TABLA) ---
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS'); // Mapea las selecciones de manera unificada
  const [cargando, setCargando] = useState<boolean>(true);

  // --- RESETEAR FILTROS AL CAMBIAR DE SUBPANTALLA ---
  const cambiarPantalla = (pantalla: string) => {
    setPantallaActiva(pantalla);
    setFiltroTexto('');
    setFiltroEstado('TODOS');
  };

  // --- TRAER DATOS DESDE SUPABASE ---
  const cargarDatosSupabase = async () => {
    try {
      setCargando(true);

      const { data: dataUsuarios } = await supabase.from('usuarios').select('*');
      const listaUsuarios = dataUsuarios || [];
      setUsuarios(listaUsuarios);
      setTotalUsuarios(listaUsuarios.length);

      const { data: dataProd } = await supabase.from('productos').select('*');
      const listaProd = dataProd || [];
      setCatalogoProductos(listaProd);
      setProductosActivos(listaProd.length);
      if (listaProd.length > 0 && !productoSeleccionado) {
        setProductoSeleccionado(listaProd[0].nombre);
      }

      const { data: dataOrd } = await supabase.from('ordenes_produccion').select('*').order('fecha_creacion', { ascending: false });
      const listaOrd = dataOrd || [];
      setOrdenesProduccion(listaOrd);
      setOrdenesProcesadas(listaOrd.length);

      const { data: dataMat } = await supabase.from('inventario_materias').select('*');
      const listaMat = dataMat || [];
      setInventario(listaMat);
      setMateriaPrimaCount(listaMat.length);

      const { data: dataLotes } = await supabase.from('lotes').select('*').order('fecha_produccion', { ascending: false });
      const listaLotes = dataLotes || [];
      setLotesConcluidos(listaLotes);

      const { data: dataBolsas } = await supabase.from('produccion_historica').select('*').order('fecha_hora', { ascending: false });
      const listaBolsas = dataBolsas || [];
      setHistoricoBolsas(listaBolsas);

      // --- PROCESAMIENTO ANALÍTICO ---
      if (listaLotes.length > 0) {
        setUltimoLoteId(listaLotes[0].numero_lote);
        let sumaAceptados = 0;
        let sumaRechazados = 0;
        listaLotes.forEach(l => {
          sumaAceptados += Number(l.cantidad_producida || 0);
          sumaRechazados += Number(l.cantidad_rechazada || 0);
        });
        setAceptados(sumaAceptados);
        setRechazados(sumaRechazados);

        const totalUnidades = sumaAceptados + sumaRechazados;
        if (totalUnidades > 0) {
          setEficienciaOEE(Math.round((sumaAceptados / totalUnidades) * 100));
        }
      }

      // --- EVALUADOR DE ALARMAS DE PLANTA EN TIEMPO REAL ---
      if (listaBolsas.length > 0) {
        let desvioNetoTotal = 0;
        const nuevasAlarmas: any[] = [];
        
        listaBolsas.forEach(b => {
          const desvio = Math.abs(Number(b.peso_real || 0) - Number(b.peso_objetivo || 0));
          desvioNetoTotal += desvio;
          
          if (b.estado_llenado === 'RECHAZADO') {
            nuevasAlarmas.push({
              id: b.id_historico || Math.random(),
              fecha: b.fecha_hora,
              mensaje: `Desviación crítica detectada en lote ${b.id_lote}: Peso de ${b.peso_real}g fuera de rango.`
            });
          }
        });
        
        setAlarmas(nuevasAlarmas.slice(0, 5));
        setRegistroMermas(parseFloat(desvioNetoTotal.toFixed(2)));
        setEstadoCelda(listaBolsas[0].estado_llenado === 'ACEPTADO' ? 'PROCESANDO' : 'CRÍTICO / RECHAZO');
      }

    } catch (error) {
      console.error('❌ Error general SCADA:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatosSupabase();
    fetch('/api/mqtt').catch((err) => console.log('Pasarela MQTT Inicializada', err));

    const canalMesaControl = supabase
      .channel('scada-cambios')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        cargarDatosSupabase();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalMesaControl);
    };
  }, [productoSeleccionado]);

  // --- LÓGICA DE DESPACHO SEGURO ---
  const manejarDespachoHMI = () => {
    setMensajeHMI(null);
    if (rolSimulado === 'operador') {
      setMensajeHMI({ tipo: 'error', texto: 'ACCESO DENEGADO: El rol de Operador solo tiene permisos de lectura HMI.' });
      return;
    }

    const materiaAsociada = inventario.find(i => i.nombre.toLowerCase().includes(productoSeleccionado.toLowerCase()));
    const gramosRequeridos = pesoPresentacion * tamanoLoteInput;
    const kilosRequeridos = gramosRequeridos / 1000;

    if (materiaAsociada && Number(materiaAsociada.cantidad_disponible) < kilosRequeridos) {
      setMensajeHMI({ 
        tipo: 'error', 
        texto: `FALLO DE ENCLAVAMIENTO: Stock insuficiente de ${productoSeleccionado}. Requerido: ${kilosRequeridos}Kg, Disponible: ${materiaAsociada.cantidad_disponible}Kg.` 
      });
      return;
    }

    setMensajeHMI({ 
      tipo: 'exito', 
      texto: `ORDEN DESPACHADA: Iniciando lote de ${tamanoLoteInput} unidades de ${productoSeleccionado} (${gramosRequeridos}g netos). Comando enviado vía MQTT.` 
    });
  };

  // --- MATRIZ GLOBAL DE FILTRADO CONTROLADO (TEXTO + SELECTS PREESTABLECIDOS) ---
  const obtenerDatosFiltrados = () => {
    const busqueda = filtroTexto.toLowerCase();

    switch (pantallaActiva) {
      case 'lotes':
        return lotesConcluidos.filter(l => {
          const cumpleTexto = (l.numero_lote || '').toLowerCase().includes(busqueda);
          if (filtroEstado === 'OPTIMOS') return cumpleTexto && Number(l.cantidad_rechazada) === 0;
          if (filtroEstado === 'RECHAZADOS') return cumpleTexto && Number(l.cantidad_rechazada) > 0;
          return cumpleTexto;
        });
        
      case 'bolsas':
        return historicoBolsas.filter(b => {
          const cumpleTexto = (b.id_lote || '').toLowerCase().includes(busqueda);
          const cumpleSelect = filtroEstado === 'TODOS' || b.estado_llenado === filtroEstado;
          return cumpleTexto && cumpleSelect;
        });

      case 'ordenes':
        return ordenesProduccion.filter(o => {
          const cumpleTexto = (o.id_orden || '').toString().toLowerCase().includes(busqueda);
          const cumpleSelect = filtroEstado === 'TODOS' || (o.estado || '').toLowerCase() === filtroEstado.toLowerCase();
          return cumpleTexto && cumpleSelect;
        });

      case 'inventario':
        return inventario.filter(i => {
          const cumpleTexto = (i.nombre || '').toLowerCase().includes(busqueda);
          if (filtroEstado === 'CRITICO') return cumpleTexto && Number(i.cantidad_disponible) < 300;
          if (filtroEstado === 'ESTABLE') return cumpleTexto && Number(i.cantidad_disponible) >= 300;
          return cumpleTexto;
        });

      case 'productos':
        return catalogoProductos.filter(p => {
          const cumpleTexto = (p.nombre || '').toLowerCase().includes(busqueda);
          if (filtroEstado === 'PREMIUM') return cumpleTexto && Number(p.precio) > 5;
          if (filtroEstado === 'ESTANDAR') return cumpleTexto && Number(p.precio) <= 5;
          return cumpleTexto;
        });

      case 'usuarios':
        return usuarios.filter(u => {
          const cumpleTexto = (u.nombre || '').toLowerCase().includes(busqueda) || (u.correo || '').toLowerCase().includes(busqueda);
          const cumpleSelect = filtroEstado === 'TODOS' || (u.rol || 'operador').toLowerCase() === filtroEstado.toLowerCase();
          return cumpleTexto && cumpleSelect;
        });

      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-6 font-sans">
      
      {/* ========================================================================= */}
      {/* VISTA 1: INTERFAZ O PANTALLA PRINCIPAL HMI / SCADA                       */}
      {/* ========================================================================= */}
      {pantallaActiva === 'principal' && (
        <>
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-4 mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-wider text-white">Planta Industrial — Consola de Control HMI / SCADA</h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">Gestión activa de órdenes de empaque y analítica integrada</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-[#131a2e] border border-slate-800 rounded-lg p-1.5 px-3 flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Llave de Rol:</span>
                <select 
                  value={rolSimulado} 
                  onChange={(e) => { setRolSimulado(e.target.value); setMensajeHMI(null); }}
                  className="bg-[#0b0f19] text-blue-400 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="supervisor">🔑 SUPERVISOR (Control)</option>
                  <option value="operador">👁️ OPERADOR (Lectura)</option>
                </select>
              </div>
              <button onClick={cargarDatosSupabase} className="px-4 py-2 bg-[#1e293b] hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700 transition-all shadow-md">
                🔄 Sincronizar Planta
              </button>
            </div>
          </header>

          {/* BANNER DE ALARMAS ACTIVAS SCADA */}
          {alarmas.length > 0 && (
            <div className="mb-6 bg-red-950/40 border border-red-800 text-red-400 rounded-xl p-4 text-xs animate-pulse">
              <span className="font-black uppercase tracking-widest text-[10px] block mb-1">🚨 Alertas del Sistema en Tiempo Real:</span>
              <ul className="list-disc pl-4 font-mono text-[11px] space-y-0.5">
                {alarmas.map((al, idx) => (
                  <li key={idx}><strong>{al.fecha.split('T')[1] || al.fecha}:</strong> {al.mensaje}</li>
                ))}
              </ul>
            </div>
          )}

          {/* PANEL DE DESPACHO INTERACTIVO */}
          <section className="bg-[#131a2e] border border-slate-800/80 rounded-xl p-5 mb-6 shadow-xl">
            <h2 className="text-xs font-bold text-white tracking-widest uppercase mb-4 flex items-center gap-2">
              🕹️ Panel de Despacho y Control de Procesos (HMI)
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase">1. Seleccionar Producto</label>
                <select 
                  value={productoSeleccionado}
                  onChange={(e) => setProductoSeleccionado(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {catalogoProductos.map((producto) => (
                    <option key={producto.id_producto} value={producto.nombre}>{producto.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase">2. Peso de Presentación</label>
                <select onChange={(e) => setPesoPresentacion(Number(e.target.value))} className="w-full bg-[#0b0f19] border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:border-blue-500 focus:outline-none">
                  <option value={25}>25 gramos (Estándar)</option>
                  <option value={50}>50 gramos</option>
                  <option value={100}>100 gramos</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase">3. Tamaño del Lote</label>
                <input 
                  type="number" 
                  value={tamanoLoteInput} 
                  onChange={(e) => setTamanoLoteInput(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-[#0b0f19] border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button onClick={manejarDespachoHMI} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs p-2.5 rounded-lg transition-all shadow-md">
                ⚙️ Iniciar Proceso en Planta
              </button>
            </div>

            {/* FEEDBACK DEL PANEL HMI */}
            {mensajeHMI && (
              <div className={`mt-4 p-3 rounded-lg text-xs font-mono font-bold border ${
                mensajeHMI.tipo === 'exito' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-red-950/40 border-red-800 text-red-400'
              }`}>
                {mensajeHMI.texto}
              </div>
            )}
          </section>

          {/* TARJETAS METRICAS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#131a2e] border border-slate-800 p-4 rounded-xl shadow-lg">
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Estado de Celda</p>
              <p className={`text-xl font-black mt-1 flex items-center gap-2 ${estadoCelda.includes('CRÍTICO') ? 'text-red-400' : 'text-white'}`}>
                <span className={`w-2.5 h-2.5 rounded-full bg-blue-500 ${estadoCelda.includes('CRÍTICO') ? 'bg-red-500' : 'animate-pulse'}`}></span>
                {estadoCelda}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">Último Lote: <span className="font-mono text-blue-400">{ultimoLoteId}</span></p>
            </div>

            <div className="bg-[#131a2e] border border-slate-800 p-4 rounded-xl shadow-lg">
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Eficiencia de Calidad (OEE)</p>
              <p className="text-3xl font-black text-amber-400 mt-1">{eficienciaOEE}%</p>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-400 h-full transition-all" style={{ width: `${eficienciaOEE}%` }}></div>
              </div>
            </div>

            <div className="bg-[#131a2e] border border-slate-800 p-4 rounded-xl shadow-lg">
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Balance de Envases</p>
              <div className="flex justify-between items-center mt-2">
                <div>
                  <p className="text-lg font-black text-emerald-400">{aceptados}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Aceptados</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-red-400">{rechazados}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Rechazados</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 border-t border-slate-800 pt-1">Total: {aceptados + rechazados} und</p>
            </div>

            <div className="bg-[#131a2e] border border-slate-800 p-4 rounded-xl shadow-lg">
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Registro de Mermas</p>
              <p className="text-2xl font-black text-red-500 mt-1">{registroMermas} g</p>
              <p className="text-[11px] text-slate-400 mt-2">Desviación neta acumulada en celdas</p>
            </div>
          </section>

          {/* MINI CONTROL SPC */}
          <section className="bg-[#131a2e] border border-slate-800 rounded-xl p-5 mb-6 shadow-xl">
            <h3 className="text-xs font-bold text-white tracking-wider mb-4 flex items-center gap-2">📊 Monitor Estadístico Rápido de Envases</h3>
            <div className="h-28 bg-[#0b0f19] border border-slate-800 rounded-xl relative flex items-end p-2">
              <div className="w-full h-full flex justify-between items-end px-4 z-10 pt-4">
                {historicoBolsas.slice(0, 12).reverse().map((b, idx) => {
                  const altura = Math.min(100, (Number(b.peso_real || 0) / 35) * 100);
                  return (
                    <div key={idx} className="w-3 bg-blue-500/80 rounded-t hover:bg-blue-400 transition-all relative group" style={{ height: `${altura}%` }}>
                      <span className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-[8px] p-1 rounded border border-slate-700 text-white z-50 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        {b.peso_real}g
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* MENU DE ENTRADA A PANTALLAS AISLADAS */}
          <h3 className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">📂 Consultar Bases de Datos de la Planta</h3>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <button onClick={() => cambiarPantalla('lotes')} className="p-4 bg-[#131a2e] border border-slate-800 hover:border-blue-500 rounded-xl text-center transition-all group shadow-md">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">📦</div>
              <p className="text-xs font-bold text-white">Lotes Concluidos</p>
              <span className="text-[10px] text-blue-400 font-mono font-bold">{lotesConcluidos.length} Registros</span>
            </button>
            <button onClick={() => cambiarPantalla('bolsas')} className="p-4 bg-[#131a2e] border border-slate-800 hover:border-blue-500 rounded-xl text-center transition-all group shadow-md">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🕒</div>
              <p className="text-xs font-bold text-white">Histórico Bolsas</p>
              <span className="text-[10px] text-blue-400 font-mono font-bold">{historicoBolsas.length} Muestras</span>
            </button>
            <button onClick={() => cambiarPantalla('ordenes')} className="p-4 bg-[#131a2e] border border-slate-800 hover:border-blue-500 rounded-xl text-center transition-all group shadow-md">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">📋</div>
              <p className="text-xs font-bold text-white">Órdenes Fábrica</p>
              <span className="text-[10px] text-blue-400 font-mono font-bold">{ordenesProduccion.length} Órdenes</span>
            </button>
            <button onClick={() => cambiarPantalla('inventario')} className="p-4 bg-[#131a2e] border border-slate-800 hover:border-blue-500 rounded-xl text-center transition-all group shadow-md">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🌾</div>
              <p className="text-xs font-bold text-white">Materia Prima</p>
              <span className="text-[10px] text-blue-400 font-mono font-bold">{materiaPrimaCount} Tipos</span>
            </button>
            <button onClick={() => cambiarPantalla('productos')} className="p-4 bg-[#131a2e] border border-slate-800 hover:border-blue-500 rounded-xl text-center transition-all group shadow-md">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🏷️</div>
              <p className="text-xs font-bold text-white">Catálogo Prod.</p>
              <span className="text-[10px] text-blue-400 font-mono font-bold">{catalogoProductos.length} Ítems</span>
            </button>
            <button onClick={() => cambiarPantalla('usuarios')} className="p-4 bg-[#131a2e] border border-slate-800 hover:border-blue-500 rounded-xl text-center transition-all group shadow-md">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">👥</div>
              <p className="text-xs font-bold text-white">Usuarios/Op.</p>
              <span className="text-[10px] text-blue-400 font-mono font-bold">{totalUsuarios} Técnicos</span>
            </button>
          </section>
        </>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: SUBPANTALLAS EXCLUSIVAS CON SELECTS ASOCIADOS EN TODO EL SISTEMA */}
      {/* ========================================================================= */}
      {pantallaActiva !== 'principal' && (
        <div className="animate-fadeIn">
          <div className="flex justify-between items-center mb-4">
            <button 
              onClick={() => setPantallaActiva('principal')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all shadow-md flex items-center gap-2"
            >
              ⬅️ Volver a la Consola Principal
            </button>

            <button 
              onClick={() => alert(`Exportando reporte analítico en tiempo real...`)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg border border-emerald-700 transition-all shadow-md"
            >
              📥 Exportar Tabla (.CSV)
            </button>
          </div>

          <div className="bg-[#131a2e] border border-slate-800 rounded-xl p-5 mb-6 shadow-xl">
            <h2 className="text-xl font-black text-white tracking-wide capitalize flex items-center gap-2">
              📂 Explorador Exclusivo: Base de Datos de {pantallaActiva === 'ordenes' ? 'Órdenes' : pantallaActiva === 'bolsas' ? 'Histórico de Bolsas' : pantallaActiva}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Pantalla analítica aislada con herramientas de filtrado estadístico y representación gráfica.</p>
          </div>

          {/* GRÁFICOS ESTADÍSTICOS SEGÚN PANTALLA */}
          <section className="bg-[#131a2e] border border-slate-800 rounded-xl p-5 mb-6 shadow-xl">
            <h3 className="text-xs font-bold text-white tracking-wider uppercase mb-4">📈 Rendimiento Estadístico de la Tabla</h3>
            
            {pantallaActiva === 'lotes' && (
              <div className="h-36 flex items-end justify-between px-6 bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
                {obtenerDatosFiltrados().slice(0, 10).map((l, i) => {
                  const t = Number(l.cantidad_producida || 0) + Number(l.cantidad_rechazada || 0);
                  const h = t > 0 ? Math.min(100, (Number(l.cantidad_producida || 0) / t) * 100) : 0;
                  return (
                    <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                      <div className="w-6 bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-400" style={{ height: `${h}%` }}></div>
                      <span className="text-[9px] font-mono mt-2 text-slate-500">{l.numero_lote}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {pantallaActiva === 'bolsas' && (
              <div className="h-36 bg-[#0b0f19] border border-slate-800 rounded-xl relative flex items-end p-2">
                <div className="w-full h-full flex justify-between items-end px-4 pt-4">
                  {obtenerDatosFiltrados().slice(0, 30).reverse().map((b, idx) => {
                    const altura = Math.min(100, (Number(b.peso_real || 0) / 35) * 100);
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                        <div 
                          className={`w-2.5 h-2.5 rounded-full border-2 border-[#0b0f19] ${b.estado_llenado === 'ACEPTADO' ? 'bg-blue-500' : 'bg-red-500'}`}
                          style={{ marginBottom: `${altura}%` }}
                        ></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pantallaActiva === 'ordenes' && (
              <div className="h-36 flex items-end justify-around bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
                {obtenerDatosFiltrados().slice(0, 10).map((o, i) => {
                  const h = Math.min(100, (Number(o.tamano_lote || 0) / 50) * 100);
                  return (
                    <div key={i} className="w-5 bg-amber-500 rounded-t text-center group relative" style={{ height: `${h}%` }}>
                      <span className="text-[8px] absolute -top-5 left-0 right-0 text-slate-400 font-bold">{o.tamano_lote}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {pantallaActiva === 'inventario' && (
              <div className="h-36 flex items-end justify-around bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
                {obtenerDatosFiltrados().map((inv, i) => {
                  const h = Math.min(100, (Number(inv.cantidad_disponible || 0) / 1000) * 100);
                  return (
                    <div key={i} className="flex flex-col items-center justify-end h-full w-12 group">
                      <div className="w-full bg-cyan-600 rounded-t transition-all group-hover:bg-cyan-500" style={{ height: `${h}%` }}></div>
                      <span className="text-[9px] text-slate-400 mt-2 truncate max-w-full font-bold">{inv.nombre}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {(pantallaActiva === 'productos' || pantallaActiva === 'usuarios') && (
              <div className="h-36 flex items-end justify-around bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
                {obtenerDatosFiltrados().slice(0, 12).map((item, i) => {
                  const valorBase = pantallaActiva === 'productos' ? Number(item.precio || 0) * 15 : 50;
                  return (
                    <div key={i} className="w-6 bg-purple-500 rounded-t transition-all hover:bg-purple-400" style={{ height: `${Math.min(100, valorBase)}%` }}></div>
                  );
                })}
              </div>
            )}
          </section>

          {/* TABLA CON FILTRADO COMPLETO Y TOTALMENTE CONTROLADO */}
          <section className="bg-[#131a2e] border border-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-[#111728] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              
              <div className="flex flex-wrap items-center gap-3 w-full max-w-2xl">
                {/* Buscador de Texto General */}
                <input 
                  type="text"
                  placeholder={`Buscar en esta tabla por ID / Texto...`}
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 w-full sm:w-64"
                />

                {/* FILTROS EXCLUSIVOS SELECTS (UN MENÚ ÚNICO PARA CADA TABLA ACTIVA) */}
                {pantallaActiva === 'lotes' && (
                  <div className="flex items-center gap-2 text-xs bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-1.5">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Rendimiento:</span>
                    <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="bg-transparent text-emerald-400 font-black focus:outline-none cursor-pointer">
                      <option value="TODOS">📦 TODOS LOS LOTES</option>
                      <option value="OPTIMOS">⭐ LOTES ÓPTIMOS (0 RECHAZOS)</option>
                      <option value="RECHAZADOS">🚨 LOTES CON MERMAS/RECHAZOS</option>
                    </select>
                  </div>
                )}

                {pantallaActiva === 'bolsas' && (
                  <div className="flex items-center gap-2 text-xs bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-1.5">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Estado de Bolsa:</span>
                    <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="bg-transparent text-blue-400 font-black focus:outline-none cursor-pointer">
                      <option value="TODOS">📋 MOSTRAR TODAS</option>
                      <option value="ACEPTADO">✅ SOLO ACEPTADOS</option>
                      <option value="RECHAZADO">❌ SOLO RECHAZADOS</option>
                    </select>
                  </div>
                )}

                {pantallaActiva === 'ordenes' && (
                  <div className="flex items-center gap-2 text-xs bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-1.5">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Estado Órden:</span>
                    <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="bg-transparent text-amber-400 font-black focus:outline-none cursor-pointer">
                      <option value="TODOS">📋 TODAS LAS ÓRDENES</option>
                      <option value="completado">🟢 COMPLETADO</option>
                      <option value="pendiente">🟡 PENDIENTE</option>
                    </select>
                  </div>
                )}

                {pantallaActiva === 'inventario' && (
                  <div className="flex items-center gap-2 text-xs bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-1.5">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Materia Prima:</span>
                    <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="bg-transparent text-cyan-400 font-black focus:outline-none cursor-pointer">
                      <option value="TODOS">🌾 TODOS LOS INVENTARIOS</option>
                      <option value="CRITICO">🚨 STOCK CRÍTICO (&lt; 300 Kg)</option>
                      <option value="ESTABLE">🍏 STOCK ESTABLE (&gt;= 300 Kg)</option>
                    </select>
                  </div>
                )}

                {pantallaActiva === 'productos' && (
                  <div className="flex items-center gap-2 text-xs bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-1.5">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Segmentación:</span>
                    <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="bg-transparent text-pink-400 font-black focus:outline-none cursor-pointer">
                      <option value="TODOS">🏷️ TODO EL VADEMÉCUM</option>
                      <option value="PREMIUM">💎 CATEGORÍA PREMIUM (&gt; $5)</option>
                      <option value="ESTANDAR">📦 CATEGORÍA ESTÁNDAR (&lt;= $5)</option>
                    </select>
                  </div>
                )}

                {pantallaActiva === 'usuarios' && (
                  <div className="flex items-center gap-2 text-xs bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-1.5">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Rango Técnico:</span>
                    <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="bg-transparent text-purple-400 font-black focus:outline-none cursor-pointer">
                      <option value="TODOS">👥 TODOS LOS TÉCNICOS</option>
                      <option value="administrador">👑 ADMINISTRADORES</option>
                      <option value="supervisor">🔑 SUPERVISORES</option>
                      <option value="operador">👁️ OPERADORES</option>
                    </select>
                  </div>
                )}
              </div>

              <span className="text-xs text-slate-400 font-bold whitespace-nowrap">
                Filtrados: <span className="text-white font-mono">{obtenerDatosFiltrados().length}</span> registros
              </span>
            </div>

            <div className="overflow-x-auto">
              {cargando ? (
                <div className="p-10 text-center text-xs font-bold text-slate-500 tracking-widest animate-pulse uppercase">Consultando base de datos completa...</div>
              ) : obtenerDatosFiltrados().length === 0 ? (
                <div className="p-10 text-center text-xs font-bold text-slate-500 tracking-widest uppercase">No existen registros que coincidan con este filtro controlado</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0e1424] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                      {pantallaActiva === 'lotes' && (
                        <>
                          <th className="p-3">Nº Lote</th>
                          <th className="p-3">Aceptados</th>
                          <th className="p-3">Rechazados</th>
                          <th className="p-3">Fecha Production</th>
                          <th className="p-3">Observaciones</th>
                        </>
                      )}
                      {pantallaActiva === 'bolsas' && (
                        <>
                          <th className="p-3">Lote Asociado</th>
                          <th className="p-3">Peso Real (g)</th>
                          <th className="p-3">Objetivo (g)</th>
                          <th className="p-3">Estado Control</th>
                          <th className="p-3">Marca Temporal</th>
                        </>
                      )}
                      {pantallaActiva === 'ordenes' && (
                        <>
                          <th className="p-3">ID Orden</th>
                          <th className="p-3">Tamaño Lote</th>
                          <th className="p-3">Cantidad Solicitada</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Creación</th>
                        </>
                      )}
                      {pantallaActiva === 'inventario' && (
                        <>
                          <th className="p-3">ID Materia</th>
                          <th className="p-3">Materia Prima</th>
                          <th className="p-3">Cantidad Disponible (Kg)</th>
                          <th className="p-3">Última Actualización</th>
                        </>
                      )}
                      {pantallaActiva === 'productos' && (
                        <>
                          <th className="p-3">ID Producto</th>
                          <th className="p-3">Nombre</th>
                          <th className="p-3">Descripción</th>
                          <th className="p-3">Precio</th>
                        </>
                      )}
                      {pantallaActiva === 'usuarios' && (
                        <>
                          <th className="p-3">ID</th>
                          <th className="p-3">Nombre Completo</th>
                          <th className="p-3">Correo Electrónico</th>
                          <th className="p-3">Rol Técnico</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {obtenerDatosFiltrados().map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-800/60 hover:bg-[#161f36] transition-colors text-slate-300">
                        {pantallaActiva === 'lotes' && (
                          <>
                            <td className="p-3 font-mono font-bold text-blue-400">{item.numero_lote}</td>
                            <td className="p-3 text-emerald-400 font-bold">{item.cantidad_producida} ud</td>
                            <td className="p-3 text-red-400 font-bold">{item.cantidad_rechazada} ud</td>
                            <td className="p-3">{item.fecha_produccion}</td>
                            <td className="p-3 italic text-slate-400">{item.observaciones}</td>
                          </>
                        )}
                        {pantallaActiva === 'bolsas' && (
                          <>
                            <td className="p-3 font-mono font-bold text-slate-400">{item.id_lote}</td>
                            <td className={`p-3 font-bold ${item.estado_llenado === 'ACEPTADO' ? 'text-blue-400' : 'text-red-400'}`}>{item.peso_real} g</td>
                            <td className="p-3 text-slate-400">{item.peso_objetivo} g</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${item.estado_llenado === 'ACEPTADO' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                                {item.estado_llenado}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 font-mono">{item.fecha_hora}</td>
                          </>
                        )}
                        {pantallaActiva === 'ordenes' && (
                          <>
                            <td className="p-3 font-bold text-slate-400"># {item.id_orden}</td>
                            <td className="p-3 font-bold text-white">{item.tamano_lote}</td>
                            <td className="p-3">{item.cantidad_solicitada}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${item.estado === 'completado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {item.estado}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400">{item.fecha_creacion}</td>
                          </>
                        )}
                        {pantallaActiva === 'inventario' && (
                          <>
                            <td className="p-3 font-mono">MAT-{item.id_materia}</td>
                            <td className="p-3 font-bold text-white">{item.nombre}</td>
                            <td className={`p-3 font-bold ${Number(item.cantidad_disponible) < 300 ? 'text-red-400' : 'text-amber-400'}`}>{item.cantidad_disponible} Kg</td>
                            <td className="p-3 text-slate-400">{item.ultima_actualizacion}</td>
                          </>
                        )}
                        {pantallaActiva === 'productos' && (
                          <>
                            <td className="p-3 font-mono">PROD-{item.id_producto}</td>
                            <td className="p-3 font-bold text-white">{item.nombre}</td>
                            <td className="p-3 text-slate-400">{item.descripcion || 'Sin descripción'}</td>
                            <td className="p-3 font-bold text-cyan-400">${item.precio}</td>
                          </>
                        )}
                        {pantallaActiva === 'usuarios' && (
                          <>
                            <td className="p-3"># {item.id_usuario}</td>
                            <td className="p-3 font-bold text-white">{item.nombre}</td>
                            <td className="p-3 text-slate-400">{item.correo}</td>
                            <td className="p-3 uppercase font-extrabold text-blue-400 text-[10px] tracking-wider">{item.rol || 'operador'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
