'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b0f19', display: 'flex', alignItems: 'center', justifyHeads: 'center' }}>
      <p style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '12px' }}>REDIRECCIONANDO AL CONTROL DE ACCESO SCADA...</p>
    </div>
  );
}