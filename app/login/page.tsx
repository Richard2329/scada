'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verificación directa en tu tabla relacional 'usuarios'
      const { data: usuario, error: dbError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('correo', email)
        .single();

      if (dbError || !usuario) {
        setError('El correo no coincide con ningún operador registrado.');
        setLoading(false);
        return;
      }

      // Clave de seguridad del proyecto
      if (password === "Baidal2026") {
        localStorage.setItem('user_id', usuario.id_usuario.toString());
        localStorage.setItem('user_name', usuario.nombre);
        localStorage.setItem('user_role', usuario.rol);
        
        router.push('/dashboard'); // Redirecciona a la nueva ruta del panel
      } else {
        setError('Contraseña de acceso incorrecta.');
      }
    } catch (err) {
      setError('Error de comunicación con Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#111827', padding: '32px', borderRadius: '16px', border: '1px solid #1f2937', maxWidth: '380px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase' }}>
            HMI / SCADA Industrial
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#f3f4f6', marginTop: '12px', margin: '12px 0 0 0' }}>SISTEMA LLENADO</h2>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', margin: '4px 0 0 0' }}>Sistemas Operativos de Tiempo Real</p>
        </div>
        
        {error && (
          <div style={{ backgroundColor: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px', padding: '12px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px', fontWeight: '500' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Correo del Operador</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ejemplo@empresa.com"
              style={{ width: '100%', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px', fontSize: '14px', color: '#f3f4f6', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Clave de Seguridad</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
              style={{ width: '100%', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px', fontSize: '14px', color: '#f3f4f6', boxSizing: 'border-box' }} />
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', backgroundColor: '#059669', color: 'white', fontWeight: 'bold', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '14px', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Validando...' : 'Establecer Conexión'}
          </button>
        </form>
      </div>
    </div>
  );
}