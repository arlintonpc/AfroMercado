'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

interface ProductoGaleriaProps {
  imagenes: string[]
  nombre: string
  productoId: string
  /** Clases de gradiente para el placeholder cuando no hay imágenes. */
  gradiente: string
}

/**
 * Galería de producto: imagen principal + miniaturas, con lightbox a pantalla
 * completa y zoom al hacer clic (hacia el punto donde se pulsa).
 */
export default function ProductoGaleria({
  imagenes,
  nombre,
  productoId,
  gradiente,
}: ProductoGaleriaProps) {
  const fotos = imagenes.filter(Boolean)
  const hayFotos = fotos.length > 0

  const [activa, setActiva] = useState(0)
  const [errores, setErrores] = useState<Record<number, boolean>>({})
  const [lightbox, setLightbox] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [origen, setOrigen] = useState('center center')

  const indiceValido = Math.min(activa, Math.max(0, fotos.length - 1))

  const cerrar = useCallback(() => {
    setLightbox(false)
    setZoom(false)
  }, [])

  const ir = useCallback(
    (delta: number) => {
      setZoom(false)
      setActiva((i) => (i + delta + fotos.length) % fotos.length)
    },
    [fotos.length],
  )

  // Teclado + bloqueo de scroll mientras el lightbox está abierto.
  useEffect(() => {
    if (!lightbox) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
      else if (e.key === 'ArrowRight') ir(1)
      else if (e.key === 'ArrowLeft') ir(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox, cerrar, ir])

  function alternarZoom(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOrigen(`${x}% ${y}%`)
    setZoom((z) => !z)
  }

  // ── Sin imágenes: placeholder editorial ──────────────────────
  if (!hayFotos) {
    return (
      <div className="w-full rounded-3xl overflow-hidden aspect-[4/3] relative ring-1 ring-[#1A1A1A]/5 shadow-sm">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradiente} flex flex-col items-center justify-center gap-3`}>
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%">
              <defs>
                <pattern id={`pg-${productoId}`} width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="15" cy="15" r="6" fill="none" stroke="white" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#pg-${productoId})`} />
            </svg>
          </div>
          <div className="relative z-10 w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
          <span className="relative z-10 text-white/50 text-sm">Sin imagen</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Imagen principal — clic para abrir el lightbox */}
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className="group relative w-full rounded-3xl overflow-hidden aspect-[4/3] ring-1 ring-[#1A1A1A]/5 shadow-sm cursor-zoom-in"
        aria-label="Ampliar imagen"
      >
        <Image
          src={fotos[indiceValido]}
          alt={`${nombre} — imagen ${indiceValido + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          priority
          onError={() => setErrores((e) => ({ ...e, [indiceValido]: true }))}
        />
        {/* Indicador de "ampliar" */}
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/45 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" strokeLinecap="round" />
          </svg>
          Ampliar
        </span>
      </button>

      {/* Miniaturas (solo si hay más de una) */}
      {fotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
          {fotos.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setActiva(i)}
              aria-label={`Ver imagen ${i + 1}`}
              aria-current={i === indiceValido}
              className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden ring-2 transition-all ${
                i === indiceValido ? 'ring-[#2D6A4F]' : 'ring-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {errores[i] ? (
                <span className="absolute inset-0 bg-[#F0EBE3]" />
              ) : (
                <Image
                  src={url}
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

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={cerrar}
          role="dialog"
          aria-modal="true"
          aria-label={`Imágenes de ${nombre}`}
        >
          {/* Cerrar */}
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>

          {/* Contador */}
          {fotos.length > 1 && (
            <span className="absolute top-5 left-1/2 -translate-x-1/2 z-10 text-white/80 text-sm bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              {indiceValido + 1} / {fotos.length}
            </span>
          )}

          {/* Flechas */}
          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); ir(-1) }}
                aria-label="Imagen anterior"
                className="absolute left-3 md:left-6 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); ir(1) }}
                aria-label="Imagen siguiente"
                className="absolute right-3 md:right-6 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </>
          )}

          {/* Imagen con zoom */}
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
                src={fotos[indiceValido]}
                alt={`${nombre} — imagen ${indiceValido + 1}`}
                fill
                sizes="92vw"
                className="object-contain select-none"
                priority
              />
            </div>
          </div>

          {/* Pista */}
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-white/50 text-xs">
            Toca la imagen para {zoom ? 'alejar' : 'acercar'}
          </span>
        </div>
      )}
    </div>
  )
}
