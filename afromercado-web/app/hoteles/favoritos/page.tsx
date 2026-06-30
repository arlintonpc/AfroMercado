'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { misFavoritosHoteles, toggleFavoritoHotel, type ConfigHotel } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'

export default function MisFavoritosHotelesPage() {
  const { usuario, cargando: authCargando } = useAuth()
  const router = useRouter()
  const [hoteles, setHoteles] = useState<ConfigHotel[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!authCargando && !usuario) { router.push('/ingresar'); return }
    if (usuario) {
      misFavoritosHoteles()
        .then(setHoteles)
        .catch(() => {})
        .finally(() => setCargando(false))
    }
  }, [usuario, authCargando, router])

  async function quitar(id: number) {
    await toggleFavoritoHotel(id)
    setHoteles(h => h.filter(x => x.id !== id))
  }

  if (cargando || authCargando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/hoteles" className="text-xs text-[#2D6A4F] hover:underline">← Volver a hoteles</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Mis hoteles favoritos</h1>
          <p className="text-sm text-gray-500 mt-1">{hoteles.length} {hoteles.length === 1 ? 'alojamiento guardado' : 'alojamientos guardados'}</p>
        </div>

        {hoteles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🏨</p>
            <h2 className="font-semibold text-gray-700 mb-2">Sin favoritos aún</h2>
            <p className="text-sm text-gray-500 mb-6">Guarda hoteles tocando el corazón en la página del alojamiento</p>
            <Link href="/hoteles" className="inline-block bg-[#1B4332] text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-[#2D6A4F] transition-colors">
              Explorar hoteles
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {hoteles.map(h => {
              const precioMin = h.habitaciones.length
                ? Math.min(...h.habitaciones.map(hab => Number(hab.precioPorNoche)))
                : null
              const foto = h.habitaciones[0]?.fotos[0] ?? h.comercio.logoUrl

              return (
                <div key={h.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {foto && (
                    <div className="h-40 overflow-hidden">
                      <img src={foto} alt={h.comercio.nombre} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{h.comercio.nombre}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{h.comercio.municipio}</p>
                      </div>
                      <button onClick={() => quitar(h.id)} className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                    {precioMin && (
                      <p className="text-sm mt-2">
                        <span className="text-gray-400 text-xs">desde </span>
                        <span className="font-bold text-[#1B4332]">{formatearPrecio(precioMin)}</span>
                        <span className="text-gray-400 text-xs"> /noche</span>
                      </p>
                    )}
                    <Link href={`/hoteles/${h.id}`}
                      className="mt-3 block text-center text-sm font-medium bg-[#1B4332] text-white py-2 rounded-xl hover:bg-[#2D6A4F] transition-colors">
                      Ver alojamiento
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
