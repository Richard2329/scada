"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Parámetros de conexión verificados
const SUPABASE_URL = "https://gkfubkquycyasxxuhdi.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_20F0ush-qkP8A4fUCbVaVA_8wQmFfA=="; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function DashboardCompletoPage() {
  // --- CONTROL DE ACCESO ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- DATOS INDUSTRIALES ---
  const [datos, setDatos] = useState<any>({
    usuarios: [],
    productos: [],
    inventario: [],
    ordenes: [],
  });
  const [loading, setLoading] = useState(false);

  // --- CONTROLES DEL PROCESO DE LLENADO (HMI) ---
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [presentacionSeleccionada, setPresentacionSeleccionada] = useState("250ml");
  const [procesoEstado, setProcesoEstado] = useState<"IDLE" | "PROCESANDO" | "COMPLETADO">("IDLE");
  const [progresoLlenado, setProgresoLlenado] = useState(0);

  // --- FILTROS DE BÚSQUEDA ---
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [filtroInventario, setFiltroInventario] = useState("");
  const [filtroOrdenes, setFiltroOrdenes] = useState("");

  // --- MANEJADOR LOGIN ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (username.trim() === "admin" && password === "1234") {
      setIsAuthenticated(true);
    } else {
      setLoginError("Credenciales incorrectas de operador");
    }
  };

  // --- SIMULACIÓN DEL PROCESO DE LLENADO ---
  const iniciarProcesoLlenado = () => {
    if (!productoSeleccionado) {
      alert("Por favor, seleccione un producto en la consola HMI.");
      return;
    }
    
    setProcesoEstado("PROCESANDO");
    setProgresoLlenado(0);

    // Animación del progreso de llenado en la planta
    const intervalo = setInterval(() => {
      setProgresoLlenado((prev) => {
        if (prev >= 100) {
          clearInterval(intervalo);
          setProcesoEstado("COMPLETADO");
          // Regresa al estado de espera tras 3 segundos de éxito
          setTimeout(() => setProcesoEstado("IDLE"), 3000);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  // --- CONSULTA OPTIMIZADA A SUPABASE ---
  useEffect(() => {
    if (!isAuthenticated) return;

    async function cargarPlanta() {
      try {
        setLoading(true);
        const [resUser, resProd, resInv, resOrd] = await Promise.all([
          supabase.from("usuarios").select("*"),
          supabase.from("productos").select("*"),
          supabase.from("inventario").select("*"),
          supabase.from("ordenes").select("*"),
        ]);

        const productosData = resProd.data || [];
        setDatos({
          usuarios: resUser.data || [],
          productos: productosData,
          inventario: resInv.data || [],
          ordenes: resOrd.data || [],
        });

        // Preselecciona el primer producto si existe
        if (productosData.length > 0) {
          setProductoSeleccionado(productosData[0].id || productosData[0].id_producto);
        }
      } catch (error) {
        console.error("Error de enlace SCADA:", error);
      } finally {
        setLoading(false);
      }
    }

    cargarPlanta();
    
    const intervalo = setInterval(cargarPlanta, 30000);
    return () => clearInterval(intervalo);
  }, [isAuthenticated]);

  // --- FILTRADO DE ARREGLOS ---
  const usuariosFiltrados = datos.usuarios.filter((u: any) =>
    (u.nombre || u.username || "").toLowerCase().includes(filtroUsuarios.toLowerCase()) ||
    String(u.id).includes(filtroUsuarios)
  );

  const inventarioFiltrado = datos.inventario.filter((inv: any) =>
    String(inv.producto_id || inv.id).toLowerCase().includes(filtroInventario.toLowerCase())
  );

  const ordenesFiltradas = datos.ordenes.filter((o: any) =>
    String(o.id_orden || o.id || "").toLowerCase().includes(filtroOrdenes.toLowerCase()) ||
    (o.estado || "").toLowerCase().includes(filtroOrdenes.toLowerCase())
  );

  // --- PANTALLA 1: INICIO DE SESIÓN SEGURO ---
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 px-4 font-sans">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl bg-gray-900 p-8 shadow-2xl border border-gray-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500" />
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">🔐 Terminal HMI / SCADA</h2>
            <p className="text-xs text-gray-400 mt-1.5">Ingrese credenciales de operador de planta</p>
          </div>

          {loginError && (
            <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400 border border-red-500/20 text-center">
              ⚠️ {loginError}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Usuario ID</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-gray-950 p-3 text-sm text-white border border-gray-800 focus:outline-none focus:border-green-500 transition-all font-mono"
              placeholder="admin"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Código de Seguridad</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-gray-950 p-3 text-sm text-white border border-gray-800 focus:outline-none focus:border-green-500 transition-all font-mono"
              placeholder="••••"
              required
            />
          </div>

          <button type="submit" className="w-full rounded-xl bg-green-500 py-3 text-xs uppercase font-black text-gray-950 hover:bg-green-400 transition-all shadow-lg shadow-green-500/10 tracking-widest">
            Autenticar Terminal
          </button>
        </form>
      </div>
    );
  }

  // --- PANTALLA 2: SINCRO INDUSTRIAL ---
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs uppercase font-bold tracking-widest text-green-400 animate-pulse">Estableciendo Enlace Teleinformático...</p>
        </div>
      </div>
    );
  }

  // --- PANTALLA 3: INTERFAZ SCADA COMPLETA ---
  return (
    <div className="min-h-screen bg-gray-950 p-6 text-gray-100 font-sans">
      <div className="mx-auto max-w-7xl">
        
        {/* CABECERA INDUSTRIAL */}
        <header className="mb-8 border-b border-gray-800 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">Consola de Supervisión SCADA</h1>
            </div>
            <p className="text-xs text-gray-400 mt-1">Celda de Manufactura y Llenado Automatizado</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-gray-900 border border-gray-800 px-3 py-2 rounded-xl font-mono text-gray-400">
              ID: <span className="text-green-400 font-bold">gkfubkquycyasxxuhdi</span>
            </span>
            <button 
              onClick={() => setIsAuthenticated(false)} 
              className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 rounded-xl text-xs font-bold text-red-400 transition-all"
            >
              🔒 Desconectar
            </button>
          </div>
        </header>

        {/* INDICADORES KPI AVANZADOS */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operadores Registrados</span>
            <p className="mt-2 text-3xl font-black text-white">{datos.usuarios.length}</p>
            <div className="mt-2 h-1 w-full bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(datos.usuarios.length * 10, 100)}%` }}></div>
            </div>
          </div>

          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Catálogo Productos</span>
            <p className="mt-2 text-3xl font-black text-blue-400">{datos.productos.length}</p>
            <p className="text-[10px] text-gray-500 mt-2 font-mono">Líneas de empaque válidas</p>
          </div>

          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado de Inventario</span>
            <p className="mt-2 text-3xl font-black text-yellow-400">{datos.inventario.length} <span className="text-xs text-gray-500">Nodos</span></p>
            <p className="text-[10px] text-gray-500 mt-2 font-mono">Monitoreo de silos activos</p>
          </div>

          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Órdenes Procesadas</span>
            <p className="mt-2 text-3xl font-black text-purple-400">{datos.ordenes.length}</p>
            <p className="text-[10px] text-gray-500 mt-2 font-mono">Historial HMI hacia Wokwi</p>
          </div>
        </section>

        {/* NOUVEAU: MÓDULO HMI - PANEL DE CONTROL DE LLENADO INTERACTIVO */}
        <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 mb-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-gray-800 pb-4 md:pb-0 md:pr-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">🎛️ Consola de Mando HMI</h3>
            <p className="text-[10px] text-gray-400 mb-4">Parámetros de dosificación de la válvula solenoide.</p>
            
            {/* Selección de Producto */}
            <div className="mb-4">
              <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">1. Seleccionar Producto</label>
              <select 
                value={productoSeleccionado}
                onChange={(e) => setProductoSeleccionado(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500 font-mono"
              >
                {datos.productos.map((prod: any, idx: number) => (
                  <option key={idx} value={prod.id || prod.id_producto}>
                    {prod.nombre || `Producto ID: ${prod.id || prod.id_producto}`}
                  </option>
                ))}
                {datos.productos.length === 0 && <option value="">No hay productos cargados</option>}
              </select>
            </div>

            {/* Selección de Presentación */}
            <div className="mb-5">
              <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">2. Presentación (Volumen)</label>
              <div className="grid grid-cols-3 gap-2">
                {["250ml", "500ml", "1000ml"].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPresentacionSeleccionada(size)}
                    className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                      presentacionSeleccionada === size 
                        ? "bg-blue-500/10 text-blue-400 border-blue-500" 
                        : "bg-gray-950 text-gray-400 border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Disparador del Actuador */}
            <button
              type="button"
              onClick={iniciarProcesoLlenado}
              disabled={procesoEstado === "PROCESANDO"}
              className={`w-full py-2.5 rounded-xl text-xs uppercase font-black tracking-wider transition-all shadow-md ${
                procesoEstado === "PROCESANDO"
                  ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed animate-pulse"
                  : "bg-gradient-to-r from-green-500 to-emerald-600 text-gray-950 hover:from-green-400 hover:to-emerald-500 active:scale-[0.99]"
              }`}
            >
              {procesoEstado === "PROCESANDO" ? "⚡ Envasando..." : "▶️ Iniciar Llenado"}
            </button>
          </div>

          {/* SIMULACIÓN GRÁFICA DEL SILO / ENVASE */}
          <div className="md:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">🧪 Monitorización del Actuador de Celda</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Estado del tanque mezclador y nivel de la boquilla en tiempo real.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 items-center">
              {/* Tanque Visual SVG */}
              <div className="flex justify-center">
                <div className="w-24 h-32 bg-gray-950 border-2 border-gray-800 rounded-b-2xl relative overflow-hidden flex flex-col justify-end">
                  <div 
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-300 relative"
                    style={{ height: `${progresoLlenado}%` }}
                  >
                    {procesoEstado === "PROCESANDO" && (
                      <span className="absolute top-1 left-0 right-0 text-[9px] font-mono font-bold text-white text-center animate-bounce">
                        🌊 {progresoLlenado}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Texto de Estado Dinámico */}
              <div className="space-y-2">
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">Estado de Celda</span>
                  <span className={`text-xs font-mono font-black ${
                    procesoEstado === "PROCESANDO" ? "text-amber-400 animate-pulse" : procesoEstado === "COMPLETADO" ? "text-green-400" : "text-gray-400"
                  }`}>
                    ● {procesoEstado === "PROCESANDO" ? "INYECTANDO MATERIA PRIMA" : procesoEstado === "COMPLETADO" ? "LOTE DISPENSADO EXITOSAMENTE" : "STANDBY - ESPERANDO ORDEN"}
                  </span>
                </div>

                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">Configuración del Lote</span>
                  <p className="text-xs font-mono text-gray-300">
                    Prod. ID: <span className="text-blue-400 font-bold">{productoSeleccionado || "N/A"}</span> <br />
                    Vol: <span className="text-yellow-400 font-bold">{presentacionSeleccionada}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Barra de progreso lineal estándar industrial */}
            <div className="w-full bg-gray-950 rounded-full h-2.5 border border-gray-800 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-400 h-full transition-all duration-300"
                style={{ width: `${progresoLlenado}%` }}
              />
            </div>
          </div>
        </section>

        {/* GRÁFICO INDUSTRIAL (SPC - ANÁLISIS DE LLENADO SIMULADO) */}
        <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 mb-8 shadow-xl">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">📊 Gráfico de Desviación Estándar de Llenado</h3>
              <p className="text-[10px] text-gray-400">Control Estadístico de Procesos en Tiempo Real (Muestras de Silos)</p>
            </div>
            <div className="flex gap-3 text-[9px] font-mono bg-gray-950 px-2.5 py-1.5 rounded-lg border border-gray-800">
              <span className="text-blue-400">● Muestra Real</span>
              <span className="text-green-400">— Línea Base Target</span>
              <span className="text-red-400">-- Límite Crítico</span>
            </div>
          </div>
          
          <div className="bg-gray-950 rounded-xl p-4 border border-gray-800 h-36 flex flex-col justify-between relative overflow-hidden">
            <svg viewBox="0 0 500 100" className="w-full h-full" preserveAspectRatio="none">
              <line x1="0" y1="15" x2="500" y2="15" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" />
              <line x1="0" y1="50" x2="500" y2="50" stroke="#10b981" strokeWidth="1.5" />
              <line x1="0" y1="85" x2="500" y2="85" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" />
              <path 
                d="M 20 60 Q 120 20, 220 70 T 420 40 T 480 55" 
                fill="none" 
                stroke="#3b82f6" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
              />
              <circle cx="20" cy="60" r="4" fill="#3b82f6" />
              <circle cx="120" cy="35" r="4" fill="#3b82f6" />
              <circle cx="220" cy="70" r="4" fill="#3b82f6" />
              <circle cx="320" cy="45" r="4" fill="#3b82f6" />
              <circle cx="420" cy="40" r="4" fill="#3b82f6" />
              <circle cx="480" cy="55" r="4" fill="#3b82f6" />
            </svg>
            <div className="flex justify-between text-[9px] text-gray-500 font-mono pt-1 border-t border-gray-900">
              <span>⏮️ Historial de Lotes</span>
              <span>Lote en Ejecución Activa ➔</span>
            </div>
          </div>
        </section>

        {/* SECCIÓN INTERACTIVA: TABLAS Y FILTROS */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          {/* TABLA 1: REGISTRO DE USUARIOS */}
          <div className="rounded-2xl bg-gray-900 p-6 shadow-xl border border-gray-800 flex flex-col">
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">👥 Operadores Autorizados</h3>
              <input 
                type="text" 
                placeholder="🔍 Filtrar operadores..."
                value={filtroUsuarios}
                onChange={(e) => setFiltroUsuarios(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-green-500 w-full sm:w-48 font-mono"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-xs text-gray-400">
                <thead className="bg-gray-800/50 text-gray-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ID Nodo</th>
                    <th className="px-4 py-3 font-semibold">Nombre Operador / Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {usuariosFiltrados.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-600 font-mono">No se encontraron registros de operador</td></tr>
                  ) : (
                    usuariosFiltrados.map((u: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-850/20 transition-all">
                        <td className="px-4 py-3 font-mono font-bold text-green-400">#{u.id}</td>
                        <td className="px-4 py-3 text-white font-medium">{u.nombre || u.username || "Operador Base"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLA 2: ESTADO DEL INVENTARIO */}
          <div className="rounded-2xl bg-gray-900 p-6 shadow-xl border border-gray-800 flex flex-col">
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">📦 Capacidad de Materia Prima</h3>
              <input 
                type="text" 
                placeholder="🔍 Filtrar Silo (ID)..."
                value={filtroInventario}
                onChange={(e) => setFiltroInventario(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-green-500 w-full sm:w-48 font-mono"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-xs text-gray-400">
                <thead className="bg-gray-800/50 text-gray-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Producto ID</th>
                    <th className="px-4 py-3 font-semibold">Nivel Crítico / Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {inventarioFiltrado.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-600 font-mono">Sin alertas en nodos de inventario</td></tr>
                  ) : (
                    inventarioFiltrado.map((inv: any, i: number) => {
                      const stockReal = inv.cantidad ?? inv.stock ?? 0;
                      const esCritico = stockReal < 5;
                      return (
                        <tr key={i} className="hover:bg-gray-850/20 transition-all">
                          <td className="px-4 py-3 text-white font-mono font-bold">📦 ID: {inv.producto_id || inv.id}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block font-mono font-extrabold px-2 py-1 rounded ${
                              esCritico ? "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse" : "bg-yellow-500/5 text-yellow-400"
                            }`}>
                              {stockReal} unidades {esCritico && "⚠️ CRÍTICO"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLA 3: HISTORIAL COMPLETO DE ÓRDENES HMI */}
          <div className="rounded-2xl bg-gray-900 p-6 shadow-xl border border-gray-800 lg:col-span-2 flex flex-col mt-2">
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">📋 Consola de Órdenes (Enlace Wokwi)</h3>
                <p className="text-[10px] text-gray-500 font-mono">Cola de mensajería para actuadores y servomotores</p>
              </div>
              <input 
                type="text" 
                placeholder="🔍 Filtrar Estado u Orden..."
                value={filtroOrdenes}
                onChange={(e) => setFiltroOrdenes(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-green-500 w-full sm:w-64 font-mono"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-xs text-gray-400">
                <thead className="bg-gray-800/50 text-gray-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ID Transacción</th>
                    <th className="px-4 py-3 font-semibold">Producto Asociado</th>
                    <th className="px-4 py-3 font-semibold">Volumen / Lote</th>
                    <th className="px-4 py-3 font-semibold">Estado de Celda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {ordenesFiltradas.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-600 font-mono">No se registran órdenes despachadas desde el HMI</td></tr>
                  ) : (
                    ordenesFiltradas.map((o: any, i: number) => {
                      const status = (o.estado || "completado").toLowerCase();
                      return (
                        <tr key={i} className="hover:bg-gray-850/20 transition-all">
                          <td className="px-4 py-3 font-mono font-bold text-purple-400">#ORD-{o.id_orden || o.id}</td>
                          <td className="px-4 py-3 font-medium text-gray-200">Línea de Envasado ID: {o.id_producto || "1"}</td>
                          <td className="px-4 py-3 font-mono text-gray-300">{o.tamano_lote || o.cantidad || 10} unds</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              status === "completado" || status === "success"
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                            }`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
