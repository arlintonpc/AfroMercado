'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import HeroBanner from '@/components/catalogo/HeroBanner'
import FiltrosHorizontales from '@/components/catalogo/FiltrosHorizontales'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { SkeletonCard, EmptyState } from '@/components/ui'
import { listarProductos, listarCategorias } from '@/lib/api/productos'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'
import { mapearProductos, type ProductoCrudo } from '@/lib/mapearProducto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { precioVigente } from '@/lib/precioProducto'
import { registrarEventoPatrocinado } from '@/lib/publicidadTracking'
import { listarHoteles, type ConfigHotel } from '@/lib/api/hotel'
import type { Producto } from '@/types/producto'
import type { Categoria } from '@/types/categoria'

/* ─── Utilidad: tiempo restante hasta fin de oferta ─── */
function tiempoRestante(fin: string): string {
  const ms = new Date(fin).getTime() - Date.now()
  if (ms <= 0) return 'Expirada'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d restantes`
  if (h >= 1)  return `${h}h ${m}m restantes`
  return `${m} min restantes`
}

/* ─── Datos estáticos de presentación de categorías (solo visual) ──── */
const CATEGORIAS = [
  { emoji: '🌿', nombre: 'Del Campo',    slug: 'del-campo',  fondo: 'bg-[#E8F5EE]', texto: 'text-[#2D6A4F]', proximamente: false },
  { emoji: '🎨', nombre: 'Artesanías',   slug: 'artesanias', fondo: 'bg-[#FFF8E8]', texto: 'text-[#B8860B]', proximamente: false },
  { emoji: '🍽️', nombre: 'Gastronomía', slug: 'gastronomia', fondo: 'bg-[#FFF3EE]', texto: 'text-[#B85A1A]', proximamente: false },
  { emoji: '🏞️', nombre: 'Turismo',  slug: 'turismo',   fondo: 'bg-[#EEF3FF]', texto: 'text-[#2A4AB8]', proximamente: false },
  { emoji: '🎭', nombre: 'Cultural', slug: 'cultural',  fondo: 'bg-[#F5EEF8]', texto: 'text-[#7A2AB8]', proximamente: false },
]

interface VisibilidadActiva {
  tipo?: 'HOME_DESTACADO' | 'CATALOGO' | string
  etiqueta?: string | null
  producto?: ProductoCrudo | null
}

function visibilidadConProducto(
  v: VisibilidadActiva,
): v is VisibilidadActiva & { producto: ProductoCrudo } {
  return Boolean(v.producto)
}

/* ─── Componente SeccionHoteles ──────────────────────────────────── */
function SeccionHoteles({ hoteles }: { hoteles: ConfigHotel[] }) {
  if (hoteles.length === 0) return null
  return (
    <section className="bg-white py-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[#2D6A4F] text-xs font-semibold tracking-widest uppercase mb-1">Turismo</p>
            <h2 className="text-2xl md:text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              Hoteles & Hospedaje
            </h2>
          </div>
          <Link href="/hoteles" className="text-sm font-semibold text-[#2D6A4F] hover:underline whitespace-nowrap">
            Ver todos →
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {hoteles.slice(0, 6).map(h => {
            const desde = h.habitaciones.length > 0
              ? Math.min(...h.habitaciones.map(hab => Number(hab.precioPorNoche)))
              : null
            const foto = h.habitaciones[0]?.fotos[0]
            return (
              <Link key={h.id} href={`/hoteles/${h.id}`}
                className="flex-shrink-0 w-52 bg-[#F8F5F0] rounded-2xl overflow-hidden hover:shadow-md transition-shadow border border-[#E8DCC8]">
                <div className="h-32 bg-gradient-to-br from-[#2D6A4F] to-[#40916C] flex items-center justify-center overflow-hidden">
                  {foto
                    ? <img src={foto} alt={h.comercio.nombre} className="w-full h-full object-cover" />
                    : <span className="text-4xl">🏨</span>
                  }
                </div>
                <div className="p-3">
                  <p className="font-semibold text-[#1A1A1A] text-sm truncate">{h.comercio.nombre}</p>
                  <p className="text-xs text-gray-500 truncate">📍 {h.comercio.municipio}</p>
                  {desde !== null && (
                    <p className="text-xs text-[#2D6A4F] font-bold mt-1">
                      Desde {formatearPrecio(desde)}<span className="font-normal text-gray-400">/noche</span>
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

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
          {CATEGORIAS.map((cat) => {
            const claseBase = `flex flex-col items-center gap-1.5 px-5 py-4 rounded-2xl transition-all duration-200 min-w-[90px] ${cat.fondo}`
            const contenido = (
              <>
                <span className="text-3xl leading-none">{cat.emoji}</span>
                <span className={`text-xs font-semibold ${cat.texto} whitespace-nowrap`}>{cat.nombre}</span>
              </>
            )
            const activa = !cat.proximamente && !!cat.slug
            return (
              <div key={cat.nombre} className="relative flex-shrink-0">
                {activa ? (
                  <Link href={`/buscar?categoria=${cat.slug}`} className={`${claseBase} hover:scale-105 hover:shadow-md`}>
                    {contenido}
                  </Link>
                ) : (
                  <button disabled className={`${claseBase} opacity-60 cursor-not-allowed`}>
                    {contenido}
                  </button>
                )}
                {cat.proximamente && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#D4A017] text-[#1A1A1A] text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                    Próximo
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─── Componente SeccionDestacados ──────────────────────────────── */
function SeccionDestacados({ productos, destacadosPagados, etiquetasPagadas }: {
  productos: Producto[]
  destacadosPagados: Producto[]
  etiquetasPagadas: Map<string, string>
}) {
  const idsDestacados = new Set(destacadosPagados.map(p => p.id))
  const topVentas = [...productos]
    .filter(p => !idsDestacados.has(p.id))
    .sort((a, b) => b.comercio.totalVentas - a.comercio.totalVentas)
  const top3 = [...destacadosPagados.slice(0, 2), ...topVentas].slice(0, 3)

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
            <Link
              key={producto.id}
              href={`/producto/${producto.id}`}
              onClick={() => {
                if (idsDestacados.has(producto.id)) registrarEventoPatrocinado(producto.id, 'clic')
              }}
              className={`flex-1 rounded-2xl p-3 transition-shadow duration-200 flex items-center gap-3 ${
                idsDestacados.has(producto.id)
                  ? 'bg-white shadow-[0_2px_12px_rgba(45,106,79,0.18)] ring-2 ring-[#2D6A4F]/35 hover:shadow-[0_4px_20px_rgba(45,106,79,0.25)]'
                  : 'bg-white shadow-sm hover:shadow-md'
              }`}
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
                    {formatearPrecio(precioVigente(producto))}
                  </span>
                  {idsDestacados.has(producto.id) ? (
                    <span className="flex items-center gap-0.5 bg-[#2D6A4F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M17 8C8 10 5.9 16.17 3.82 19.52 3.23 20.5 4.5 21.5 5.3 20.67 7 18.9 8.91 17.5 11 17c-1 3-4 4-4 4s6 0 9-8c1.5 2 2 3.5 2 5.5 0 0 2-10-1-10.5z"/>
                      </svg>
                      {etiquetasPagadas.get(producto.id) ?? 'Patrocinado'}
                    </span>
                  ) : producto.comercio.totalVentas > 0 ? (
                    <span className="bg-[#D4A017]/15 text-[#B8860B] text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none">
                      {producto.comercio.totalVentas} ventas
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Sección: Temporada AfroMercado ────────────────────────────── */
function SeccionOfertas({ productos }: { productos: Producto[] }) {
  const conOferta = productos.filter(p => p.oferta)
  if (conOferta.length === 0) return null
  return (
    <section className="bg-white py-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[#2D6A4F] text-xs font-semibold tracking-widest uppercase mb-1">
              Tiempo limitado
            </p>
            <h2 className="text-2xl md:text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              Temporada AfroMercado
            </h2>
            <p className="mt-1 text-sm text-[#1A1A1A]/50">
              Productos con precio especial por tiempo limitado.
            </p>
          </div>
          <Link href="/temporada" className="text-sm text-[#2D6A4F] font-semibold hover:underline hidden md:block">
            Ver temporada →
          </Link>
        </div>

        <div
          className="flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {conOferta.map(p => (
            <Link
              key={p.id}
              href={`/producto/${p.id}`}
              className="flex-shrink-0 w-48 rounded-2xl border border-[#2D6A4F]/15 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
            >
              {/* Imagen */}
              <div className="relative w-full aspect-square bg-[#F0EBE3] overflow-hidden">
                {p.fotoUrl ? (
                  <Image src={p.fotoUrl} alt={p.nombre} fill sizes="192px" className="object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
                    <span className="text-[#2D6A4F] text-sm font-normal" style={{ fontFamily: 'var(--font-dm-serif)' }}>{p.nombre}</span>
                  </div>
                )}
                <span className="absolute top-2 left-2 bg-[#2D6A4F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
                  {p.oferta!.tipo === 'PORCENTAJE' ? `-${Math.round(p.oferta!.valor)}%` : 'TEMPORADA'}
                </span>
              </div>
              {/* Info */}
              <div className="px-3 py-2.5">
                <p className="text-[10px] text-[#52B788] font-semibold uppercase tracking-wide truncate mb-0.5">{p.comercio.nombre}</p>
                <p className="text-sm font-semibold text-[#1A1A1A] truncate mb-1">{p.nombre}</p>
                {p.oferta?.etiqueta && (
                  <p className="text-[10px] text-[#2D6A4F] font-medium truncate mb-1">{p.oferta.etiqueta}</p>
                )}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-bold text-[#2D6A4F]">{formatearPrecio(p.oferta!.precioFinal)}</span>
                  <span className="text-xs text-[#1A1A1A]/40 line-through">{formatearPrecio(p.precio)}</span>
                </div>
                {p.oferta?.fin && (
                  <p className="text-[9px] text-[#1A1A1A]/35 mt-1 flex items-center gap-0.5">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    {tiempoRestante(p.oferta.fin)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Intercalación: 1 destacado cada 4 orgánicos ───────────────── */
function intercalarDestacados<T>(pagados: T[], organicos: T[]): T[] {
  const result: T[] = []
  let pi = 0, oi = 0
  while (pi < pagados.length || oi < organicos.length) {
    if (pi < pagados.length) result.push(pagados[pi++])
    for (let i = 0; i < 4 && oi < organicos.length; i++) result.push(organicos[oi++])
  }
  return result
}

/* ─── Página principal ───────────────────────────────────────────── */
export default function Home() {
  const { autenticado } = useAuth()
  const [filtroActivo, setFiltroActivo] = useState<string>('todos')
  const [recomendados, setRecomendados] = useState<Producto[]>([])
  const [cargando, setCargando] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [destacados, setDestacados] = useState<Producto[]>([])
  const [destHome, setDestHome] = useState<Producto[]>([])
  const [destHomeEtiquetas, setDestHomeEtiquetas] = useState<Map<string, string>>(new Map())
  // Map: productoId (string) -> etiqueta del sello publicitario.
  const [destCatalogo, setDestCatalogo] = useState<Map<string, string>>(new Map())
  const [hoteles, setHoteles] = useState<ConfigHotel[]>([])

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

      // Todos los productos para la sección de más vendidos
      try {
        const { items } = await listarProductos({ porPagina: 50 })
        if (!cancelado) setDestacados(mapearProductos(items))
      } catch {
        if (!cancelado) setDestacados([])
      }

      // Hoteles activos para la sección de turismo
      try {
        const hotelesData = await listarHoteles()
        if (!cancelado) setHoteles(hotelesData)
      } catch {
        if (!cancelado) setHoteles([])
      }

      // Visibilidades pagadas activas (HOME_DESTACADO y CATALOGO)
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')
        const r = await fetch(`${API_URL}/productos/destacados`)
        if (r.ok) {
          const j = await r.json()
          const visibilidades: VisibilidadActiva[] = Array.isArray(j.items) ? j.items : []
          const homeProds = visibilidades
            .filter((v): v is VisibilidadActiva & { producto: ProductoCrudo } => (
              v.tipo === 'HOME_DESTACADO' && visibilidadConProducto(v)
            ))
            .map(v => v.producto)
          const catalogoMap = new Map<string, string>(
            visibilidades
              .filter((v): v is VisibilidadActiva & { producto: ProductoCrudo } => (
                v.tipo === 'CATALOGO' && visibilidadConProducto(v)
              ))
              .map(v => [String(v.producto.id), v.etiqueta?.trim() || 'Patrocinado'] as [string, string])
          )
          const homeEtiquetas = new Map<string, string>(
            visibilidades
              .filter((v): v is VisibilidadActiva & { producto: ProductoCrudo } => (
                v.tipo === 'HOME_DESTACADO' && visibilidadConProducto(v)
              ))
              .map(v => [String(v.producto.id), v.etiqueta?.trim() || 'Patrocinado'] as [string, string])
          )
          if (!cancelado) {
            setDestHome(mapearProductos(homeProds.filter(Boolean) as ProductoCrudo[]))
            setDestHomeEtiquetas(homeEtiquetas)
            setDestCatalogo(catalogoMap)
          }
        }
      } catch {
        if (!cancelado) { setDestHome([]); setDestCatalogo(new Map()) }
      }
    }

    cargarInicial()
    listarProductos({ porPagina: 24 })
      .then(({ items }) => {
        if (!cancelado) setProductos(mapearProductos(items))
      })
      .catch((e) => {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar los productos.')
          setProductos([])
        }
      })
      .finally(() => { if (!cancelado) setCargando(false) })

    return () => {
      cancelado = true
    }
  }, [])

  // Recomendaciones personalizadas (solo usuarios autenticados)
  useEffect(() => {
    if (!autenticado) return
    apiFetch<{ ok: boolean; data: unknown[] }>('/productos/recomendaciones?limite=8')
      .then((res) => {
        const data = Array.isArray(res?.data) ? (res.data as ProductoCrudo[]) : []
        setRecomendados(mapearProductos(data))
      })
      .catch(() => {})
  }, [autenticado])

  function handleFiltroChange(filtro: string) {
    setFiltroActivo(filtro)
    cargarProductos(filtro)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">

        {/* Hero */}
        <HeroBanner productos={destacados} />

        {/* Categorías */}
        <SeccionCategorias />

        {/* Hoteles & Turismo */}
        <SeccionHoteles hoteles={hoteles} />

        {/* Mejores precios */}
        <SeccionOfertas productos={productos} />

        {/* Destacados */}
        <SeccionDestacados productos={destacados} destacadosPagados={destHome} etiquetasPagadas={destHomeEtiquetas} />


        {/* Para ti — recomendaciones personalizadas */}
        {autenticado && recomendados.length > 0 && (
          <section className="bg-white py-10">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="mb-6">
                <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-1">
                  Basado en tu historial
                </p>
                <h2
                  className="text-2xl md:text-3xl text-[#1A1A1A]"
                  style={{ fontFamily: 'var(--font-dm-serif)' }}
                >
                  Para ti
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {recomendados.map((p) => (
                  <TarjetaProducto key={p.id} producto={p} />
                ))}
              </div>
            </div>
          </section>
        )}

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

          {/* Grid — destacados intercalados: 1 pagado cada 4 orgánicos */}
          {!cargando && !error && productos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(() => {
                const MAX_PATROCINADOS_PCT = 0.15
                const maxPatrocinados = Math.max(1, Math.floor(productos.length * MAX_PATROCINADOS_PCT))
                const patrocinados = productos.filter(p => destCatalogo.has(p.id)).slice(0, maxPatrocinados)
                const organicos = productos.filter(p => !destCatalogo.has(p.id))
                return intercalarDestacados(patrocinados, organicos)
              })().map(producto => (
                <TarjetaProducto
                  key={producto.id}
                  producto={producto}
                  esDestacado={destCatalogo.has(producto.id)}
                  etiquetaDestacado={destCatalogo.get(producto.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
