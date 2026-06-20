'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { listarFavoritos, type FavoritoItemApi } from '@/lib/api/favoritos'
import { mapearProducto, type ProductoCrudo } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'

export default function PaginaMisFavoritos() {
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const router = useRouter()

  const [favoritos, setFavoritos] = useState<FavoritoItemApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/mis-favoritos')
    }
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    let cancelado = false

    async function cargarFavoritos() {
      setCargando(true)
      setError(null)
      try {
        const items = await listarFavoritos()
        if (!cancelado) setFavoritos(items)
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudieron cargar los favoritos.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    void cargarFavoritos()
    return () => {
      cancelado = true
    }
  }, [autenticado, cargandoAuth])

  const titulo = 'Mis favoritos'
  const favoritosNormalizados: Array<FavoritoItemApi & { producto: Producto }> = favoritos
    .filter((fav): fav is FavoritoItemApi & { producto: ProductoCrudo | Producto } => Boolean(fav.producto))
    .map((fav) => ({
      ...fav,
      producto: mapearProducto(fav.producto),
    }))

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-6">
          <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-1">Tu selección</p>
          <h1
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            {titulo}
          </h1>
          {!cargando && !error && (
            <p className="text-sm text-[#1A1A1A]/40 mt-1">
              {favoritosNormalizados.length} {favoritosNormalizados.length === 1 ? 'producto guardado' : 'productos guardados'}
            </p>
          )}
        </div>

        {cargando && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-3xl bg-white h-72 animate-pulse" />
            ))}
          </div>
        )}

        {error && !cargando && (
          <EmptyState titulo="No pudimos cargar tus favoritos" descripcion={error} />
        )}

        {!cargando && !error && favoritosNormalizados.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#2D6A4F]" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <p
              className="text-2xl text-[#1A1A1A]"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              Aún no tienes favoritos
            </p>
            <p className="text-sm text-[#1A1A1A]/50 max-w-xs">
              Toca el corazón en cualquier producto para guardarlo aquí y encontrarlo fácilmente.
            </p>
            <Link
              href="/"
              className="mt-2 bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              Explorar productos
            </Link>
          </div>
        )}

        {!cargando && !error && favoritosNormalizados.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {favoritosNormalizados.map((fav) => (
              <TarjetaProducto key={fav.productoId} producto={fav.producto} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
