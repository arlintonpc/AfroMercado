'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import VideoDestacado from '@/components/catalogo/VideoDestacado'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { mapearProductos } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'
import { listarReviewsTienda, type ReviewTienda } from '@/lib/api/reviewsTienda'
import { useAuth } from '@/context/AuthContext'
import { iniciarConversacion } from '@/lib/api/chat'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

interface ComercioPublico {
  id: number
  nombre: string
  descripcion?: string | null
  historia?: string | null
  municipio: string
  logoUrl?: string | null
  whatsapp?: string | null
  whatsappVisible: boolean
  videoUrl?: string | null
  videoPosterUrl?: string | null
  videoDuracionSegundos?: number | null
  videoMimeType?: string | null
  calificacion: string | number
  totalReviews: number
  totalVentas: number
  verificado: boolean
}

async function fetchComercio(id: string): Promise<ComercioPublico | null> {
  const r = await fetch(`${API_URL}/comercios/${id}`, { cache: 'no-store' })
  if (!r.ok) return null
  const j = await r.json()
  return j?.comercio ?? null
}

async function fetchProductos(comercioId: number): Promise<Producto[]> {
  const r = await fetch(`${API_URL}/productos?comercioId=${comercioId}&porPagina=50`, {
    cache: 'no-store',
  })
  if (!r.ok) return []
  const j = await r.json()
  return mapearProductos(j?.items ?? [])
}

// ── Estrellas ─────────────────────────────────────────────────

function Estrellas({ valor }: { valor: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= Math.round(valor) ? '#D4A017' : 'none'} stroke="#D4A017" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}

// ── Cabecera del comercio ─────────────────────────────────────

