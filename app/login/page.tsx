"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// ⚠️ CONFIGURACIÓN DE CRITERIO REAL DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://gkfubkquycyasxxuhdi.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZGZ1YmtxdXljeWFzeHh1aGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NDI1ODQsImV4cCI6MjA5ODIxODU4NH0.jFpHlW2r1eJxsRO9HvUJhDgA5c69LDROJS5fcL9xHGg"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface PlantaDatos {
  usuarios: any[];
  productos: any[];
  inventario: any[];
  ordenes: any[];
}

export default function DashboardCompletoPage() {
  // --- CONTROL DE ACCESO (AHORA CON SUPABASE) ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [operadorActivo, setOperadorActivo] = useState("");

  // --- DATOS INDUSTRIALES ---
  const [datos, setDatos] = useState<PlantaDatos>({
    usuarios: [],
    productos: [],
    inventario: [],
    ordenes: [],
  });
  
  const [loading, setLoading] = useState(false);
  const [msgEnlace, setMsgEnlace] = useState("Modo Local (Modifica la API Key para conectar al SCADA)");

  // --- CONTROLES DE PROCESO (HMI) ---
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [presentacionSeleccionada, setPresentacionSeleccionada] = useState("250ml");
  const [procesoEstado, setProcesoEstado] = useState<"IDLE" | "PROCESANDO" | "COMPLETADO">("IDLE");
  const [progresoLlenado, setProgresoLlenado] = useState(0);

  // --- FILTROS ---
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [filtroInventario, setFiltroInventario] = useState("");

  // =========================================================
  // 🔐 MANEJADOR LOGIN: CONSULTA DE VALIDACIÓN REAL EN SUPABASE
  // =========================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      // Intenta buscar en la tabla 'usuarios' donde el campo username (o nombre) y password coincidan
      // Nota: Ajusta los nombres de las columnas ('username', 'password') si en tu tabla se llaman diferente (ej. 'nombre', 'clave')
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .or(`username.eq.${username},nombre.eq.${username}`)
        .eq("password", password)
        .single();

      if (error || !data) {
        throw new Error("Credenciales no encontradas en la base de datos");
      }

      // Si encuentra el registro, guarda el nombre del operador y autoriza el acceso
      setOperadorActivo(data.nombre || data.username || username);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error("Error de autenticación:", err);
      
      // Contingencia de desarrollo por si la clave aún no está configurada:
      if (username.trim() === "admin" && password === "1234") {
        setOperadorActivo("Administrador Local (Contingencia)");
        setIsAuthenticated(true);
      } else {
        setLoginError("⚠️ Acceso Denegado: Usuario o contraseña no válidos en Supabase.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // --- CONTROL DE PROCESO SIMULADO ---
  const iniciarProcesoLlenado = async () => {
    if (!productoSeleccionado) {
      alert("Por favor, seleccione un producto válido.");
      return;
    }
    
    setProcesoEstado("PROCESANDO");
    setProgresoLlenado(0);

    const intervalo = setInterval(() => {
      setProgresoLlenado((prev) => {
        if (prev >= 100) {
          clearInterval(intervalo);
          setProcesoEstado("COMPLETADO");
          setTimeout(() => setProcesoEstado("IDLE"), 2500);
          return 100;
        }
        return prev + 20;
      });
    }, 150);

    try {
      await supabase.from("ordenes").insert([
        {
          id_producto: productoSeleccionado,
          tamano_lote: presentacionSeleccionada === "250ml" ? 250 : presentacionSeleccionada === "500ml" ? 500 : 1000,
          estado: "PROCESANDO"
        }
      ]);
    } catch (err) {
      console.log("Error al registrar orden:", err);
    }
  };

  // --- CONSULTA GENERAL DE DATOS (SCADA) ---
  const cargarDatosPlantaReal = async () => {
    try {
      setLoading(true);
      
      const [resUser, resProd, resInv, resOrd] = await Promise.all([
        supabase.from("usuarios").select("*").limit(20),
        supabase.from("productos").select("*").limit(20),
        supabase.from("inventario").select("*").limit(20),
        supabase.from("ordenes").select("*").order("id", { ascending: false }).limit(20),
      ]);

      setDatos({
        usuarios: resUser.data || [],
        productos: resProd.data || [],
        inventario: resInv.data || [],
        ordenes: resOrd.data || [],
      });
      
      if (resProd.data && resProd.data.length > 0) {
        setProductoSeleccionado(resProd.data[0].id || resProd.data[0].id_producto);
      }
      
      setMsgEnlace("🌐 CONEXIÓN TOTAL SCADA + APIS DE SUPABASE OPERATIVAS");
    } catch (error) {
      console.error("Fallo general de red:", error);
      setMsgEnlace("⚠️ REVISAR CONEXIÓN: Mostrando datos de respaldo locales");
      
      setDatos({
        usuarios: [{ id: 1, nombre: "Richard Baidal" }],
        productos: [{ id: "1", nombre: "Línea de Envasado Alfa" }, { id: "2", nombre: "Línea de Envasado Beta" }],
        inventario: [{ id: 1, producto_id: "Silo Principal", cantidad: 15 }],
        ordenes: [{ id: "101", id_producto: "1", tamano_lote: 250, estado: "completado" }],
      });
      setProductoSeleccionado("1");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      cargarDatosPlantaReal();
    }
  }, [isAuthenticated]);

  const usuariosFiltrados = datos.usuarios.filter((u: any) =>
    (u.nombre || u.username || "").toLowerCase().includes(filtroUsuarios.toLowerCase())
  );

  const inventarioFiltrado = datos.inventario.filter((inv: any) =>
    String(inv.producto_id || inv.id || "").toLowerCase().includes(filtroInventario.toLowerCase())
  );

  // PANTALLA 1: FORMULARIO HMI DE LOGUEO HACIENDA CONSULTAS A SUPABASE
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 px-4 font-sans">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl bg-gray-900 p-8 border border-gray-800 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-green-500" />
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white tracking-tight">🔐 Terminal HMI / SCADA</h2>
            <p className="text-xs text-gray-400 mt-1">Autenticación remota desde base de datos relacional</p>
          </div>

          {loginError && <div className="mb-4 bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20 text-center rounded-xl font-medium">{loginError}</div>}

          <div className="mb-4">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Usuario (ID o Nombre de Supabase)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-gray-950 p-3 text-sm text-white border border-gray-800 rounded-xl focus:border-green-500 focus:outline-none font-mono" placeholder="Ej: richard92" required />
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Contraseña de Planta</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-950 p-3 text-sm text-white border border-gray-800 rounded-xl focus:border-green-500 focus:outline-none font-mono" placeholder="••••••••" required />
          </div>

          <button type="submit" disabled={loginLoading} className="w-full bg-blue-600 py-3 text-xs font-black text-white tracking-widest uppercase rounded-xl hover:bg-blue-500 transition-all disabled:bg-gray-800 disabled:text-gray-500">
            {loginLoading ? "Consultando Servidores..." : "Validar Operador"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6 text-gray-100 font-sans">
      <div className="mx-auto max-w-7xl">
        
        {/* ENCABEZADO SCADA */}
        <header className="mb-8 border-b border-gray-800 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white">Consola de Supervisión SCADA</h1>
            <p className={`text-xs mt-1 font-mono font-bold ${msgEnlace.includes("OPERATIVAS") ? "text-green-400" : "text-amber-400"}`}>{msgEnlace}</p>
            <p className="text-[11px] text-gray-400 mt-1">Operador actual activo: <span className="text-blue-400 font-mono font-bold">{operadorActivo}</span></p>
          </div>
          <div className="flex gap-2">
            <button onClick={cargarDatosPlantaReal} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-all">🔄 Sincronizar Planta</button>
            <button onClick={() => setIsAuthenticated(false)} className="px-4 py-2 bg-red-950/40 border border-red-900/40 rounded-xl text-xs font-bold text-red-400">🔒 Salir</button>
          </div>
        </header>

        {/* INTERFAZ HMI */}
        <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 mb-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 md:border-r border-gray-800 md:pr-6">
            <h3 className="text-sm font-bold text-white uppercase mb-3">🎛️ Mando de Dosificación</h3>
            
            <div className="mb-4">
              <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">1. Seleccionar Línea de Producto</label>
              <select value={productoSeleccionado} onChange={(e) => setProductoSeleccionado(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none">
                {datos.productos.map((prod: any, idx: number) => (
                  <option key={idx} value={prod.id || prod.id_producto}>{prod.nombre || `Producto #${prod.id}`}</option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">2. Presentación</label>
              <div className="grid grid-cols-3 gap-2">
                {["250ml", "500ml", "1000ml"].map((size) => (
                  <button key={size} type="button" onClick={() => setPresentacionSeleccionada(size)} className={`py-1.5 rounded-xl text-xs font-mono font-bold border ${presentacionSeleccionada === size ? "bg-blue-500/10 text-blue-400 border-blue-500" : "bg-gray-950 text-gray-400 border-gray-800"}`}>{size}</button>
                ))}
              </div>
            </div>

            <button type="button" onClick={iniciarProcesoLlenado} disabled={procesoEstado === "PROCESANDO" || loading} className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider ${procesoEstado === "PROCESANDO" ? "bg-gray-800 text-gray-500 cursor-not-allowed animate-pulse" : "bg-green-500 text-gray-950 hover:bg-green-400"}`}>
              {procesoEstado === "PROCESANDO" ? "⚡ Envasando..." : "▶️ Iniciar Proceso"}
            </button>
          </div>

          <div className="md:col-span-2 flex flex-col justify-between">
            <h3 className="text-sm font-bold text-white uppercase">🧪 Monitor del Actuador Automático</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 items-center">
              <div className="flex justify-center">
                <div className="w-24 h-28 bg-gray-950 border-2 border-gray-800 rounded-b-xl relative overflow-hidden flex flex-col justify-end">
                  <div className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 transition-all duration-150" style={{ height: `${progresoLlenado}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">Estado de Válvula</span>
                  <span className={`text-xs font-mono font-bold ${procesoEstado === "PROCESANDO" ? "text-amber-400 animate-pulse" : procesoEstado === "COMPLETADO" ? "text-green-400" : "text-gray-500"}`}>
                    {procesoEstado === "PROCESANDO" ? `● ABIERTA (${progresoLlenado}%)` : procesoEstado === "COMPLETADO" ? "✔ EMBALAJE LISTO" : "● CERRADA (ESPERA)"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TABLAS */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-gray-900 p-6 border border-gray-800">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase">👥 Operadores en Base de Datos</h3>
              <input type="text" placeholder="Filtrar..." value={filtroUsuarios} onChange={(e) => setFiltroUsuarios(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1 text-xs text-white font-mono w-36" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-800 text-xs">
              <table className="w-full text-left text-gray-400">
                <tbody>
                  {usuariosFiltrados.map((u: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800/40"><td className="px-4 py-2 font-mono text-green-400">#{u.id}</td><td className="px-4 py-2 text-white">{u.nombre || u.username}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900 p-6 border border-gray-800">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase">📦 Inventario</h3>
              <input type="text" placeholder="Filtrar..." value={filtroInventario} onChange={(e) => setFiltroInventario(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1 text-xs text-white font-mono w-36" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-800 text-xs">
              <table className="w-full text-left text-gray-400">
                <tbody>
                  {inventarioFiltrado.map((inv: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800/40"><td className="px-4 py-2 text-white font-mono">📦 {inv.producto_id}</td><td className="px-4 py-2 text-yellow-400 font-mono">{inv.cantidad} unds</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
