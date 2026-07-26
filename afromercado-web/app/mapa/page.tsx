'use client'

import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import Link from 'next/link'

const MapaEcosistemico = dynamic(() => import('@/components/mapa/MapaEcosistemico'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[550px] bg-gray-100 dark:bg-white/5 rounded-3xl animate-pulse flex items-center justify-center text-gray-400">
      Cargando Mapa Ecosistémico Multicapa...
    </div>
  ),
})

export default function PaginaMapa() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5F2] dark:bg-[#0F1713] transition-colors">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[#2D6A4F] dark:text-[#52B788] text-xs font-semibold tracking-widest uppercase">
              Geolocalización Ecosistémica
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mt-1">
              Mapa Multicapa Teravia
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
              Explora en un solo mapa interactivo los hoteles, restaurantes, experiencias turísticas, rutas de transporte y predios de bienes raíces en todo el país.
            </p>
          </div>

          <Link
            href="/"
            className="self-start sm:self-auto text-xs font-bold text-[#1B4332] dark:text-[#52B788] hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>

        <MapaEcosistemico />
      </main>

      <Footer />
    </div>
  )
}
