"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// 🌐 CONFIGURACIÓN DE ENLACE DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://gkfubkquycyasxxuhdi.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc2MiOiJzdXBhYmFzZSIsInJ1bGUiOiJhbm9uIiwi..."; // Usa tu clave real

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🔐 CONTRASEÑA MAESTRA INDUSTRIAL DE ACCESO
// Puedes cambiar esta clave por la que tú desees para proteger tu planta
const CLAVE_MAESTRA_PLANTA = "Richard1992$";

interface PlantaDatos {
  usuarios: any[];
  productos: any[];
  inventario_materias: any[];
  ordenes_produccion: any[];
}

export default function DashboardCompletoPage() {
  // --- CONTROL DE ACCESO ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(""); 
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  // --- DATOS DEL OPERADOR LOGUEADO ---
  const [idOperador, setIdOperador] = useState<number | null>(null);
  const [operadorActivo, setOperadorActivo] = useState("");
  const [rolOperador, setRolOperador] = useState("");

  // --- DATOS INDUSTRIALES REALES ---
  const [datos, setDatos] = useState<PlantaDatos>({
    usuarios: [],
    productos: [],
    inventario_materias: [],
    ordenes_produccion: [],
  });
  
  const [loading, setLoading] = useState(false);
  const [msgEnlace, setMsgEnlace] = useState("Estableciendo enlace teleinformático...");

  // --- CONTROLES DE PROCESO (HMI) ---
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [presentacionSeleccionada, setPresentacionSeleccionada] = useState("250");
  const [procesoEstado, setProcesoEstado] = useState<"IDLE" | "PROCESANDO" | "COMPLETADO">("IDLE");
  const [progresoLlenado, setProgresoLlenado] = useState(0);

  // --- FILTROS ---
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [filtroInventario, setFiltroInventario] = useState("");

  // =========================================================
  // 🔐 DOBLE VALIDACIÓN EXIGENTE: CORREO (BD) + CLAVE SEGURA
  // =========================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      // 1. Verificación Estricta de la Clave
      if (password !== CLAVE_MAESTRA_PLANTA) {
        throw new Error("Código de seguridad incorrecto. Acceso al sistema denegado.");
      }

      // 2. Verificación de Identidad del Operador en Supabase
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .or(`correo.eq."${username.trim()}",nombre.eq."${username.trim()}"`)
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("El operador no figura en los registros de la base de datos.");
      }

      const usuarioReal = data[0];

      // Credenciales Correctas -> Conceder Acceso
      setIdOperador(usuarioReal.id_usuario);
      setOperadorActivo(usuarioReal.nombre || "Operador Principal");
      setRolOperador(usuarioReal.rol || "operador");
      
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error("Error de autenticación:", err);
      setLoginError(`⚠️ CATASTRÓFICO: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  // =========================================================
  // 🧪 INICIAR PROCESO DE LLENADO (REGISTRO EN ORDENES_PRODUCCION)
  // =========================================================
  const iniciarProcesoLlenado = async () => {
    if (!productoSeleccionado) {
      alert("Por favor, seleccione una línea de producto.");
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
      await supabase.from("ordenes_produccion").insert([
        {
          id_producto: parseInt(productoSeleccionado),
          tamano_lote: parseInt(presentacionSeleccionada),
          estado: "PROCESANDO",
          id_operador: idOperador
        }
      ]);
      
      setTimeout(() => cargarDatosPlantaReal(), 2000);
    } catch (err) {
      console.error("Error al registrar orden:", err);
    }
  };

  // 🔄 CARGA GENERAL DE TODAS LAS TABLAS
  const cargarDatosPlantaReal = async () => {
    try {
      setLoading(true);
      
      const [resUser, resProd, resInv, resOrd] = await Promise.all([
        supabase.from("usuarios").select("*").limit(20),
        supabase.from("productos").select("*").limit(20),
        supabase.from("inventario_materias").select("*").limit(20),
        supabase.from("ordenes_produccion").select("*").limit(20),
      ]);

      setDatos({
        usuarios: resUser.data || [],
        productos: resProd.data || [],
        inventario_materias: resInv.data || [],
        ordenes_produccion: resOrd.data || [],
      });
      
      if (resProd.data && resProd.data.length > 0) {
        setProductoSeleccionado(String(resProd.data[0].id_producto));
      }
      
      setMsgEnlace("🌐 ENLACE TELEINFORMÁTICO CRIPTOGRÁFICO ESTABLECIDO");
    } catch (error) {
      console.error("Fallo general de red SCADA:", error);
      setMsgEnlace("⚠️ ERROR DE CONEXIÓN CON EL SERVIDOR EXTERNO");
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
    (u.nombre || "").toLowerCase().includes(filtroUsuarios.toLowerCase())
  );

  const inventarioFiltrado = datos.inventario_materias.filter((inv: any) =>
    (inv.nombre_materia || "").toLowerCase().includes(filtroInventario.toLowerCase())
  );

  // VISTA 1: INGRESO DE SEGURIDAD HMI
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 px-4 font-sans">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl bg-gray-900 p-8 border border-gray-800 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white tracking-tight">🔐 Terminal HMI / SCADA</h2>
            <p className="text-xs text-gray-400 mt-1">Control de acceso perimetral restringido</p>
          </div>

          {loginError && (
            <div className="mb-4 bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20 text-center rounded-xl font-medium font-mono">
              {loginError}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">OPERADOR ID (Correo Electrónico)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-gray-950 p-3 text-sm text-white border border-gray-800 rounded-xl focus:border-green-500 focus:outline-none font-mono" placeholder="ejemplo@correo.com" required />
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">CÓDIGO DE SEGURIDAD DE LA PLANTA</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-950 p-3 text-sm text-white border border-gray-800 rounded-xl focus:border-green-500 focus:outline-none font-mono tracking-widest" placeholder="••••••••" required />
          </div>

          <button type="submit" disabled={loginLoading} className="w-full bg-green-500 py-3 text-xs font-black text-gray-950 tracking-widest uppercase rounded-xl hover:bg-green-400 transition-all font-sans">
            {loginLoading ? "VERIFICANDO PERMISOS..." : "DESBLOQUEAR TERMINAL"}
          </button>
        </form>
      </div>
    );
  }

  // VISTA 2: PANEL SCADA GENERAL COMPLETO
  return (
    <div className="min-h-screen bg-gray-950 p-6 text-gray-100 font-sans">
      <div className="mx-auto max-w-7xl">
        
        {/* ENCABEZADO */}
        <header className="mb-8 border-b border-gray-800 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white">📊 Panel de Control SCADA</h1>
            <p className={`text-xs mt-1 font-mono font-bold ${msgEnlace.includes("ESTABLECIDO") ? "text-green-400" : "text-amber-400"}`}>{msgEnlace}</p>
            <p className="text-xs text-gray-400 mt-0.5">Operador Activo: <span className="text-blue-400 font-bold">{operadorActivo} ({rolOperador})</span></p>
          </div>
          <div className="flex gap-2">
            <button onClick={cargarDatosPlantaReal} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-all">🔄 Sincronizar Planta</button>
            <button onClick={() => setIsAuthenticated(false)} className="px-4 py-2 bg-red-950/40 border border-red-900/40 rounded-xl text-xs font-bold text-red-400">🔒 Bloquear Consola</button>
          </div>
        </header>

        {/* CONTADORES */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-8">
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Total Usuarios</span>
            <div className="text-2xl font-black text-white mt-1">{datos.usuarios.length}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Productos Activos</span>
            <div className="text-2xl font-black text-blue-400 mt-1">{datos.productos.length}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Materias en Inventario</span>
            <div className="text-2xl font-black text-yellow-400 mt-1">{datos.inventario_materias.length}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Órdenes Ejecutadas</span>
            <div className="text-2xl font-black text-purple-400 mt-1">{datos.ordenes_produccion.length}</div>
          </div>
        </div>

        {/* HMI MANDOS */}
        <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 mb-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 md:border-r border-gray-800 md:pr-6">
            <h3 className="text-sm font-bold text-white uppercase mb-3">🎛️ Dosificador Digital</h3>
            
            <div className="mb-4">
              <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">1. Seleccionar Línea de Producto</label>
              <select value={productoSeleccionado} onChange={(e) => setProductoSeleccionado(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none">
                {datos.productos.map((prod: any, idx: number) => (
                  <option key={idx} value={prod.id_producto}>{prod.nombre} ({prod.peso_presentacion}g)</option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">2. Volumen del Lote</label>
              <div className="grid grid-cols-3 gap-2">
                {["250", "500", "1000"].map((size) => (
                  <button key={size} type="button" onClick={() => setPresentacionSeleccionada(size)} className={`py-1.5 rounded-xl text-xs font-mono font-bold border ${presentacionSeleccionada === size ? "bg-blue-500/10 text-blue-400 border-blue-500" : "bg-gray-950 text-gray-400 border-gray-800"}`}>{size} u.</button>
                ))}
              </div>
            </div>

            <button type="button" onClick={iniciarProcesoLlenado} disabled={procesoEstado === "PROCESANDO" || loading} className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider ${procesoEstado === "PROCESANDO" ? "bg-gray-800 text-gray-500 cursor-not-allowed animate-pulse" : "bg-green-500 text-gray-950 hover:bg-green-400"}`}>
              {procesoEstado === "PROCESANDO" ? "⚡ Envasando..." : "▶️ Iniciar Proceso"}
            </button>
          </div>

          <div className="md:col-span-2 flex flex-col justify-between">
            <h3 className="text-sm font-bold text-white uppercase">Estado Físico de Tolva</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 items-center">
              <div className="flex justify-center">
                <div className="w-24 h-28 bg-gray-950 border-2 border-gray-800 rounded-b-xl relative overflow-hidden flex flex-col justify-end">
                  <div className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 transition-all duration-150" style={{ height: `${progresoLlenado}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">Respuesta del Actuador</span>
                  <span className={`text-xs font-mono font-bold ${procesoEstado === "PROCESANDO" ? "text-amber-400 animate-pulse" : procesoEstado === "COMPLETADO" ? "text-green-400" : "text-gray-500"}`}>
                    {procesoEstado === "PROCESANDO" ? `● DISTRIBUYENDO MATERIA (${progresoLlenado}%)` : procesoEstado === "COMPLETADO" ? "✔ LOTE TRANSMITIDO A SUPABASE" : "● SISTEMA EN REPOSO"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FILAS DE INFORMACIÓN */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          <div className="rounded-2xl bg-gray-900 p-6 border border-gray-800">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase">👥 Personal de Turno</h3>
              <input type="text" placeholder="Buscar..." value={filtroUsuarios} onChange={(e) => setFiltroUsuarios(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1 text-xs text-white font-mono w-36" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-800 text-xs">
              <table className="w-full text-left text-gray-400">
                <thead>
                  <tr className="bg-gray-950 text-[10px] font-bold uppercase text-gray-400 border-b border-gray-800"><th className="px-4 py-2">ID_USUARIO</th><th className="px-4 py-2">Nombre Completo</th><th className="px-4 py-2">Cargo</th></tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800/40">
                      <td className="px-4 py-2 font-mono text-green-400">#{u.id_usuario}</td>
                      <td className="px-4 py-2 text-white font-medium">{u.nombre}</td>
                      <td className="px-4 py-2 uppercase font-mono text-gray-400">{u.rol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900 p-6 border border-gray-800">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase">🧪 Materia Prima Disponible</h3>
              <input type="text" placeholder="Buscar..." value={filtroInventario} onChange={(e) => setFiltroInventario(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1 text-xs text-white font-mono w-36" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-800 text-xs">
              <table className="w-full text-left text-gray-400">
                <thead>
                  <tr className="bg-gray-950 text-[10px] font-bold uppercase text-gray-400 border-b border-gray-800"><th className="px-4 py-2">Materia</th><th className="px-4 py-2">Volumen Disponible</th></tr>
                </thead>
                <tbody>
                  {inventarioFiltrado.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-600 font-mono">Cargando métricas...</td></tr>
                  ) : (
                    inventarioFiltrado.map((inv: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800/40">
                        <td className="px-4 py-2 text-white font-mono">🔹 {inv.nombre_materia}</td>
                        <td className="px-4 py-2 text-yellow-400 font-mono">{inv.cantidad_disponible} {inv.unidad_medida}</td>
                      </tr>
                    ))
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
