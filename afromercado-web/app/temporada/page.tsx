'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { EmptyState, SkeletonCard } from '@/components/ui'
import { listarProductos } from '@/lib/api/productos'
import { mapearProductos } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'

export default function PaginaTemporada() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function cargar() {
    setCargando(true)
    setError(null)
    listarProductos({ enOferta: true, porPagina: 48 })
      .then(({ items }) => {
        setProductos(mapearProductos(items).filter(p => p.oferta))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No pudimos cargar la temporada.')
        setProductos([])
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    let cancelado = false
    listarProductos({ enOferta: true, porPagina: 48 })
      .then(({ items }) => {
        if (!cancelado) setProductos(mapearProductos(items).filter(p => p.oferta))
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'No pudimos cargar la temporada.')
          setProductos([])
        }
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">
        <section className="bg-white border-b border-[#1A1A1A]/5">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
            <p className="text-[#2D6A4F] text-xs font-semibold tracking-widest uppercase mb-2">
              Tiempo limitado
            </p>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                  Temporada AfroMercado
                </h1>
                <p className="mt-2 max-w-2xl text-sm md:text-base text-[#1A1A1A]/60 leading-relaxed">
                  Productos con precio especial por tiempo limitado, publicados por productores del Chocó.
                </p>
              </div>
              <Link href="/" className="self-start md:self-auto text-sm font-semibold text-[#2D6A4F] hover:underline">
                Volver al catálogo
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto w-full px-4 md:px-6 py-8 flex flex-col gap-6">
          {!cargando && !error && productos.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#1A1A1A]/55">
                {productos.length} {productos.length === 1 ? 'producto vigente' : 'productos vigentes'}
              </p>
            </div>
          )}

          {cargando && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {error && !cargando && (
            <EmptyState
              titulo="No pudimos cargar la temporada"
              descripcion={error}
              onReintentar={cargar}
            />
          )}

          {!cargando && !error && productos.length === 0 && (
            <EmptyState
              titulo="Aún no hay productos de temporada"
              descripcion="Cuando un productor active un precio especial, aparecerá aquí automáticamente."
              onReintentar={cargar}
            />
          )}

          {!cargando && !error && productos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {productos.map(producto => (
                <TarjetaProducto key={producto.id} producto={producto} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
