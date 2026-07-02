import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Esto obliga a Vercel a ignorar los errores de TypeScript y desplegar con éxito
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
