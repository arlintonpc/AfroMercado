'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import ReproductorVideo, { detectar } from '@/components/comerciante/ReproductorVideo'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Video from 'yet-another-react-lightbox/plugins/video'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'

// Slide para videos de plataformas externas (YouTube/TikTok/Instagram/Facebook/Vimeo)
// que el plugin Video oficial no reproduce — se renderiza vía ReproductorVideo.
declare module 'yet-another-react-lightbox' {
  interface SlideTypes {
    externalVideo: { type: 'externalVideo'; src: string }
  }
}

interface ProductoGaleriaProps {
  imagenes: string[]
  nombre: string
  productoId: string
  /** Clases de gradiente para el placeholder cuando no hay imágenes. */
  gradiente: string
  comercioNombre?: string
  comercioVerificado?: boolean
  /** Video del producto o del comercio — se integra como un slide más del carrusel. */
  videoUrl?: string | null
  videoPoster?: string | null
  videoMimeType?: string | null
}

type Slide =
  | { tipo: 'foto'; url: string }
  | { tipo: 'video'; url: string }

/**
 * Galería de producto inspirada en e-commerce de alto nivel (Instagram/Airbnb/Amazon):
 * fotos y video comparten un mismo carrusel con contador (1/N), swipe táctil,
 * miniaturas e insignia de vendedor verificado. El visor a pantalla completa
 * (yet-another-react-lightbox) recorre los mismos slides con swipe y pellizco
 * para zoom.
 */
