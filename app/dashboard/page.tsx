'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardGlobal() {
  const [pestaña, setPestaña] = useState('produccion');
  const [datos, setDatos] = useState({
    usuarios: [],
    productos: [],
    inventario: [],
    ordenes: [],
    lotes: [],
    historico: []
  });
  const [cargando, setCargando] = useState(true);

  // Estados para Filtros de Búsqueda
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // Estados para el Formulario de Control de Procesos (HMI hacia Wokwi)
  const [idProductoSeleccionado, setIdProductoSeleccionado] = useState('');
  const [pesoPresentacion, setPesoPresentacion] = useState('25');
  const [tamanoLote, setTamanoLote] = useState('10');
  const [enviandoProceso, setEnviandoProceso] = useState(false);
  const [mensajeHMI, setMensajeHMI] = useState({ texto: '', tipo: '' });

  // Estados dinámicos calculados para KPIs Industriales
  const [kpis, setKpis] = useState({
    eficienciaOEE: 100,
    totalAceptadas: 0,
    totalRechazadas: 0,
    mermaGramos: 0,
    estadoMaquina: 'INACTIVO',
    ultimoLoteActivo: 'N/A'
  });

  const consultarBaseDatos = async () => {
    setCargando(true);
    
    const [resUser, resProd, resInv, resOrd, resLot, resHist] = await Promise.all([
      supabase.from('usuarios').select('*'),
      supabase.from('productos').select('*'),
      supabase.from('inventario_materias').select('*'),
      supabase.from('ordenes_produccion').select('*').order('fecha_creacion', { ascending: false }),
      supabase.from('lotes').select('*'),
      supabase.from('produccion_historica').select('*').order('fecha_hora', { ascending: false })
    ]);

    const historico = resHist.data || [];
    const productos = resProd.data || [];

    // Selección automática inicial del primer producto en el formulario
    if (productos.length > 0 && !idProductoSeleccionado) {
      setIdProductoSeleccionado(productos[0].id_producto.toString());
    }

    // Cálculos de KPIs Industriales
    const totalBolsas = historico.length;
    const aceptadas = historico.filter((h: any) => h.estado_llenado === 'ACEPTADO').length;
    const rechazadas = historico.filter((h: any) => h.estado_llenado === 'RECHAZADO').length;
    const oee = totalBolsas > 0 ? Math.round((aceptadas / totalBolsas) * 100) : 100;

    const gramosMerma = historico
      .filter((h: any) => h.estado_llenado === 'RECHAZADO')
      .reduce((acc: number, h: any) => acc + Math.abs(h.peso_real - h.peso_objetivo), 0);

    let estadoActual = 'INACTIVO';
    let loteActivo = 'N/A';

    if (historico.length > 0) {
      const ultimoRegistro = historico[0];
      const diferenciaTiempo = Math.abs(new Date().getTime() - new Date(ultimoRegistro.fecha_hora).getTime());
      loteActivo = ultimoRegistro.id_lote;

      if (diferenciaTiempo < 45000) {
        estadoActual = 'OPERANDO';
      } else {
        estadoActual = 'LOTE_CONCLUIDO';
      }
    }

    setKpis({
      eficienciaOEE: oee,
      totalAceptadas: aceptadas,
      totalRechazadas: rechazadas,
      mermaGramos: Math.round(gramosMerma * 100) / 100,
      estadoMaquina: estadoActual,
      ultimoLoteActivo: loteActivo
    });

    setDatos({
      usuarios: resUser.data || [],
      productos: productos,
      inventario: resInv.data || [],
      ordenes: resOrd.data || [],
      lotes: resLot.data || [],
      historico: historico
    });
    
    setCargando(false);
  };

  useEffect(() => {
    consultarBaseDatos();
    
    const canal = supabase
      .channel('cambios-globales')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        consultarBaseDatos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const despacharNuevoProcesoWokwi = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoProceso(true);
    setMensajeHMI({ texto: '', tipo: '' });

    try {
      await supabase
        .from('ordenes_produccion')
        .update({ estado: 'completado' })
        .eq('estado', 'en_proceso');

      const { data: nuevaOrden, error: errOrden } = await supabase
        .from('ordenes_produccion')
        .insert([{
          id_producto: parseInt(idProductoSeleccionado),
          tamano_lote: parseInt(tamanoLote),
          cantidad_solicitada: parseInt(tamanoLote), 
          estado: 'en_proceso',
          fecha_creacion: new Date().toISOString()
        }])
        .select()
        .single();

      if (errOrden) throw errOrden;

      const productoNombre = datos.productos.find((p: any) => p.id_producto.toString() === idProductoSeleccionado)?.nombre || 'Materia';
      
      await fetch('/api/mqtt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaccion: 'INICIAR_PROCESO_HMI',
          id_orden: nuevaOrden.id_orden,
          producto: productoNombre,
          peso_objetivo: parseInt(pesoPresentacion),
          tamano_lote: parseInt(tamanoLote)
        })
      });

      setMensajeHMI({ 
        texto: `🚀 ¡Proceso enviado con éxito! Orden #${nuevaOrden.id_orden} despachada para ${productoNombre} (${pesoPresentacion}g). Encienda Wokwi para iniciar.`, 
        tipo: 'EXITO' 
      });
      
      consultarBaseDatos();
    } catch (error: any) {
      console.error(error);
      setMensajeHMI({ texto: `❌ Error al despachar orden: ${error.message}`, tipo: 'ERROR' });
    } finally {
      setEnviandoProceso(false);
    }
  };

  const obtenerDatosFiltrados = () => {
    const texto = filtroTexto.toLowerCase();
    
    switch (pestaña) {
      case 'produccion':
        return datos.historico.filter((h: any) => {
          const cumpleTexto = h.id_lote.toLowerCase().includes(texto) || h.estado_llenado.toLowerCase().includes(texto);
          const cumpleEstado = filtroEstado === 'TODOS' || h.estado_llenado === filtroEstado;
          return cumpleTexto && cumpleEstado;
        });
      case 'lotes':
        return datos.lotes.filter((l: any) => l.numero_lote.toLowerCase().includes(texto));
      case 'ordenes':
        return datos.ordenes.filter((o: any) => {
          const cumpleTexto = o.id_orden.toString().includes(texto);
          const cumpleEstado = filtroEstado === 'TODOS' || o.estado === filtroEstado.toLowerCase();
          return cumpleTexto && cumpleEstado;
        });
      case 'inventario':
        return datos.inventario.filter((i: any) => i.nombre_materia.toLowerCase().includes(texto));
      default:
        return datos[pestaña] || [];
    }
  };

  const datosFiltrados = obtenerDatosFiltrados();
  // Limitamos a un historial más compacto para que el gráfico no se sature
  const ultimasBolsas = [...datos.historico].slice(0, 10).reverse();

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white font-sans">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium">Sincronizando paneles SCADA/HMI de Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6 text-gray-100 font-sans">
      <div className="mx-auto max-w-7xl">
        
        {/* ENCABEZADO */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              Planta Industrial — Consola de Control HMI / SCADA
            </h1>
            <p className="text-sm text-gray-400 mt-1">Gestión activa de órdenes de empaque y analítica integrada</p>
          </div>
          <button 
            onClick={consultarBaseDatos}
            className="mt-4 md:mt-0 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold transition flex items-center gap-2"
          >
            🔄 Sincronizar Planta
          </button>
        </header>

        {/* PANEL DE CONTROL DE PROCESOS (HMI) */}
        <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 mb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">🕹️ Panel de Despacho y Control de Procesos (HMI)</h3>
          <p className="text-xs text-gray-400 mb-4">Configura los parámetros de producción y envíalos directamente a la celda de Wokwi sin modificar el código.</p>
          
          <form onSubmit={despacharNuevoProcesoWokwi} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">1. Seleccionar Producto</label>
              <select 
                value={idProductoSeleccionado}
                onChange={(e) => setIdProductoSeleccionado(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-blue-500 transition"
              >
                {datos.productos.map((p: any) => (
                  <option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">2. Peso de Presentación</label>
              <select 
                value={pesoPresentacion}
                onChange={(e) => setPesoPresentacion(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="25">25 gramos (Estándar)</option>
                <option value="50">50 gramos (Familiar)</option>
                <option value="100">100 gramos (Industrial)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">3. Tamaño del Lote</label>
              <input 
                type="number" 
                min="5" 
                max="100"
                value={tamanoLote}
                onChange={(e) => setTamanoLote(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={enviandoProceso}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 rounded-xl font-bold text-sm transition disabled:opacity-50 active:scale-95 shadow-md shadow-blue-600/10"
            >
              {enviandoProceso ? '🚀 Despachando...' : '⚙️ Iniciar Proceso en Planta'}
            </button>
          </form>

          {mensajeHMI.texto && (
            <div className={`mt-4 p-3 rounded-xl border text-xs font-medium ${
              mensajeHMI.tipo === 'EXITO' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {mensajeHMI.texto}
            </div>
          )}
        </section>

        {/* KPIs INDUSTRIALES */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-between shadow-lg">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estado de Celda</span>
            <div className="flex items-center gap-3 my-3">
              <span className={`h-4 w-4 rounded-full ${
                kpis.estadoMaquina === 'OPERANDO' ? 'bg-green-500 animate-pulse ring-4 ring-green-500/20' : 
                kpis.estadoMaquina === 'LOTE_CONCLUIDO' ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-amber-500'
              }`} />
              <h2 className="text-2xl font-extrabold text-white">
                {kpis.estadoMaquina === 'OPERANDO' ? 'OPERANDO' : 
                 kpis.estadoMaquina === 'LOTE_CONCLUIDO' ? 'CONCLUIDO' : 'EN ESPERA'}
              </h2>
            </div>
            <p className="text-xs text-gray-400 truncate">Último Lote: <span className="font-mono text-blue-400">{kpis.ultimoLoteActivo}</span></p>
          </div>

          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-between shadow-lg">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Eficiencia de Calidad (OEE)</span>
            <div className="my-2 flex items-baseline gap-2">
              <h2 className={`text-4xl font-black ${kpis.eficienciaOEE >= 90 ? 'text-green-400' : 'text-amber-400'}`}>
                {kpis.eficienciaOEE}%
              </h2>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full rounded-full ${kpis.eficienciaOEE >= 90 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${kpis.eficienciaOEE}%` }} />
            </div>
          </div>

          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-between shadow-lg">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Balance de Envases</span>
            <div className="my-2 flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold text-green-400">{kpis.totalAceptadas}</p>
                <p className="text-[10px] uppercase font-semibold text-gray-500">Aceptados</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-400">{kpis.totalRechazadas}</p>
                <p className="text-[10px] uppercase font-semibold text-gray-500">Rechazados</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Total: <span className="font-bold text-white">{kpis.totalAceptadas + kpis.totalRechazadas} und</span></p>
          </div>

          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-between shadow-lg">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Registro de Mermas</span>
            <div className="my-2">
              <h2 className="text-3xl font-bold text-red-400">{kpis.mermaGramos} <span className="text-lg font-normal text-gray-400">g</span></h2>
            </div>
            <p className="text-xs text-gray-500">Desviación neta acumulada en celdas</p>
          </div>
        </section>

        {/* =====================================================================
            GRÁFICO SPC EN CUADRO PEQUEÑO (COMPLETAMENTE ARREGLADO Y ARRAIGADO)
           ===================================================================== */}
        {ultimasBolsas.length > 0 && (
          <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 mb-8 shadow-xl max-w-2xl mx-auto">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">📊 Control Estadístico de Peso (SPC)</h3>
                <p className="text-[10px] text-gray-400">Variación de las últimas {ultimasBolsas.length} muestras procesadas</p>
              </div>
              <div className="flex gap-3 text-[10px] font-mono mt-2 sm:mt-0 bg-gray-950 px-2.5 py-1.5 rounded-lg border border-gray-800">
                <span className="text-blue-400">● Real</span>
                <span className="text-green-400">— Obj</span>
                <span className="text-red-400">-- Tol</span>
              </div>
            </div>
            
            {/* Contenedor con overflow-hidden absoluto para evitar fugas visuales */}
            <div className="bg-gray-950/90 rounded-xl p-4 border border-gray-800 h-48 flex flex-col justify-between relative overflow-hidden shadow-inner">
              <svg viewBox="0 0 500 150" className="w-full h-36 overflow-hidden" preserveAspectRatio="none">
                {/* Línea de Tolerancia Superior (+0.8g) */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" />
                {/* Línea Objetivo Central (0.0g de desviación) */}
                <line x1="0" y1="75" x2="500" y2="75" stroke="#10b981" strokeWidth="1.5" />
                {/* Línea de Tolerancia Inferior (-0.8g) */}
                <line x1="0" y1="120" x2="500" y2="120" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" />
                
                {/* Dibujo de Conexiones de Líneas */}
                {ultimasBolsas.map((b: any, index) => {
                  if (index === 0) return null;
                  const x1 = ((index - 1) / (ultimasBolsas.length - 1)) * 460 + 20;
                  const x2 = (index / (ultimasBolsas.length - 1)) * 460 + 20;
                  
                  // Corrección: Cálculo matemático blindado contra campos indefinidos
                  const pesoReal1 = b.peso_real || 25;
                  const pesoObj1 = b.peso_objetivo || 25;
                  const dev1 = pesoReal1 - pesoObj1;

                  const ultReal = ultimasBolsas[index - 1].peso_real || 25;
                  const ultObj = ultimasBolsas[index - 1].peso_objetivo || 25;
                  const devPrev = ultReal - ultObj;

                  // Mapeo proporcional estricto al alto interno del SVG (75 es el centro plano)
                  const y1 = 75 - (devPrev * 45);
                  const y2 = 75 - (dev1 * 45);

                  return <line key={`l-${index}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />;
                })}

                {/* Dibujo de los Nodos Circulares */}
                {ultimasBolsas.map((b: any, index) => {
                  const x = (index / (ultimasBolsas.length - 1)) * 460 + 20;
                  const dev = (b.peso_real || 25) - (b.peso_objetivo || 25);
                  const y = 75 - (dev * 45);
                  const fueraDeRango = Math.abs(dev) > 0.8;

                  return (
                    <g key={`p-${index}`}>
                      <circle cx={x} cy={y} r={fueraDeRango ? "4.5" : "3.5"} fill={fueraDeRango ? "#ef4444" : "#3b82f6"} className="transition-all" />
                    </g>
                  );
                })}
              </svg>
              
              <div className="flex justify-between text-[9px] text-gray-500 font-mono tracking-wider pt-1 border-t border-gray-900">
                <span>⏮️ Historial</span>
                <span>Último envase analizado ➔</span>
              </div>
            </div>
          </section>
        )}

        {/* NAVEGACIÓN ENTRE TABLAS */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-800 pb-3">
          {[
            { id: 'produccion', label: '📦 Histórico de Bolsas', count: datos.historico.length },
            { id: 'lotes', label: '🏁 Lotes Concluidos', count: datos.lotes.length },
            { id: 'ordenes', label: '📋 Órdenes de Producción', count: datos.ordenes.length },
            { id: 'inventario', label: '🌾 Inventario Materia Prima', count: datos.inventario.length },
            { id: 'productos', label: '🏷️ Catálogo Productos', count: datos.productos.length },
            { id: 'usuarios', label: '👥 Usuarios y Operadores', count: datos.usuarios.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setPestaña(tab.id); setFiltroTexto(''); setFiltroEstado('TODOS'); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                pestaña === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
              }`}
            >
              {tab.label} <span className="ml-1 text-xs px-1.5 py-0.5 bg-gray-950 rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* COMPONENTE DE FILTRADO */}
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center shadow-md">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm">🔍</span>
            <input 
              type="text"
              placeholder={`Filtrar en esta tabla...`}
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {(pestaña === 'produccion' || pestaña === 'ordenes') && (
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Estado:</span>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none"
              >
                <option value="TODOS">MOSTRAR TODOS</option>
                {pestaña === 'produccion' ? (
                  <>
                    <option value="ACEPTADO">ACEPTADOS</option>
                    <option value="RECHAZADO">RECHAZADOS</option>
                  </>
                ) : (
                  <>
                    <option value="en_proceso">EN PROCESO</option>
                    <option value="completado">COMPLETADOS</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        {/* CONTENEDOR DE TABLAS GENERALES */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          
          {pestaña === 'produccion' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-300 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="p-4">ID Registro</th>
                    <th className="p-4">Código Lote</th>
                    <th className="p-4">Peso Real</th>
                    <th className="p-4">Peso Objetivo</th>
                    <th className="p-4">Precisión / Error</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Fecha / Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-sm">
                  {datosFiltrados.map((h: any) => {
                    const diff = h.peso_real - h.peso_objetivo;
                    return (
                      <tr key={h.id_registro} className="hover:bg-gray-850/30 transition">
                        <td className="p-4 font-mono text-gray-500">#{h.id_registro}</td>
                        <td className="p-4 font-bold text-blue-400 font-mono">{h.id_lote}</td>
                        <td className="p-4 text-white font-semibold">{h.peso_real}g</td>
                        <td className="p-4 text-gray-400">{h.peso_objetivo}g</td>
                        <td className={`p-4 font-mono text-xs ${Math.abs(diff) <= 0.8 ? 'text-gray-400' : 'text-red-400 font-bold'}`}>
                          {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}g
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            h.estado_llenado === 'ACEPTADO' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>{h.estado_llenado}</span>
                        </td>
                        <td className="p-4 text-gray-400 font-mono text-xs">{new Date(h.fecha_hora).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pestaña === 'lotes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-300 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="p-4">ID</th>
                    <th className="p-4">Número Lote</th>
                    <th className="p-4">ID Orden</th>
                    <th className="p-4">Producción</th>
                    <th className="p-4">Aceptados</th>
                    <th className="p-4">Rechazados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-sm">
                  {datosFiltrados.map((l: any) => (
                    <tr key={l.id_lote} className="hover:bg-gray-850/30 transition">
                      <td className="p-4 font-mono text-gray-500">#{l.id_lote}</td>
                      <td className="p-4 text-white font-bold font-mono">{l.numero_lote}</td>
                      <td className="p-4 text-gray-400 font-mono text-xs">#{l.id_orden || 'N/A'}</td>
                      <td className="p-4 text-gray-300">{l.fecha_produccion}</td>
                      <td className="p-4 text-green-400 font-bold">{l.cantidad_producida} und</td>
                      <td className="p-4 text-red-400 font-semibold">{l.cantidad_rechazada} und</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pestaña === 'ordenes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-300 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="p-4">ID Orden</th>
                    <th className="p-4">Fecha Creación</th>
                    <th className="p-4">ID Producto</th>
                    <th className="p-4">Tamaño Lote</th>
                    <th className="p-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-sm">
                  {datosFiltrados.map((o: any) => (
                    <tr key={o.id_orden} className="hover:bg-gray-850/30 transition">
                      <td className="p-4 font-mono text-blue-400 font-bold">#{o.id_orden}</td>
                      <td className="p-4 text-gray-400 font-mono text-xs">{new Date(o.fecha_creacion).toLocaleString()}</td>
                      <td className="p-4 text-white">ID Producto: {o.id_producto}</td>
                      <td className="p-4 text-gray-300 font-mono">{o.tamano_lote}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                          o.estado === 'completado' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                        }`}>{o.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pestaña === 'inventario' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-300 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="p-4">ID Materia</th>
                    <th className="p-4">Nombre Materia</th>
                    <th className="p-4">Stock Disponible</th>
                    <th className="p-4">Unidad Medida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-sm">
                  {datosFiltrados.map((i: any) => (
                    <tr key={i.id_materia} className="hover:bg-gray-850/30 transition">
                      <td className="p-4 font-mono text-gray-500">#{i.id_materia}</td>
                      <td className="p-4 text-white font-bold">{i.nombre_materia}</td>
                      <td className="p-4 text-blue-400 text-xl font-black">{parseFloat(i.cantidad_disponible).toFixed(3)}</td>
                      <td className="p-4 text-gray-400">{i.unidad_medida}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pestaña === 'productos' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-300 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="p-4">ID</th>
                    <th className="p-4">Nombre Comercial</th>
                    <th className="p-4">Presentación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-sm">
                  {datosFiltrados.map((p: any) => (
                    <tr key={p.id_producto} className="hover:bg-gray-850/30 transition">
                      <td className="p-4 font-mono text-gray-500">#{p.id_producto}</td>
                      <td className="p-4 text-white font-bold">{p.nombre}</td>
                      <td className="p-4 text-blue-400 font-semibold font-mono">{p.peso_presentacion}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pestaña === 'usuarios' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-300 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="p-4">ID Operador</th>
                    <th className="p-4">Nombre</th>
                    <th className="p-4">Correo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-sm">
                  {datosFiltrados.map((u: any) => (
                    <tr key={u.id_usuario} className="hover:bg-gray-850/30 transition">
                      <td className="p-4 font-mono text-gray-500">#{u.id_usuario}</td>
                      <td className="p-4 text-white font-bold">{u.nombre}</td>
                      <td className="p-4 text-gray-300 font-mono text-xs">{u.correo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}