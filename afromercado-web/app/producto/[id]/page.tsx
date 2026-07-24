'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import ProductoGaleria from '@/components/catalogo/ProductoGaleria'
import VideoDestacado from '@/components/catalogo/VideoDestacado'
import EstimadorEnvio from '@/components/catalogo/EstimadorEnvio'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonText } from '@/components/ui/Skeleton'
import { obtenerProducto } from '@/lib/api/productos'
import {
  mapearProducto,
  obtenerWhatsapp,
  type ProductoCrudo,
} from '@/lib/mapearProducto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { precioVigente } from '@/lib/precioProducto'
import { useCarrito } from '@/context/CarritoContext'
import { useFavoritos } from '@/context/FavoritoContext'
import BadgeProductorCertificado from '@/components/ui/BadgeProductorCertificado'
import BadgeVendedorVerificado from '@/components/ui/BadgeVendedorVerificado'
import InsigniasTerritoriales from '@/components/ui/InsigniasTerritoriales'
import { useAuth } from '@/context/AuthContext'
import { apiFetch } from '@/lib/api/client'
import { obtenerMenuComercioExpress, type MenuComercioExpress } from '@/lib/api/express'
import { SeccionResenas } from '@/components/reviews/SeccionResenas'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import ModalDenunciarProducto from '@/components/catalogo/ModalDenunciarProducto'
import { mapearProductos } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'
import { Toast, useToast } from '@/components/ui/Toast'

// ——— Gradientes (mismo patrón que TarjetaProducto) ———
const GRADIENTES = [
  'from-[#1a3a2a] to-[#2D6A4F]',
  'from-[#2D6A4F] to-[#1a4a35]',
  'from-[#1d4a2a] to-[#3a7a50]',
  'from-[#0f2a1a] to-[#2D6A4F]',
]