export default function ProductoGaleria({
  imagenes,
  nombre,
  productoId,
  gradiente,
  comercioNombre,
  comercioVerificado,
  videoUrl,
  videoPoster,
  videoMimeType,
}: ProductoGaleriaProps) {
  const fotos = imagenes.filter(Boolean)
  const slides: Slide[] = [
    ...fotos.map((url) => ({ tipo: 'foto' as const, url })),
    ...(videoUrl ? [{ tipo: 'video' as const, url: videoUrl }] : []),
  ]
  const haySlides = slides.length > 0

  const [activa, setActiva] = useState(0)
  const [errores, setErrores] = useState<Record<number, boolean>>({})
  const [lightbox, setLightbox] = useState(false)
  const [videoReproduciendo, setVideoReproduciendo] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const indiceValido = Math.min(activa, Math.max(0, slides.length - 1))
  const slideActual = slides[indiceValido] as Slide | undefined
  const esVideoActual = slideActual?.tipo === 'video'
  const videoEsExterno = videoUrl ? detectar(videoUrl).plataforma !== 'directo' : false

  // Slides para el visor a pantalla completa (yet-another-react-lightbox):
  // recorre fotos y video con swipe, pellizco para zoom y miniaturas nativas.
  const lightboxSlides = slides.map((s, i) => {
    if (s.tipo === 'foto') {
      return { type: 'image' as const, src: s.url, alt: `${nombre} — imagen ${i + 1}` }
    }
    if (videoEsExterno) {
      return { type: 'externalVideo' as const, src: s.url, thumbnail: videoPoster ?? undefined }
    }
    return {
      type: 'video' as const,
      poster: videoPoster ?? undefined,
      thumbnail: videoPoster ?? undefined,
      autoPlay: true,
      controls: true,
      playsInline: true,
      sources: [{ src: s.url, type: videoMimeType || 'video/mp4' }],
    }
  })

  // Navegación del carrusel principal — recorre fotos y video.
  function ir(delta: number) {
    setVideoReproduciendo(false)
    setActiva((i) => (i + delta + slides.length) % slides.length)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const deltaX = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(deltaX) > 40) ir(deltaX < 0 ? 1 : -1)
  }

  if (!haySlides) {
    return (
      <div className="w-full rounded-3xl overflow-hidden aspect-square sm:aspect-[4/3] relative ring-1 ring-[#1A1A1A]/5 shadow-sm bg-white">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradiente} flex flex-col items-center justify-center gap-3`}>
          <div className="relative z-10 w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
          <span className="relative z-10 text-white/70 text-sm font-medium">Sin imagen</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Contenedor principal: fotos y video comparten el mismo marco */}
      <div
        className="group relative w-full rounded-3xl overflow-hidden aspect-square sm:aspect-[4/3] bg-white border border-gray-100 dark:border-white/10 shadow-sm select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {esVideoActual && slideActual ? (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            {videoReproduciendo ? (
              videoEsExterno ? (
                <ReproductorVideo url={slideActual.url} autoPlay className="w-full h-full" />
              ) : (
                <video
                  className="w-full h-full object-contain bg-black"
                  controls
                  autoPlay
                  playsInline
                  poster={videoPoster ?? undefined}
                >
                  <source src={slideActual.url} type={videoMimeType ?? undefined} />
                  Tu navegador no soporta el reproductor de video.
                </video>
              )
            ) : (
              <button
                type="button"
                onClick={() => setVideoReproduciendo(true)}
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                aria-label="Reproducir video"
              >
                {videoPoster ? (
                  <Image src={videoPoster} alt={`${nombre} — video`} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-[#1B4332]" />
                )}
                <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
                <span className="relative z-10 w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="#1B4332"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="absolute inset-0 cursor-zoom-in"
            aria-label="Ampliar imagen"
          >
            <Image
              src={slideActual!.url}
              alt={`${nombre} — imagen ${indiceValido + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              priority
              onError={() => setErrores((e) => ({ ...e, [indiceValido]: true }))}
            />
          </button>
        )}

        {/* Insignia de Tienda / Vendedor en esquina inferior izquierda */}
        {comercioNombre && (
          <span className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 bg-white/90 dark:bg-black/80 backdrop-blur-md text-gray-800 dark:text-gray-200 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-gray-200/60 dark:border-white/20 pointer-events-none">
            <span>{comercioNombre}</span>
            {comercioVerificado && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2D6A4F] text-white text-[9px] font-black">
                ✓
              </span>
            )}
          </span>
        )}

        {/* Contador deslizante (1 / N) en esquina inferior derecha */}
        {slides.length > 1 && (
          <span className="absolute bottom-3 right-3 z-10 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm pointer-events-none">
            {indiceValido + 1} / {slides.length}
          </span>
        )}

        {/* Flechas de navegación (visibles en hover/desktop, además del swipe táctil) */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); ir(-1) }}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#1A1A1A] items-center justify-center shadow-sm hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); ir(1) }}
              aria-label="Siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#1A1A1A] items-center justify-center shadow-sm hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </>
        )}

        {/* Ver a pantalla completa — única forma de abrir el visor desde el slide de video */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setLightbox(true) }}
          aria-label="Ver a pantalla completa"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* Tiras de miniaturas deslizantes */}
      {slides.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
          {slides.map((slide, i) => (
            <button
              key={slide.url + i}
              type="button"
              onClick={() => setActiva(i)}
              aria-label={slide.tipo === 'video' ? 'Ver video' : `Ver imagen ${i + 1}`}
              aria-current={i === indiceValido}
              className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all bg-white ${
                i === indiceValido ? 'border-[#2D6A4F] shadow-sm scale-105' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {slide.tipo === 'video' ? (
                <>
                  {videoPoster ? (
                    <Image src={videoPoster} alt="Video" fill sizes="64px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 bg-[#1B4332]" />
                  )}
                  <span className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </>
              ) : errores[i] ? (
                <span className="absolute inset-0 bg-gray-100" />
              ) : (
                <Image
                  src={slide.url}
                  alt={`${nombre} miniatura ${i + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                  onError={() => setErrores((e) => ({ ...e, [i]: true }))}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Visor a pantalla completa — fotos y video, swipe táctil, pellizco para zoom */}
      <Lightbox
        open={lightbox}
        close={() => setLightbox(false)}
        index={indiceValido}
        slides={lightboxSlides}
        plugins={[Zoom, Video, Thumbnails]}
        on={{ view: ({ index }) => setActiva(index) }}
        zoom={{ scrollToZoom: true }}
        thumbnails={{ border: 2, borderColor: 'transparent', gap: 8, padding: 4, imageFit: 'cover' }}
        render={{
          slide: ({ slide }) =>
            slide.type === 'externalVideo' ? (
              <div className="w-full h-full flex items-center justify-center">
                <ReproductorVideo url={slide.src} autoPlay className="w-full h-full" />
              </div>
            ) : undefined,
        }}
        styles={{
          container: {
            backgroundColor: 'rgba(10, 28, 20, 0.97)',
            '--yarl__thumbnails_thumbnail_active_border_color': '#D4A017',
          },
        }}
      />
    </div>
  )
}
