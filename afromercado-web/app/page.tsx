'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import HeroBanner from '@/components/catalogo/HeroBanner'
import FiltrosHorizontales from '@/components/catalogo/FiltrosHorizontales'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { SkeletonCard, EmptyState } from '@/components/ui'
import { listarProductos, listarCategorias } from '@/lib/api/productos'
import { mapearProductos } from '@/lib/mapearProducto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import type { Producto } from '@/types/producto'
import type { Categoria } from '@/types/categoria'

/* ─── Datos estáticos de presentación de categorías (solo visual) ──── */
const CATEGORIAS = [
  { emoji: '🌿', nombre: 'Del Campo',    fondo: 'bg-[#E8F5EE]', texto: 'text-[#2D6A4F]', proximamente: false },
  { emoji: '🎨', nombre: 'Artesanías',   fondo: 'bg-[#FFF8E8]', texto: 'text-[#B8860B]', proximamente: true  },
  { emoji: '🍽️', nombre: 'Gastronomía', fondo: 'bg-[#FFF3EE]', texto: 'text-[#B85A1A]', proximamente: true  },
  { emoji: '🏞️', nombre: 'Turismo',     fondo: 'bg-[#EEF3FF]', texto: 'text-[#2A4AB8]', proximamente: true  },
  { emoji: '🎭', nombre: 'Cultural',     fondo: 'bg-[#F5EEF8]', texto: 'text-[#7A2AB8]', proximamente: true  },
]

