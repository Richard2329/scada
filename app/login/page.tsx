import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = "https://gkfubkquycyasxxuhdi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZGZ1YmtxdXljeWFzeHh1aGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NDI1ODQsImV4cCI6MjA5ODIxODU4NH0.jFpHlW2r1eJxsRO9HvUJhDgA5c69LDROJS5fcL9xHGg"; // Conserva tu clave completa aquí

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface PlantaDatos {
  usuarios: cualquier[];
  productos: cualquier[];
  inventario: cualquier[];
  órdenes: cualquier[];
}

export default function DashboardCompletePage() {
  // --- CONTROL DE ACCESO (CONEXIÓN REAL A SUPABASE) ---
  const [estáAutenticado, setIsAuthenticated] = useState(false);
  const [nombreUsuario, establecerNombreDeUsuario] = useState(""); // Captura el "USUARIO ID" (Correo)
  const [contraseña, establecerContraseña] = useState("");         // Captura el "CÓDIGO DE SEGURIDAD"
  const [errorDeInicioDeSesión, establecerErrorDeInicioDeSesión] = useState("");
  const [cargandoInicioDeSesión, cargarInicioDeSesión] = useState(false);
  const [operadorActivo, setOperadorActivo] = useState("");

  // --- DATOS INDUSTRIALES ---
  const [datos, establecerDatos] = useState<PlantaDatos>({
    usuarios: [],
    productos: [],
    inventario: [],
    órdenes: [],
  });

  // --- FUNCIÓN DE AUTENTICACIÓN ---
  const manejarAutenticacion = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita que la página se recargue
    
    if (!nombreUsuario || !contraseña) {
      establecerErrorDeInicioDeSesión("Por favor, ingrese todos los campos.");
      return;
    }

    cargarInicioDeSesión(true);
    establecerErrorDeInicioDeSesión("");

    try {
      // 1. Consultamos en Supabase si existe un usuario con ese correo electrónico
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('correo', nombreUsuario.trim())
        .single(); // Trae un único registro

      // Si hay error en la consulta o el usuario no existe
      if (error || !usuario) {
        establecerErrorDeInicioDeSesión("Credenciales incorrectas de operador");
        cargarInicioDeSesión(false);
        return;
      }

      // 2. Validamos el código de seguridad. 
      // Como en tu tabla el 'id_usuario' es un número (int4) y el input es un texto, los convertimos a String para comparar.
      if (String(usuario.id_usuario) === contraseña.trim()) {
        
        // LOGIN EXITOSO: Guardamos el nombre del operador real y damos acceso
        setOperadorActivo(usuario.nombre); // Ejemplo: "Operador Principal"
        setIsAuthenticated(true);
        establecerErrorDeInicioDeSesión("");
        
        // Aquí puedes disparar la carga inicial de los datos de la planta (inventario, órdenes, etc.)
        cargarDatosDePlanta();

      } else {
        // Contraseña/Código incorrecto
        establecerErrorDeInicioDeSesión("Credenciales incorrectas de operador");
      }

    } catch (err) {
      establecerErrorDeInicioDeSesión("Fallo en la comunicación con el enlace teleinformático.");
    } finally {
      cargarInicioDeSesión(false);
    }
  };

  // Función auxiliar para limpiar estados al cerrar sesión
  const cerrarSesion = () => {
    setIsAuthenticated(false);
    establecerNombreDeUsuario("");
    establecerContraseña("");
    setOperadorActivo("");
  };

  // Función simulada para cargar el resto de las tablas (puedes expandirla luego)
  const cargarDatosDePlanta = async () => {
    // const { data: inventario } = await supabase.from('inventario_materias').select('*');
    // ... actualizar el estado 'datos'
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-4">
      
      {!estáAutenticado ? (
        /* --- INTERFAZ DEL LOGIN (TERMINAL HMI / SCADA) --- */
        <div className="bg-[#111827] border border-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
              🔒 Terminal HMI / SCADA
            </h2>
            <p className="text-gray-400 text-sm mt-1">Ingrese credenciales de operador de planta</p>
          </div>

          {/* Mensaje de Error */}
          {errorDeInicioDeSesión && (
            <div className="bg-red-950/50 border border-red-500 text-red-400 text-sm p-3 rounded-lg text-center mb-4 font-semibold">
              ⚠️ {errorDeInicioDeSesión}
            </div>
          )}

          <form onSubmit={manejarAutenticacion} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Usuario ID (Correo)
              </label>
              <input
                type="text"
                placeholder="ejemplo@correo.com"
                value={nombreUsuario}
                onChange={(e) => establecerNombreDeUsuario(e.target.value)}
                disabled={cargandoInicioDeSesión}
                className="w-full bg-[#1f2937] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Código de Seguridad
              </label>
              <input
                type="password"
                placeholder="••••"
                value={contraseña}
                onChange={(e) => establecerContraseña(e.target.value)}
                disabled={cargandoInicioDeSesión}
                className="w-full bg-[#1f2937] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={cargandoInicioDeSesión}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 font-bold uppercase tracking-wider py-3 rounded-lg transition-colors mt-2 text-black"
            >
              {cargandoInicioDeSesión ? "Estableciendo Enlace Teleinformático..." : "Autenticar Terminal"}
            </button>
          </form>
        </div>
      ) : (
        /* --- INTERFAZ DEL DASHBOARD (SISTEMA DE CONTROL PRINCIPAL) --- */
        <div className="w-full max-w-6xl bg-[#111827] p-8 rounded-2xl border border-gray-800 shadow-2xl">
          <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-green-400 tracking-tight">SISTEMA SCADA - CONTROL DE PLANTA</h1>
              <p className="text-sm text-gray-400 mt-1">
                Operador en línea: <span className="text-white font-mono font-bold">{operadorActivo}</span>
              </p>
            </div>
            <button 
              onClick={cerrarSesion}
              className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-red-500/30"
            >
              Desconectar Terminal
            </button>
          </div>

          {/* El resto de tus componentes y visualización de datos industriales van aquí */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1f2937] p-4 rounded-xl border border-gray-700">
              <h3 className="text-gray-400 text-xs font-bold uppercase">Estado de Enlace</h3>
              <p className="text-xl font-mono text-green-400 mt-1 font-bold">● SINCRO OK</p>
            </div>
            {/* ... */}
          </div>
        </div>
      )}

    </div>
  );
}
