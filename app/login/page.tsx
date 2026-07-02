"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Reemplaza con tus credenciales reales de Supabase si cambian
const SUPABASE_URL = "https://gkdfrbkquycyasxxuhdi.supabase.co"; 
const SUPABASE_ANON_KEY = "tu_clave_anon_aqui";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function DashboardPage() {
  // Definimos explícitamente que los estados aceptan cualquier arreglo de objetos (any[])
  const [datos, setDatos] = useState<{
    usuarios: any[];
    productos: any[];
    inventario: any[];
    ordenes: any[];
  }>({
    usuarios: [],
    productos: [],
    inventario: [],
    ordenes: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Consultas en paralelo a Supabase
        const [resUser, resProd, resInv, resOrd] = await Promise.all([
          supabase.from("usuarios").select("*"),
          supabase.from("productos").select("*"),
          supabase.from("inventario").select("*"),
          supabase.from("ordenes").select("*"),
        ]);

        setDatos({
          usuarios: resUser.data || [],
          productos: resProd.data || [],
          inventario: resInv.data || [],
          ordenes: resOrd.data || [],
        });
      } catch (error) {
        console.error("Error cargando datos de Supabase:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <p className="text-xl animate-pulse">Cargando Sistema SCADA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6 text-gray-100">
      <header className="mb-8 border-b border-gray-800 pb-4">
        <h1 className="text-3xl font-bold text-green-400">📊 Panel de Control SCADA</h1>
        <p className="text-sm text-gray-400">Monitoreo de Planta Industrial en Tiempo Real</p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Card Usuarios */}
        <div className="rounded-xl bg-gray-800 p-6 shadow-lg border border-gray-700">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">Total Usuarios</h2>
          <p className="mt-2 text-3xl font-bold text-white">{datos.usuarios.length}</p>
        </div>

        {/* Card Productos */}
        <div className="rounded-xl bg-gray-800 p-6 shadow-lg border border-gray-700">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">Productos Activos</h2>
          <p className="mt-2 text-3xl font-bold text-blue-400">{datos.productos.length}</p>
        </div>

        {/* Card Inventario */}
        <div className="rounded-xl bg-gray-800 p-6 shadow-lg border border-gray-700">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">Items en Inventario</h2>
          <p className="mt-2 text-3xl font-bold text-yellow-400">{datos.inventario.length}</p>
        </div>

        {/* Card Órdenes */}
        <div className="rounded-xl bg-gray-800 p-6 shadow-lg border border-gray-700">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">Órdenes Procesadas</h2>
          <p className="mt-2 text-3xl font-bold text-purple-400">{datos.ordenes.length}</p>
        </div>
      </div>

      {/* Sección de Tablas de Monitoreo */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-gray-800 p-6 shadow-md border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">👥 Registro de Usuarios</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-700 text-xs uppercase text-gray-200">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Nombre</th>
                </tr>
              </thead>
              <tbody>
                {datos.usuarios.map((u, i) => (
                  <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="px-4 py-2 font-mono text-xs text-green-400">{u.id}</td>
                    <td className="px-4 py-2 text-white">{u.nombre || u.username || "Sin nombre"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-gray-800 p-6 shadow-md border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">📦 Estado del Inventario</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-700 text-xs uppercase text-gray-200">
                <tr>
                  <th className="px-4 py-2">Producto</th>
                  <th className="px-4 py-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {datos.inventario.map((inv, i) => (
                  <tr key={i} className="border-b border-gray-700">
                    <td className="px-4 py-2 text-white">{inv.producto_id || "ID del ítem"}</td>
                    <td className="px-4 py-2 font-bold text-yellow-400">{inv.cantidad ?? inv.stock ?? 0} unidades</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
