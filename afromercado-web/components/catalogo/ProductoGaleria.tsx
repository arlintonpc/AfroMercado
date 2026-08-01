'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import ReproductorVideo, { detectar } from '@/components/comerciante/ReproductorVideo'

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
 * miniaturas e insignia de vendedor verificado. El lightbox de zoom es solo
 * para fotos (el video se reproduce directamente en el marco principal).
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
  const [zoom, setZoom] = useState(false)
  const [origen, setOrigen] = useState('center center')
  const [videoReproduciendo, setVideoReproduciendo] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const indiceValido = Math.min(activa, Math.max(0, slides.length - 1))
  const slideActual = slides[indiceValido] as Slide | undefined
  const esVideoActual = slideActual?.tipo === 'video'
  const videoEsExterno = esVideoActual && slideActual ? detectar(slideActual.url).plataforma !== 'directo' : false

  function cerrar() {
    setLightbox(false)
    setZoom(false)
  }

  // Navegación del carrusel principal — recorre fotos y video.
  function ir(delta: number) {
    setZoom(false)
    setVideoReproduciendo(false)
    setActiva((i) => (i + delta + slides.length) % slides.length)
  }

  // Navegación dentro del lightbox — solo fotos, el video no tiene zoom.
  function irLightbox(delta: number) {
    if (fotos.length === 0) return
    setZoom(false)
    setActiva((i) => (i + delta + fotos.length) % fotos.length)
  }

  useEffect(() => {
    if (!lightbox) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
      else if (e.key === 'ArrowRight') irLightbox(1)
      else if (e.key === 'ArrowLeft') irLightbox(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox, cerrar, irLightbox])

  function alternarZoom(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOrigen(`${x}% ${y}%`)
    setZoom((z) => !z)
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

      {/* Lightbox a pantalla completa — solo fotos */}
      {lightbox && fotos.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-md"
          onClick={cerrar}
          role="dialog"
          aria-modal="true"
          aria-label={`Imágenes de ${nombre}`}
        >
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="absolute top-5 right-5 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>

          {fotos.length > 1 && (
            <span className="absolute top-5 left-1/2 -translate-x-1/2 z-10 text-white font-bold text-sm bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-sm">
              {indiceValido + 1} / {fotos.length}
            </span>
          )}

          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); irLightbox(-1) }}
                aria-label="Imagen anterior"
                className="absolute left-4 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); irLightbox(1) }}
                aria-label="Imagen siguiente"
                className="absolute right-4 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </>
          )}

          <div
            className="relative w-[92vw] h-[82vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute inset-0 transition-transform duration-200 ease-out"
              style={{
                transform: zoom ? 'scale(2.2)' : 'scale(1)',
                transformOrigin: origen,
                cursor: zoom ? 'zoom-out' : 'zoom-in',
              }}
              onClick={alternarZoom}
            >
              <Image
                src={fotos[Math.min(indiceValido, fotos.length - 1)]}
                alt={`${nombre} — imagen ${indiceValido + 1}`}
                fill
                sizes="92vw"
                className="object-contain select-none"
                priority
              />
            </div>
          </div>

          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-white/70 text-xs">
            Toca la imagen para {zoom ? 'alejar' : 'acercar'}
          </span>
        </div>
      )}
    </div>
  )
}