// ——— Acordeón ———
function Acordeon({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="border-b border-[#1A1A1A]/10">
      <button
        className="w-full flex items-center justify-between py-4 text-left font-semibold text-[#1A1A1A] hover:text-[#2D6A4F] transition-colors"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span>{titulo}</span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`flex-shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {abierto && (
        <div className="pb-4 text-[#1A1A1A]/70 text-sm leading-relaxed">{children}</div>
      )}
    </div>
  )
}

// ——— Skeleton de la página de detalle ———
function DetalleSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-8">
          <div className="md:grid md:grid-cols-2 md:gap-10 lg:gap-16">
            {/* Imagen */}
            <div className="skeleton w-full rounded-2xl aspect-[4/3] mb-6 md:mb-0" />
            {/* Info */}
            <div className="flex flex-col gap-4">
              <div className="skeleton h-6 w-24 rounded-full" />
              <div className="skeleton h-10 w-3/4 rounded" />
              <div className="skeleton h-5 w-1/2 rounded" />
              <div className="skeleton h-12 w-40 rounded" />
              <div className="h-px bg-[#1A1A1A]/10" />
              <div className="skeleton h-10 w-48 rounded" />
              <div className="skeleton h-14 w-full rounded-2xl" />
              <SkeletonText lines={2} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

// ——— Página ———
export default function PaginaProducto({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { agregar } = useCarrito()
  const { toggle: toggleFav, esFavorito } = useFavoritos()
  const { autenticado } = useAuth()
  const { mostrar: mostrarToast, toastProps } = useToast()

  const [producto, setProducto] = useState<Producto | null>(null)
  const [recomendados, setRecomendados] = useState<Producto[]>([])
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noEncontrado, setNoEncontrado] = useState(false)

  const [masDeTienda, setMasDeTienda] = useState<Producto[]>([])
  const [cargandoTienda, setCargandoTienda] = useState(false)

  const [menuExpress, setMenuExpress] = useState<MenuComercioExpress | null>(null)

  const [cantidad, setCantidad] = useState(1)
  const [agregando, setAgregando] = useState(false)
  const [agregado, setAgregado] = useState(false)
  const [mostrarModalDenuncia, setMostrarModalDenuncia] = useState(false)
  const [denunciaEnviada, setDenunciaEnviada] = useState(false)
  const [historiaExpandida, setHistoriaExpandida] = useState(false)

  // Carga del producto desde la API.
  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      setNoEncontrado(false)
      try {
        const crudo = (await obtenerProducto(id)) as unknown as ProductoCrudo
        if (cancelado) return
        if (!crudo || crudo.id === undefined || crudo.id === null) {
          setNoEncontrado(true)
          return
        }
        const mapeado = mapearProducto(crudo)
        setProducto(mapeado)
        setWhatsapp(obtenerWhatsapp(crudo))
        if (mapeado.esExpress && crudo.comercioId) {
          obtenerMenuComercioExpress(Number(crudo.comercioId)).then(setMenuExpress)
        }
      } catch (e) {
        if (cancelado) return
        const msg = e instanceof Error ? e.message : ''
        // El backend devuelve 404 → apiFetch lanza Error con su mensaje.
        if (/no encontrado|not found|404/i.test(msg)) {
          setNoEncontrado(true)
        } else {
          setError(msg || 'No se pudo cargar el producto.')
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()

    // Registra vista (deduplicada 4h) con JWT para personalización
    const sesionId = (() => {
      try {
        let sid = sessionStorage.getItem('afm_sid')
        if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem('afm_sid', sid) }
        return sid
      } catch { return undefined }
    })()
    apiFetch(`/productos/${id}/vista`, { method: 'POST', body: { sesionId } }).catch(() => {})

    // Cargar recomendaciones basadas en historial
    apiFetch<{ ok: boolean; data: unknown[] }>('/productos/recomendaciones?limite=4')
      .then((res) => {
        const data = Array.isArray(res?.data) ? (res.data as ProductoCrudo[]) : []
        setRecomendados(mapearProductos(data))
      })
      .catch(() => {})

    return () => {
      cancelado = true
    }
  }, [id])

  useEffect(() => {
    if (producto?.nombre) {
      document.title = `${producto.nombre} — Teravia`
    }
    return () => { document.title = 'Teravia' }
  }, [producto?.nombre])

  useEffect(() => {
    if (!producto?.comercioId) return
    let activo = true
    setCargandoTienda(true)
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')}/productos?comercioId=${producto.comercioId}&porPagina=8`
    fetch(url)
      .then(r => r.json())
      .then(j => {
        if (!activo) return
        const todos = mapearProductos(j?.items ?? [])
        setMasDeTienda(todos.filter(p => p.id !== producto.id).slice(0, 4))
      })
      .catch(() => {})
      .finally(() => { if (activo) setCargandoTienda(false) })
    return () => { activo = false }
  }, [producto?.comercioId, producto?.id])

  // Estado: cargando → skeleton de la página completa.
  if (cargando) {
    return <DetalleSkeleton />
  }

  // Estado: no encontrado.
  if (noEncontrado || (!producto && !error)) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center">
          <EmptyState
            titulo="Producto no encontrado"
            descripcion="Este producto no existe o ya no está disponible en Teravia."
          />
          <Link
            href="/"
            className="mt-2 inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors"
          >
            Volver al catálogo
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  // Estado: error de carga (red / servidor).
  if (error || !producto) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center">
          <EmptyState
            titulo="No pudimos cargar el producto"
            descripcion={error ?? 'Ocurrió un error inesperado.'}
            onReintentar={() => {
              // Forzar recarga repitiendo el efecto vía cambio de estado.
              setCargando(true)
              setError(null)
              obtenerProducto(id)
                .then((crudo) => {
                  const c = crudo as unknown as ProductoCrudo
                  setProducto(mapearProducto(c))
                  setWhatsapp(obtenerWhatsapp(c))
                })
                .catch((e) =>
                  setError(e instanceof Error ? e.message : 'No se pudo cargar el producto.'),
                )
                .finally(() => setCargando(false))
            }}
          />
        </main>
        <Footer />
      </div>
    )
  }

  const stockDisponible = Math.max(0, producto.stock - (producto.stockReservado ?? 0))
  const cupoTemporada =
    producto.oferta?.stockLimite !== null && producto.oferta?.stockLimite !== undefined
      ? Math.max(0, producto.oferta.stockLimite - producto.oferta.stockUsado)
      : stockDisponible
  const disponible = Math.min(stockDisponible, cupoTemporada)
  const precioActual = precioVigente(producto)
  const descuentoPct = producto.oferta
    ? producto.oferta.tipo === 'PORCENTAJE'
      ? Math.round(producto.oferta.valor)
      : Math.round(((producto.precio - producto.oferta.precioFinal) / producto.precio) * 100)
    : 0
  const gradiente = GRADIENTES[producto.nombre.length % GRADIENTES.length]
  // Galería: foto principal + imágenes adicionales (sin duplicar la principal).
  const galeria = (producto.fotoUrl ? [producto.fotoUrl] : []).concat(
    (producto.imagenes ?? []).filter((u) => u && u !== producto.fotoUrl),
  )
  const videoUrl = producto.videoUrl ?? producto.comercio.videoUrl ?? null
  const videoPosterUrl = producto.videoPosterUrl ?? producto.comercio.videoPosterUrl ?? null
  const videoDuracion = producto.videoDuracionSegundos ?? producto.comercio.videoDuracionSegundos ?? null
  const videoMimeType = producto.videoMimeType ?? producto.comercio.videoMimeType ?? null
  const historia = producto.historia ?? producto.comercio.historia

  function decrementar() {
    setCantidad((v) => Math.max(1, v - 1))
  }
  function incrementar() {
    setCantidad((v) => Math.min(disponible, v + 1))
  }

  async function handleAgregar() {
    if (!producto || agregando) return
    setAgregando(true)
    try {
      await agregar(producto, cantidad)
      setAgregado(true)
      setTimeout(() => setAgregado(false), 2000)
    } catch {
      // El carrito hace fallback a local; aun así mostramos confirmación.
      setAgregado(true)
      setTimeout(() => setAgregado(false), 2000)
    } finally {
      setAgregando(false)
    }
  }

  // Estado Express: abierto/cerrado y próxima apertura
  const expressAbierto = menuExpress?.abiertoAhora ?? false
  const proximaApertura = (() => {
    if (!menuExpress?.horarios?.length || expressAbierto) return null
    const DIAS = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO']
    const ahora = new Date()
    for (let i = 1; i <= 7; i++) {
      const d = new Date(ahora)
      d.setDate(ahora.getDate() + i)
      const diaEnum = DIAS[d.getDay()]
      const h = menuExpress.horarios.find(h => h.dia === diaEnum && h.abierto)
      if (h) {
        const esManana = i === 1
        return `${esManana ? 'Mañana' : DIAS[d.getDay()].charAt(0) + DIAS[d.getDay()].slice(1).toLowerCase()} a las ${h.apertura}`
      }
    }
    return null
  })()

  // Enlace de WhatsApp: solo se construye si hay número Y el comercio tiene whatsappVisible activo.
  const mensajeWa = `Hola, me interesa el producto "${producto.nombre}" de ${producto.comercio.nombre} en Teravia`
  const enlaceWa = whatsapp && producto.comercio.whatsappVisible
    ? `https://wa.me/57${whatsapp}?text=${encodeURIComponent(mensajeWa)}`
    : null

  // Mismo patron ya usado en Tours/Hoteles/Transportes: navigator.share abre
  // el panel nativo del sistema (WhatsApp, Instagram, correo, SMS...) en vez
  // de limitar a un solo canal; si el navegador no lo soporta, copia el enlace.
  async function handleCompartir() {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: producto!.nombre, url }) } catch { /* usuario cancelo */ }
    } else {
      navigator.clipboard.writeText(url).catch(() => {})
      mostrarToast('¡Enlace copiado!')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 pb-24 md:pb-0">

        {/* BREADCRUMB */}
        <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-4 pb-2">
          <p className="text-xs text-[#1A1A1A]/40 truncate">
            <Link href="/" className="hover:text-[#2D6A4F] transition-colors">Teravia</Link>
            {' / '}
            <Link href="/" className="hover:text-[#2D6A4F] transition-colors">Catálogo</Link>
            {' / '}
            <span className="text-[#1A1A1A]/60">{producto.nombre}</span>
          </p>
        </div>

        {/* CONTENIDO PRINCIPAL: Layout Sticky 12 columnas */}
        <div className="max-w-7xl mx-auto w-full px-4 md:px-6 py-4">
          <div className="lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start">

            {/* ——— COLUMNA IZQUIERDA (7 cols): Galería, Productor, Acordeones, Reseñas ——— */}
            <div className="lg:col-span-7 flex flex-col gap-10 mb-8 lg:mb-0">
              
              {/* GALERÍA */}
              <div className="rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#1B4332]/5 bg-white border border-[#1A1A1A]/5">
                <ProductoGaleria
                  imagenes={galeria}
                  nombre={producto.nombre}
                  productoId={producto.id}
                  gradiente={gradiente}
                />
                {videoUrl && (
                  <div className="p-4 md:p-8">
                    <VideoDestacado
                      titulo={producto.videoUrl ? 'Video del producto' : 'Video del comercio'}
                      descripcion={
                        producto.videoUrl
                          ? 'Un clip corto para mostrar el producto en uso o en contexto.'
                          : 'Un vistazo rapido al comercio, la finca o la experiencia detras del producto.'
                      }
                      src={videoUrl}
                      poster={videoPosterUrl}
                      duracionSegundos={videoDuracion}
                      mimeType={videoMimeType}
                    />
                  </div>
                )}
              </div>

              {/* SECCIÓN "EL PRODUCTOR" */}
              <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-[#1A1A1A]/5 shadow-2xl shadow-[#1B4332]/5 p-8 flex flex-col gap-6">
                <h2 className="text-lg font-bold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                  El productor
                </h2>

                {(producto.comercio.verificado || producto.comercio.verificadoEtnico) && (
                  <div className="flex flex-wrap gap-2">
                    {producto.comercio.verificado && (
                      producto.categoria?.grupo === 'LOCAL'
                        ? <BadgeVendedorVerificado verificado size="md" />
                        : <BadgeProductorCertificado size="md" variante="base" />
                    )}
                    <InsigniasTerritoriales
                      verificado={!!producto.comercio.verificado}
                      origenChoco={producto.comercio.departamento === 'Chocó'}
                      tamaño="sm"
                    />
                    {producto.comercio.verificadoEtnico && (
                      <BadgeProductorCertificado size="md" variante="etnico" />
                    )}
                  </div>
                )}

                {producto.comercio.comprableEnPlataforma === false && (
                  <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold px-3 py-1.5">
                    🤝 Vende por contacto directo — coordina el pago al recibir
                  </span>
                )}

                <div>
                  {producto.comercioId
                    ? <Link href={`/comercio/${producto.comercioId}`}
                        className="font-bold text-[#1A1A1A] text-base hover:text-[#2D6A4F] transition-colors">
                        {producto.comercio.nombre}
                      </Link>
                    : <p className="font-bold text-[#1A1A1A] text-base">{producto.comercio.nombre}</p>
                  }
                  <p className="text-sm text-[#1A1A1A]/50 flex items-center gap-1 mt-0.5">
                    📍 {producto.comercio.municipio}
                  </p>
                </div>

                {producto.comercio.totalVentas > 0 ? (
                  <p className="text-sm text-[#1A1A1A]/60 flex items-center gap-1.5">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18" />
                      <path d="M16 10a4 4 0 01-8 0" />
                    </svg>
                    {producto.comercio.totalVentas} pedidos completados
                  </p>
                ) : (
                  <p className="text-sm text-[#1A1A1A]/60 italic">
                    Vendedor verificado — Sé el primero en comprar
                  </p>
                )}

                {historia && (
                  <div>
                    <p className={`text-sm text-[#1A1A1A]/70 leading-relaxed ${historiaExpandida ? '' : 'line-clamp-3'}`}>
                      {historia}
                    </p>
                    {historia.length > 160 && (
                      <button
                        onClick={() => setHistoriaExpandida((v) => !v)}
                        aria-expanded={historiaExpandida}
                        className="text-xs text-[#2D6A4F] font-semibold mt-1 hover:underline"
                      >
                        {historiaExpandida ? 'Leer menos' : 'Leer más'}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {enlaceWa && (
                    <a
                      href={enlaceWa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-start flex items-center gap-2 bg-[#52B788] hover:bg-[#3da070] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px]"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      Contactar por WhatsApp
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleCompartir}
                    className="self-start flex items-center gap-2 bg-[#F8F5F0] border border-[#1A1A1A]/15 hover:border-[#2D6A4F]/40 text-[#2D6A4F] text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    Compartir
                  </button>
                  {producto.comercioId && (
                    <Link
                      href={`/comercio/${producto.comercioId}`}
                      className="self-start flex items-center gap-2 bg-[#F8F5F0] border border-[#1A1A1A]/15 hover:border-[#2D6A4F]/40 text-[#2D6A4F] text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Explorar tienda
                    </Link>
                  )}
                </div>
              </div>

              {/* DETALLES DEL PRODUCTO (Acordeón) */}
              <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-[#1A1A1A]/5 shadow-2xl shadow-[#1B4332]/5 px-8 py-2">
                <Acordeon titulo="Descripción">
                  {producto.descripcion
                    ? <p>{producto.descripcion}</p>
                    : <p className="italic text-[#1A1A1A]/40">Sin descripción disponible.</p>
                  }
                </Acordeon>
                <Acordeon titulo="Información de envío">
                  <p>
                    Este producto requiere entre <strong>{producto.diasAlistamientoMin} y {producto.diasAlistamientoMax} días</strong> de alistamiento.
                    El productor prepara tu pedido con dedicación artesanal una vez Teravia verifica tu pago.
                    El envío se coordina directamente desde {producto.comercio.municipio}.
                  </p>
                </Acordeon>
                <Acordeon titulo="Garantía">
                  <p>
                    Si tu pedido no llega en buen estado, Teravia te ayuda a resolverlo.
                    Escríbenos al WhatsApp de soporte y gestionaremos una solución contigo.
                  </p>
                </Acordeon>
              </div>

              {/* RESEÑAS */}
              <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-[#1A1A1A]/5 shadow-2xl shadow-[#1B4332]/5 p-8">
                <SeccionResenas productoId={Number(producto.id)} />
              </div>

            </div>

            {/* ——— COLUMNA DERECHA (5 cols): Buy Box Sticky ——— */}
            <div className="lg:col-span-5 sticky top-24 z-10">
              <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] border border-[#1A1A1A]/5 shadow-2xl shadow-[#1B4332]/10 p-6 md:p-8 flex flex-col gap-5">
                
                {/* 1. Badge categoría */}
                <span className="self-start bg-[#52B788]/15 text-[#2D6A4F] text-xs font-semibold px-3 py-1.5 rounded-full">
                  {producto.comercio.municipio}
                </span>

                {/* 2. Nombre + favorito */}
                <div className="flex items-start gap-3">
                  <h1
                    className="flex-1 text-3xl md:text-[2.75rem] text-[#1B4332] leading-[1.1] tracking-tight font-medium"
                    style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
                  >
                    {producto.nombre}
                  </h1>
                  {autenticado && (
                    <button
                      onClick={() => toggleFav(Number(producto.id))}
                      aria-label={esFavorito(Number(producto.id)) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                      className="mt-1 w-12 h-12 flex items-center justify-center rounded-[1rem] border border-[#1A1A1A]/10 bg-white shadow-sm hover:shadow-md hover:border-[#1B4332]/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all shrink-0"
                    >
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill={esFavorito(Number(producto.id)) ? '#2D6A4F' : 'none'} stroke={esFavorito(Number(producto.id)) ? '#2D6A4F' : '#1A1A1A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* 3. Municipio + alcance */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-[#1A1A1A]/60 flex items-center gap-1">
                    📍 {producto.comercio.municipio}
                  </span>
                  {(producto.alcance === 'NACIONAL' || producto.alcance === 'AMBOS') && (
                    <span className="bg-[#D4A017]/20 text-[#9B7300] text-xs font-bold px-2.5 py-1 rounded-full border border-[#D4A017]/30">
                      Envío nacional
                    </span>
                  )}
                </div>

                {/* 4. Precio */}
                <div>
                  {producto.oferta ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="inline-flex items-center rounded-full bg-[#2D6A4F]/10 px-2.5 py-1 text-xs font-bold text-[#2D6A4F]">
                          Temporada Teravia
                        </span>
                        <span className="inline-flex items-center rounded-full bg-[#2D6A4F] px-2.5 py-1 text-xs font-bold text-white">
                          -{descuentoPct}%
                        </span>
                      </div>
                      <p className="text-sm text-[#1A1A1A]/40 line-through">
                        {formatearPrecio(producto.precio)}
                      </p>
                      <p className="text-[2.5rem] font-bold text-[#1B4332] leading-none tracking-tight">{formatearPrecio(precioActual)}</p>
                    </>
                  ) : (
                    <p className="text-[2.5rem] font-bold text-[#1B4332] leading-none tracking-tight">{formatearPrecio(producto.precio)}</p>
                  )}
                  <p className="text-sm text-[#1A1A1A]/50 mt-1 font-medium">por {producto.unidad}</p>
                </div>

                {/* 5. Separador */}
                <div className="h-px bg-[#1A1A1A]/10 my-1" />

                {/* 6. Selector cantidad */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#1A1A1A]/70">Cantidad</span>
                  <div className="flex items-center bg-[#F8F5F0] rounded-2xl p-1 border border-[#1A1A1A]/5 shadow-inner">
                    <button
                      onClick={decrementar}
                      disabled={cantidad <= 1}
                      className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#1A1A1A] disabled:opacity-30 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all"
                      aria-label="Reducir cantidad"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <span className="w-14 h-10 flex items-center justify-center font-bold text-lg text-[#1A1A1A]">
                      {cantidad}
                    </span>
                    <button
                      onClick={incrementar}
                      disabled={cantidad >= disponible}
                      className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#1A1A1A] disabled:opacity-30 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all"
                      aria-label="Aumentar cantidad"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="text-right -mt-2 mb-2">
                  {disponible === 0 ? (
                    <span className="text-xs font-medium text-[#C0392B]">Sin stock</span>
                  ) : disponible <= 10 ? (
                    <span className="text-xs font-medium text-[#B7800A]">Solo quedan {disponible}</span>
                  ) : (
                    <span className="text-xs text-[#1A1A1A]/40">{disponible} disponibles</span>
                  )}
                </div>

                {/* 7. Botón principal */}
                {producto.esExpress && producto.comercioId ? (
                  <div className="space-y-3">
                    {expressAbierto ? (
                      <Link
                        href={`/express/${producto.comercioId}`}
                        className="w-full min-h-[56px] font-bold text-[1.05rem] rounded-[1.25rem] bg-[#D4A017] hover:bg-[#c09315] text-[#1A1A1A] shadow-lg shadow-[#D4A017]/30 hover:shadow-xl hover:shadow-[#D4A017]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        ⚡ Pedir ahora
                        {producto.tiempoEntregaMin && (
                          <span className="text-sm font-normal opacity-75">· {producto.tiempoEntregaMin} min</span>
                        )}
                      </Link>
                    ) : menuExpress !== null ? (
                      <div className="w-full min-h-[56px] rounded-2xl bg-[#F0EBE3] border border-[#E8DCC8] flex flex-col items-center justify-center gap-0.5 px-4 py-3">
                        <span className="font-bold text-[#666] text-base">🔴 Restaurante cerrado</span>
                        {proximaApertura && (
                          <span className="text-sm text-[#999]">Abre {proximaApertura}</span>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={`/express/${producto.comercioId}`}
                        className="w-full min-h-[56px] font-bold text-[1.05rem] rounded-[1.25rem] bg-[#D4A017] hover:bg-[#c09315] text-[#1A1A1A] shadow-lg shadow-[#D4A017]/30 hover:shadow-xl hover:shadow-[#D4A017]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        ⚡ Ver menú Express
                      </Link>
                    )}
                  </div>
                ) : producto.comercio.comprableEnPlataforma === false ? (
                  enlaceWa ? (
                    <a
                      href={enlaceWa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[56px] font-bold text-[1.05rem] rounded-[1.25rem] bg-[#25D366] hover:bg-[#1ebe5a] text-white shadow-lg shadow-[#25D366]/30 hover:shadow-xl hover:shadow-[#25D366]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      Contactar por WhatsApp
                    </a>
                  ) : (
                    <div className="w-full min-h-[56px] rounded-[1.25rem] bg-[#F0EBE3] border border-[#E8DCC8] flex items-center justify-center px-4 text-sm text-[#666] text-center">
                      Este vendedor vende con contacto directo — visita su perfil para conocer cómo comunicarte.
                    </div>
                  )
                ) : (
                  <button
                    onClick={handleAgregar}
                    disabled={agregando || disponible <= 0}
                    aria-busy={agregando}
                    className={`w-full min-h-[56px] font-bold text-[1.05rem] rounded-[1.25rem] transition-all duration-200 flex items-center justify-center gap-2 ${
                      agregado
                        ? 'bg-[#1B4332] text-white shadow-lg shadow-[#1B4332]/30'
                        : 'bg-[#D4A017] hover:bg-[#c09315] text-[#1A1A1A] shadow-lg shadow-[#D4A017]/30 hover:shadow-xl hover:shadow-[#D4A017]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                    } disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100 disabled:hover:shadow-none`}
                  >
                    {agregado ? (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        Agregado al pedido
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {agregando ? 'Agregando…' : 'Agregar al pedido'}
                      </>
                    )}
                  </button>
                )}

                {/* 8. Aviso de seguridad */}
                {producto.comercio.comprableEnPlataforma === false && (
                  <div className="flex items-start gap-2.5 rounded-[1.25rem] border border-[#D4A017]/25 bg-[#D4A017]/8 px-4 py-3 mt-2">
                    <span className="text-base leading-none" aria-hidden="true">⚠️</span>
                    <p className="text-xs leading-relaxed text-[#6B4E0D]">
                      <span className="font-semibold">Comprador:</span> nunca pagues por adelantado sin conocer el producto. Acuerda el pago al recibir.
                    </p>
                  </div>
                )}

                {/* 9. Nota de alistamiento o Express */}
                <div className="mt-2 space-y-4">
                  {producto.esExpress ? (
                    <p className={`text-sm flex items-center gap-1.5 font-medium ${expressAbierto ? 'text-[#D4A017]' : 'text-[#999]'}`}>
                      <span>⚡</span>
                      {expressAbierto
                        ? `Pedido Express · Listo en ~${producto.tiempoEntregaMin ?? 20} minutos`
                        : proximaApertura
                          ? `Abre ${proximaApertura}`
                          : 'Servicio Express · Ver horarios en el menú'}
                    </p>
                  ) : (
                    <p className="text-sm text-[#1A1A1A]/60 flex items-center gap-1.5 font-medium">
                      <span>⏱</span>
                      Listo en {producto.diasAlistamientoMin}–{producto.diasAlistamientoMax} días
                    </p>
                  )}

                  {/* 10. Estimador de envío */}
                  <EstimadorEnvio pesoKg={producto.pesoKg} />
                </div>

                {/* 11. Reportar producto */}
                {autenticado && (
                  <div className="mt-2 text-center">
                    {denunciaEnviada ? (
                      <span className="text-xs font-medium text-[#1A1A1A]/35">Ya reportaste este producto</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMostrarModalDenuncia(true)}
                        className="text-xs font-medium text-[#1A1A1A]/35 hover:text-[#C0392B] transition-colors underline-offset-2 hover:underline"
                      >
                        🚩 Reportar este producto
                      </button>
                    )}
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>

        {mostrarModalDenuncia && (
          <ModalDenunciarProducto
            productoId={Number(producto.id)}
            onCerrar={() => setMostrarModalDenuncia(false)}
            onExito={() => setDenunciaEnviada(true)}
          />
        )}

      </main>

      {/* MÁS DE ESTA TIENDA (Moved outside main grid) */}
      {masDeTienda.length > 0 && (
        <section className="max-w-7xl mx-auto w-full px-4 md:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium text-[#1B4332]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              Más de {producto.comercio.nombre}
            </h2>
            <Link
              href={`/comercio/${producto.comercioId}`}
              className="text-sm font-semibold text-[#2D6A4F] hover:underline flex items-center gap-1"
            >
              Ver tienda completa
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          {cargandoTienda ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[2rem] h-72 animate-pulse shadow-sm" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {masDeTienda.map(p => (
                <TarjetaProducto key={p.id} producto={p} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ——— CTA STICKY MOBILE ——— */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#1A1A1A]/10 px-4 py-3 flex items-center justify-between gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <div>
          {producto.oferta && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#2D6A4F]">Temporada</p>
          )}
          <p className={`text-lg font-bold ${producto.oferta ? 'text-[#2D6A4F]' : 'text-[#1B4332]'}`}>
            {formatearPrecio(precioActual)}
          </p>
          <p className="text-xs text-[#1A1A1A]/40 font-medium">por {producto.unidad}</p>
        </div>
        {producto.comercio.comprableEnPlataforma === false ? (
          enlaceWa ? (
            <a
              href={enlaceWa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 min-h-[44px] px-6 font-bold text-sm rounded-xl bg-[#25D366] hover:bg-[#1ebe5a] text-white transition-colors flex items-center gap-1.5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Contactar
            </a>
          ) : (
            <span className="flex-shrink-0 text-xs text-[#1A1A1A]/40 max-w-[140px] leading-tight">
              Contacto directo — visita el perfil
            </span>
          )
        ) : (
          <button
            onClick={handleAgregar}
            disabled={agregando || disponible <= 0}
            aria-busy={agregando}
            className={`flex-shrink-0 min-h-[48px] px-6 font-bold text-[1.05rem] rounded-[1.25rem] transition-all flex items-center gap-1.5 ${
              agregado
                ? 'bg-[#1B4332] text-white shadow-lg shadow-[#1B4332]/30'
                : 'bg-[#D4A017] hover:bg-[#c09315] text-[#1A1A1A] shadow-lg shadow-[#D4A017]/30'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {agregado ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Agregado
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Agregar
              </>
            )}
          </button>
        )}
      </div>

      {/* También te puede gustar */}
      {recomendados.length > 0 && (
        <section className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 pb-12 mt-6 border-t border-[#1A1A1A]/5">
          <h2
            className="text-2xl font-medium text-[#1B4332] mb-6"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            También te puede gustar
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {recomendados
              .filter((p) => p.id !== producto.id)
              .slice(0, 4)
              .map((p) => (
                <TarjetaProducto key={p.id} producto={p} />
              ))}
          </div>
        </section>
      )}

      <Footer />
      <Toast {...toastProps} />
    </div>
  )
}