/* ─── Componente SeccionCategorias ──────────────────────────────── */
function SeccionCategorias() {
  return (
    <section className="bg-white py-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <h2
          className="text-2xl md:text-3xl text-[#1A1A1A] text-center mb-8"
          style={{ fontFamily: 'var(--font-dm-serif)' }}
        >
          Explora por categoría
        </h2>

        {/* Pills — scroll en mobile, centrados en desktop */}
        <div
          className="flex gap-3 overflow-x-auto pb-1 justify-start md:justify-center"
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {CATEGORIAS.map((cat) => (
            <div key={cat.nombre} className="relative flex-shrink-0">
              <button
                disabled={cat.proximamente}
                className={`flex flex-col items-center gap-1.5 px-5 py-4 rounded-2xl transition-all duration-200 min-w-[90px] ${cat.fondo} ${cat.proximamente ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105 hover:shadow-md'}`}
              >
                <span className="text-3xl leading-none">{cat.emoji}</span>
                <span className={`text-xs font-semibold ${cat.texto} whitespace-nowrap`}>{cat.nombre}</span>
              </button>
              {cat.proximamente && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#D4A017] text-[#1A1A1A] text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                  Próximo
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Componente SeccionDestacados ──────────────────────────────── */
function SeccionDestacados({ productos }: { productos: Producto[] }) {
  // Top 3 por ventas. Si no hay nada, la sección no se renderiza.
  const top3 = [...productos]
    .sort((a, b) => b.comercio.totalVentas - a.comercio.totalVentas)
    .slice(0, 3)

  if (top3.length === 0) return null

  return (
    <section className="bg-[#F8F5F0] py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-2">
            Selección especial
          </p>
          <h2
            className="text-2xl md:text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            Productos más vendidos
          </h2>
        </div>

        {/* Cards horizontales */}
        <div className="flex flex-col md:flex-row gap-4">
          {top3.map((producto) => (
            <div
              key={producto.id}
              className="flex-1 bg-white rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center gap-3"
            >
              {/* Imagen / placeholder cuadrado */}
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-[#F0EBE3] flex items-center justify-center relative">
                {producto.fotoUrl ? (
                  <Image
                    src={producto.fotoUrl}
                    alt={producto.nombre}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span
                    className="text-[#2D6A4F] text-xs font-normal text-center leading-tight px-1"
                    style={{ fontFamily: 'var(--font-dm-serif)' }}
                  >
                    {producto.nombre.split(' ').slice(0, 2).join(' ')}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[#52B788] text-[10px] font-semibold uppercase tracking-wide truncate mb-0.5">
                  {producto.comercio.nombre}
                </p>
                <p className="text-[#1A1A1A] text-sm font-semibold leading-snug line-clamp-2 mb-1">
                  {producto.nombre}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[#2D6A4F] text-sm font-bold">
                    {formatearPrecio(producto.precio)}
                  </span>
                  {producto.comercio.totalVentas > 0 && (
                    <span className="bg-[#D4A017]/15 text-[#B8860B] text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none">
                      {producto.comercio.totalVentas} ventas
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Página principal ───────────────────────────────────────────── */
export default function Home() {
  const [filtroActivo, setFiltroActivo] = useState<string>('todos')
  const [cargando, setCargando] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  // Destacados: se cargan una vez (todos los productos) y se conservan
  // aunque el usuario filtre por categoría.
  const [destacados, setDestacados] = useState<Producto[]>([])

  /** Carga productos según el filtro de categoría activo. */
  const cargarProductos = useCallback(async (filtro: string) => {
    setCargando(true)
    setError(null)
    try {
      const categoriaId = filtro === 'todos' ? undefined : filtro
      const { items } = await listarProductos({ categoriaId, porPagina: 24 })
      setProductos(mapearProductos(items))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los productos.')
      setProductos([])
    } finally {
      setCargando(false)
    }
  }, [])

  // Carga inicial: categorías reales + productos + destacados.
  useEffect(() => {
    let cancelado = false

    async function cargarInicial() {
      // Categorías (no bloquea el catálogo si falla).
      try {
        const cats = await listarCategorias()
        if (!cancelado) setCategorias(cats)
      } catch {
        if (!cancelado) setCategorias([])
      }

      // Destacados: todos los productos ordenados por ventas (top 3).
      try {
        const { items } = await listarProductos({ porPagina: 50 })
        if (!cancelado) setDestacados(mapearProductos(items))
      } catch {
        if (!cancelado) setDestacados([])
      }
    }

    cargarInicial()
    cargarProductos('todos')

    return () => {
      cancelado = true
    }
  }, [cargarProductos])

  function handleFiltroChange(filtro: string) {
    setFiltroActivo(filtro)
    cargarProductos(filtro)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">

        {/* Hero */}
        <HeroBanner />

        {/* Categorías */}
        <SeccionCategorias />

        {/* Destacados */}
        <SeccionDestacados productos={destacados} />

        {/* Catálogo completo */}
        <section id="catalogo" className="max-w-7xl mx-auto w-full px-4 md:px-6 py-10 flex flex-col gap-6">

          {/* Encabezado */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-1">
                Catálogo completo
              </p>
              <h2
                className="text-2xl md:text-3xl text-[#1A1A1A]"
                style={{ fontFamily: 'var(--font-dm-serif)' }}
              >
                Productos del Chocó
              </h2>
            </div>
            <p className="text-[#1A1A1A]/40 text-sm hidden md:block">
              {productos.length} productos
            </p>
          </div>

          {/* Filtros — categorías reales de la API */}
          <FiltrosHorizontales
            filtroActivo={filtroActivo}
            onFiltroChange={handleFiltroChange}
            categorias={categorias}
          />

          {/* Estado: error */}
          {error && !cargando && (
            <EmptyState
              titulo="No pudimos cargar los productos"
              descripcion={error}
              onReintentar={() => cargarProductos(filtroActivo)}
            />
          )}

          {/* Estado: cargando → skeletons en grid */}
          {cargando && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Estado: vacío */}
          {!cargando && !error && productos.length === 0 && (
            <EmptyState
              titulo="Aún no hay productos"
              descripcion="Pronto encontrarás aquí los productos del Chocó. Vuelve a intentarlo en un momento."
              onReintentar={() => cargarProductos(filtroActivo)}
            />
          )}

          {/* Grid de productos */}
          {!cargando && !error && productos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {productos.map((producto) => (
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
