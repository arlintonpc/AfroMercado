'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { misFavoritosTour, toggleFavoritoTour, type ConfigTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'

export default function FavoritosTourPage() {
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const router = useRouter()
  const [tours, setTours] = useState<ConfigTour[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) { router.push('/ingresar'); return }
    if (autenticado) {
      misFavoritosTour().then(setTours).catch(() => {}).finally(() => setCargando(false))
    }
  }, [autenticado, cargandoAuth])

  if (cargando) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/tours" className="text-[#2D6A4F] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A] text-lg">Tours guardados</h1>
          <span className="ml-auto text-sm text-gray-400">{tours.length}</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-3 pb-10">
        {tours.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-medium">No tienes tours guardados</p>
            <Link href="/tours" className="mt-4 inline-block text-[#2D6A4F] underline text-sm">Explorar tours</Link>
          </div>
        ) : (
          tours.map(tour => (
            <div key={tour.id} className="bg-white rounded-2xl border border-[#E8DCC8] overflow-hidden">
              <div className="flex gap-3 p-3">
                {tour.fotos?.[0] ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <Image src={tour.fotos[0]} alt={tour.nombre} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-[#F0EBE3] flex items-center justify-center text-3xl flex-shrink-0">🗺️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1A1A1A] truncate">{tour.nombre}</p>
                  <p className="text-xs text-[#666] mt-0.5">{tour.comercio?.municipio}</p>
                  <p className="text-sm font-bold text-[#2D6A4F] mt-1">{formatearPrecio(Number(tour.precioPersona))} <span className="font-normal text-[#999] text-xs">/ persona</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">⏱ {tour.duracionHoras}h · 👥 máx {tour.maxParticipantes}</p>
                </div>
                <button
                  onClick={async () => {
                    await toggleFavoritoTour(tour.id)
                    setTours(prev => prev.filter(t => t.id !== tour.id))
                  }}
                  className="p-2 flex-shrink-0 text-red-400"
                  title="Quitar de favoritos"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#E53E3E" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </div>
              <div className="border-t border-[#E8DCC8] px-3 py-2">
                <Link href={`/tours/${tour.id}`} className="text-sm text-[#2D6A4F] font-medium">
                  Ver tour →
                </Link>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
