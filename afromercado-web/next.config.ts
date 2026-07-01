import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
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
      {
        // Backend desplegado en Render (producción)
        protocol: "https",
        hostname: "*.onrender.com",
        pathname: "/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
