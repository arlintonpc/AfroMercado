'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { SkeletonCard, EmptyState } from '@/components/ui'
import { listarProductos } from '@/lib/api/productos'
import { apiFetch } from '@/lib/api/client'
import { mapearProductos } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'

function Resultados() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const [termino, setTermino] = useState(q)
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mantiene el input sincronizado con la URL (ej. al navegar atrás).
  useEffect(() => {
    setTermino(q)
  }, [q])

  const cargar = useCallback(async (texto: string) => {
    if (!texto.trim()) {
      setProductos([])
      return
    }
    setCargando(true)
    setError(null)
    try {
      const { items } = await listarProductos({ q: texto.trim(), porPagina: 24 })
      setProductos(mapearProductos(items))
      // Guardar en historial (fire-and-forget)
      const sesionId = (() => { try { let s = sessionStorage.getItem('afm_sid'); if (!s) { s = Math.random().toString(36).slice(2); sessionStorage.setItem('afm_sid', s) } return s } catch { return undefined } })()
      apiFetch('/productos/busqueda', { method: 'POST', body: { query: texto.trim(), sesionId } }).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo realizar la búsqueda.')
      setProductos([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar(q)
  }, [q, cargar])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const texto = termino.trim()
    router.push(texto ? `/buscar?q=${encodeURIComponent(texto)}` : '/buscar')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">

        {/* Buscador (también en móvil) */}
        <form onSubmit={onSubmit} role="search" className="w-full">
          <div className="relative">
            <input
              type="search"
              autoFocus
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              placeholder="Buscar productos del Chocó..."
              aria-label="Buscar productos"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#1A1A1A]/15 bg-white focus:outline-none focus:border-[#D4A017] text-base"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1A1A1A]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        {/* Encabezado de resultados */}
        {q && (
          <div>
            <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-1">
              Resultados
            </p>
            <h1 className="text-2xl md:text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              «{q}»
            </h1>
            {!cargando && !error && (
              <p className="text-sm text-[#1A1A1A]/40 mt-1">
                {productos.length} {productos.length === 1 ? 'producto encontrado' : 'productos encontrados'}
              </p>
            )}
          </div>
        )}

        {/* Estados */}
        {error && !cargando && (
          <EmptyState
            titulo="No pudimos buscar"
            descripcion={error}
            onReintentar={() => cargar(q)}
          />
        )}

        {cargando && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Sin término aún */}
        {!q && !cargando && (
          <EmptyState
            titulo="¿Qué estás buscando?"
            descripcion="Escribe el nombre de un producto, un sabor o un productor del Chocó."
          />
        )}

        {/* Sin resultados */}
        {q && !cargando && !error && productos.length === 0 && (
          <EmptyState
            titulo={`Sin resultados para «${q}»`}
            descripcion="Prueba con otra palabra. Por ahora nuestro catálogo crece con productos del campo chocoano."
          />
        )}

        {/* Grid de resultados */}
        {!cargando && !error && productos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {productos.map((producto) => (
              <TarjetaProducto key={producto.id} producto={producto} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default function PaginaBuscar() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
          <Header />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <Resultados />
    </Suspense>
  )
}
