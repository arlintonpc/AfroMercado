'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { misFavoritosExpress, toggleFavoritoExpress, type ComercioExpress } from '@/lib/api/express'
import { useAuth } from '@/context/AuthContext'

export default function MisFavoritosExpressPage() {
  const { usuario, cargando: authCargando } = useAuth()
  const router = useRouter()
  const [restaurantes, setRestaurantes] = useState<ComercioExpress[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!authCargando && !usuario) { router.push('/ingresar'); return }
    if (usuario) {
      misFavoritosExpress()
        .then(setRestaurantes)
        .catch(() => {})
        .finally(() => setCargando(false))
    }
  }, [usuario, authCargando, router])

  async function quitar(id: number) {
    await toggleFavoritoExpress(id)
    setRestaurantes(r => r.filter(x => x.id !== id))
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
          <Link href="/express" className="text-xs text-[#2D6A4F] hover:underline">← Volver a Express</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Mis restaurantes favoritos</h1>
          <p className="text-sm text-gray-500 mt-1">{restaurantes.length} {restaurantes.length === 1 ? 'restaurante guardado' : 'restaurantes guardados'}</p>
        </div>

        {restaurantes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🍽️</p>
            <h2 className="font-semibold text-gray-700 mb-2">Sin favoritos aún</h2>
            <p className="text-sm text-gray-500 mb-6">Guarda restaurantes tocando el corazón en su menú</p>
            <Link href="/express" className="inline-block bg-[#1B4332] text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-[#2D6A4F] transition-colors">
              Explorar Express
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {restaurantes.map(r => (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {r.comercio.logoUrl && (
                  <div className="h-40 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- logo del comercio (Cloudinary), no un asset local optimizable */}
                    <img src={r.comercio.logoUrl} alt={r.comercio.nombre} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{r.comercio.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.comercio.municipio}</p>
                    </div>
                    <button onClick={() => quitar(r.id)} className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs mt-2">
                    <span className={r.abierto ? 'text-[#2D6A4F] font-semibold' : 'text-gray-400'}>
                      {r.abierto ? 'Abierto ahora' : 'Cerrado'}
                    </span>
                    {r.comercio.calificacion > 0 && (
                      <span className="text-gray-400"> · ⭐ {Number(r.comercio.calificacion).toFixed(1)}</span>
                    )}
                  </p>
                  <Link href={`/express/${r.id}`}
                    className="mt-3 block text-center text-sm font-medium bg-[#1B4332] text-white py-2 rounded-xl hover:bg-[#2D6A4F] transition-colors">
                    Ver menú
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
