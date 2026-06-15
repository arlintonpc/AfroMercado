import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // El optimizador de Next no sirve imágenes http://localhost; además, en
    // producción las imágenes irán a Cloudinary (con su propia optimización).
    // Para el MVP cargamos las imágenes tal cual (sin el optimizador).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        // Imágenes servidas por el backend local (cualquier puerto)
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