function CabeceraComercio({ c, onChatear }: { c: ComercioPublico; onChatear?: () => void }) {
  const cal = Number(c.calificacion)
  const mensajeWa = `Hola, vi tu tienda "${c.nombre}" en AfroMercado y me gustaría hacer un pedido.`
  const waUrl = c.whatsapp && c.whatsappVisible
    ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensajeWa)}`
    : null

  return (
    <section className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Logo o inicial */}
        {c.logoUrl ? (
          // La URL proviene del comercio y puede usar un host externo no conocido en build.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.logoUrl}
            alt={c.nombre}
            className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#52B788]/20 flex items-center justify-center flex-shrink-0">
            <span
              className="text-2xl font-bold text-[#2D6A4F]"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              {c.nombre.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-2xl text-[#1A1A1A]"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              {c.nombre}
            </h1>
            {c.verificado && (
              <span title="Comercio verificado" className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2D6A4F]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
          <p className="text-sm text-[#1A1A1A]/55 mt-0.5">📍 {c.municipio}, Chocó</p>

          {cal > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <Estrellas valor={cal} />
              <span className="text-sm text-[#1A1A1A]/60">
                {cal.toFixed(1)} · {c.totalReviews} {c.totalReviews === 1 ? 'reseña' : 'reseñas'}
              </span>
            </div>
          )}

          {c.totalVentas > 0 && (
            <p className="text-xs text-[#1A1A1A]/40 mt-1">
              {c.totalVentas} {c.totalVentas === 1 ? 'pedido completado' : 'pedidos completados'}
            </p>
          )}
        </div>
      </div>

      {c.descripcion && (
        <p className="mt-4 text-sm text-[#1A1A1A]/70 leading-relaxed">{c.descripcion}</p>
      )}

      {c.historia && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm font-semibold text-[#2D6A4F] list-none flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="transition-transform group-open:rotate-90">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Nuestra historia
          </summary>
          <p className="mt-2 text-sm text-[#1A1A1A]/70 leading-relaxed pl-5">{c.historia}</p>
        </details>
      )}

      {(waUrl || onChatear) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Contactar por WhatsApp
            </a>
          )}
          {onChatear && (
            <button
              onClick={onChatear}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Chatear con el comercio
            </button>
          )}
        </div>
      )}

      {c.videoUrl && (
        <VideoDestacado
          className="mt-4 border-[#2D6A4F]/10 bg-[#F8F5F0]"
          titulo="Video del comercio"
          descripcion="Un clip corto para conocer mejor la finca, la cocina o la experiencia de la tienda."
          src={c.videoUrl}
          poster={c.videoPosterUrl}
          duracionSegundos={c.videoDuracionSegundos}
          mimeType={c.videoMimeType}
        />
      )}
    </section>
  )
}

// ── Estrellas interactivas ────────────────────────────────────

// ── Iniciales del comprador ───────────────────────────────────

function Iniciales({ nombre }: { nombre: string }) {
  const partes = (nombre.trim() || 'Cliente').split(/\s+/)
  const letras =
    partes.length >= 2
      ? partes[0][0] + partes[1][0]
      : partes[0].slice(0, 2)
  return (
    <div className="w-9 h-9 rounded-full bg-[#52B788]/20 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-bold text-[#2D6A4F] uppercase">{letras}</span>
    </div>
  )
}

// ── Fecha relativa ────────────────────────────────────────────

function fechaRelativa(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(diff / 86400000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anos = Math.floor(meses / 12)
  return `Hace ${anos} ${anos === 1 ? 'año' : 'años'}`
}

// ── Sección de reseñas de tienda ──────────────────────────────

function SeccionResenas({ comercioId }: { comercioId: number }) {
  const [reviews, setReviews] = useState<ReviewTienda[]>([])
  const [promedio, setPromedio] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    listarReviewsTienda(comercioId)
      .then((d) => {
        if (!activo) return
        setReviews(Array.isArray(d.reviews) ? d.reviews : [])
        setPromedio(d.promedio ?? null)
        setTotal(Number(d.total ?? 0))
      })
      .catch(() => {})
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [comercioId])

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Reseñas de clientes</h2>

      {cargando ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 flex gap-3">
              <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 text-center text-sm text-[#1A1A1A]/45">
          Aún no hay reseñas para este comercio
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {promedio !== null && (
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 px-5 py-4 flex items-center gap-3">
              <span
                className="text-3xl font-bold text-[#1A1A1A]"
                style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
              >
                {promedio.toFixed(1)}
              </span>
              <div>
                <Estrellas valor={promedio} />
                <p className="text-xs text-[#1A1A1A]/45 mt-0.5">
                  {total} {total === 1 ? 'reseña' : 'reseñas'}
                </p>
              </div>
            </div>
          )}

          {reviews.map((r) => {
            const nombreComprador = r.comprador?.nombre?.trim() || 'Cliente'
            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 flex gap-3"
              >
                <Iniciales nombre={nombreComprador} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#1A1A1A]">
                      {nombreComprador}
                    </span>
                    <span className="text-xs text-[#1A1A1A]/40">{fechaRelativa(r.createdAt)}</span>
                  </div>
                  <Estrellas valor={Number(r.calificacion) || 0} />
                  {r.comentario && (
                    <p className="text-sm text-[#1A1A1A]/70 mt-1 leading-relaxed">{r.comentario}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function PaginaComercio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { usuario, autenticado } = useAuth()
  const [comercio, setComercio] = useState<ComercioPublico | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [reintentos, setReintentos] = useState(0)

  const esComprador = autenticado && usuario?.rol === 'COMPRADOR'
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)
  const [orden, setOrden] = useState<'recientes' | 'precio-asc' | 'precio-desc'>('recientes')

  async function handleChatear() {
    if (!comercio) return
    try {
      const conv = await iniciarConversacion(comercio.id)
      router.push(`/chat?c=${conv.id}`)
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga(null)
      setNoEncontrado(false)
      setComercio(null)
      setProductos([])

      // Si el backend no responde, no queremos dejar el skeleton infinito.
      // El estado final se resuelve siempre en este bloque.
      try {
        const c = await fetchComercio(id)
        if (!activo) return
        if (!c) {
          setNoEncontrado(true)
          return
        }
        setComercio(c)
        const prods = await fetchProductos(c.id)
        if (!activo) return
        setProductos(prods)
      } catch (err) {
        if (!activo) return
        console.error('Error cargando comercio:', err)
        setErrorCarga('No pudimos cargar esta tienda. Revisa tu conexión o intenta de nuevo en unos segundos.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [id, reintentos])

  // Extrae categorías únicas de los productos cargados
  const categoriasDisponibles = (() => {
    const mapa = new Map<string, string>()
    productos.forEach(p => {
      if (p.categoriaId && p.categoria?.nombre) {
        mapa.set(p.categoriaId, p.categoria.nombre)
      }
    })
    return Array.from(mapa.entries()).map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  })()

  const productosVisibles = (() => {
    let lista = categoriaFiltro
      ? productos.filter(p => p.categoriaId === categoriaFiltro)
      : productos

    if (orden === 'precio-asc') {
      lista = [...lista].sort((a, b) => (a.oferta?.precioFinal ?? a.precio) - (b.oferta?.precioFinal ?? b.precio))
    } else if (orden === 'precio-desc') {
      lista = [...lista].sort((a, b) => (b.oferta?.precioFinal ?? b.precio) - (a.oferta?.precioFinal ?? a.precio))
    }
    // 'recientes' mantiene el orden original del API

    return lista
  })()

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-8 pb-12">
        {cargando ? (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 flex gap-4">
              <Skeleton className="w-16 h-16 rounded-2xl flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-7 w-48 mb-2" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : errorCarga ? (
          comercio ? (
            <div className="flex flex-col gap-6">
              <CabeceraComercio c={comercio} onChatear={esComprador ? handleChatear : undefined} />
              <EmptyState
                titulo="No se pudo cargar la tienda"
                descripcion={errorCarga}
                onReintentar={() => setReintentos((n) => n + 1)}
              >
                <Link href="/" className="mt-2 text-sm text-[#2D6A4F] font-semibold hover:underline">
                  Volver al inicio
                </Link>
              </EmptyState>
            </div>
          ) : (
            <EmptyState
              titulo="No se pudo cargar la tienda"
              descripcion={errorCarga}
              onReintentar={() => setReintentos((n) => n + 1)}
            >
              <Link href="/" className="mt-2 text-sm text-[#2D6A4F] font-semibold hover:underline">
                Volver al inicio
              </Link>
            </EmptyState>
          )
        ) : noEncontrado || !comercio ? (
          <EmptyState
            titulo="Comercio no encontrado"
            descripcion="Este comercio no existe o ya no está disponible."
          >
            <Link href="/" className="mt-2 text-sm text-[#2D6A4F] font-semibold hover:underline">
              Explorar productos
            </Link>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            <CabeceraComercio c={comercio} onChatear={esComprador ? handleChatear : undefined} />

            <div>
              {/* Encabezado con conteo y ordenar */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <h2 className="text-lg font-semibold text-[#1A1A1A]">
                  Productos de {comercio.nombre}
                  <span className="ml-2 text-sm font-normal text-[#1A1A1A]/40">
                    ({productosVisibles.length})
                  </span>
                </h2>
                {productos.length > 1 && (
                  <select
                    value={orden}
                    onChange={e => setOrden(e.target.value as typeof orden)}
                    className="text-sm border border-[#1A1A1A]/15 rounded-xl px-3 py-1.5 bg-white text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 cursor-pointer"
                  >
                    <option value="recientes">Más recientes</option>
                    <option value="precio-asc">Precio: menor a mayor</option>
                    <option value="precio-desc">Precio: mayor a menor</option>
                  </select>
                )}
              </div>

              {/* Tabs de categorías */}
              {categoriasDisponibles.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  <button
                    onClick={() => setCategoriaFiltro(null)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                      categoriaFiltro === null
                        ? 'bg-[#2D6A4F] text-white'
                        : 'bg-white border border-[#1A1A1A]/12 text-[#1A1A1A]/60 hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]'
                    }`}
                  >
                    Todas
                  </button>
                  {categoriasDisponibles.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoriaFiltro(cat.id)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                        categoriaFiltro === cat.id
                          ? 'bg-[#2D6A4F] text-white'
                          : 'bg-white border border-[#1A1A1A]/12 text-[#1A1A1A]/60 hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]'
                      }`}
                    >
                      {cat.nombre}
                    </button>
                  ))}
                </div>
              )}

              {/* Grid de productos */}
              {productos.length === 0 ? (
                <EmptyState
                  titulo="Sin productos disponibles"
                  descripcion="Este comercio aún no tiene productos publicados o están agotados."
                />
              ) : productosVisibles.length === 0 ? (
                <EmptyState
                  titulo="Sin productos en esta categoría"
                  descripcion="Prueba seleccionando otra categoría o mira todos los productos."
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {productosVisibles.map((p) => (
                    <TarjetaProducto key={p.id} producto={p} />
                  ))}
                </div>
              )}
            </div>

            <SeccionResenas comercioId={comercio.id} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
