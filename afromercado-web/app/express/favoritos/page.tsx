'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { misFavoritosExpress, toggleFavoritoExpress, type ComercioExpress } from '@/lib/api/express'
import { useAuth } from '@/context/AuthContext'
import TarjetaRestaurante from '@/components/express/TarjetaRestaurante'

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
              <TarjetaRestaurante key={r.id} cfg={r} onQuitarFavorito={quitar} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
