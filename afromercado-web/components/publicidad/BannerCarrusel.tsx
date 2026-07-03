'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegion } from '@/context/RegionContext'

/* ─── Tipos ─────────────────────────────────────────────────── */
interface CampanaBanner {
  id:         number
  tipo:       string
  titulo:     string
  subtitulo?: string | null
  imagenUrl:  string
  ctaTexto:   string
  urlDestino: string
  prioridad:  number
}

const INTERVALO_MS = 5500

/* ─── Componente ──────────────────────────────────────────────── */
export default function BannerCarrusel() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')
  const { regionActiva } = useRegion()

  const [banners, setBanners] = useState<CampanaBanner[]>([])
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)
  const interaccionManualRef = useRef(false)
  const vistasRegistradasRef = useRef<Set<number>>(new Set())
  const startXRef = useRef<number | null>(null)

  /* ── Cargar banners activos ── */
  useEffect(() => {
    const qs = regionActiva ? `?tipo=BANNER_CARRUSEL&departamento=${encodeURIComponent(regionActiva)}` : '?tipo=BANNER_CARRUSEL'
    let cancelado = false
    fetch(`${API_URL}/campanas/activas${qs}`)
      .then(r => r.json())
      .then(j => {
        if (cancelado) return
        setBanners(Array.isArray(j.items) ? j.items.slice(0, 4) : [])
        setIndice(0)
      })
      .catch(() => { if (!cancelado) setBanners([]) })
    return () => { cancelado = true }
  }, [API_URL, regionActiva])

  /* ── Registrar vista / clic ── */
  const registrarVista = useCallback((id: number) => {
    if (vistasRegistradasRef.current.has(id)) return
    vistasRegistradasRef.current.add(id)
    fetch(`${API_URL}/campanas/${id}/vista`, { method: 'POST' }).catch(() => {})
  }, [API_URL])

  function registrarClic(id: number) {
    fetch(`${API_URL}/campanas/${id}/clic`, { method: 'POST' }).catch(() => {})
  }

  /* ── Registrar vista del banner visible en cada cambio de índice ── */
  useEffect(() => {
    const actual = banners[indice]
    if (actual) registrarVista(actual.id)
  }, [banners, indice, registrarVista])

  /* ── Autoplay: cada 5.5s, se detiene si está pausado (hover/touch) o hubo interacción manual ── */
  useEffect(() => {
    if (banners.length <= 1 || pausado || interaccionManualRef.current) return
    const id = setInterval(() => {
      setIndice(i => (i + 1) % banners.length)
    }, INTERVALO_MS)
    return () => clearInterval(id)
  }, [banners.length, pausado])

  function irA(nuevoIndice: number, manual: boolean) {
    if (manual) interaccionManualRef.current = true
    setIndice(((nuevoIndice % banners.length) + banners.length) % banners.length)
  }

  if (banners.length === 0) return null

  const actual = banners[indice]

  return (
    <section
      className="relative w-full overflow-hidden bg-[#1a3a2a]"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={e => {
        setPausado(true)
        startXRef.current = e.touches[0].clientX
      }}
      onTouchEnd={e => {
        setPausado(false)
        if (startXRef.current === null) return
        const dx = e.changedTouches[0].clientX - startXRef.current
        if (Math.abs(dx) > 40) {
          irA(indice + (dx < 0 ? 1 : -1), true)
        }
        startXRef.current = null
      }}
    >
      <a
        href={actual.urlDestino}
        onClick={() => registrarClic(actual.id)}
        className="relative block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]"
        style={{ aspectRatio: '16 / 5' }}
      >
        <Image
          src={actual.imagenUrl}
          alt={actual.titulo}
          fill
          sizes="100vw"
          priority={indice === 0}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

        {/* Badge Patrocinado */}
        <span className="absolute top-3 right-3 bg-[#2D6A4F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none tracking-wide uppercase">
          Patrocinado
        </span>

        {/* Título / subtítulo / CTA */}
        <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-8 md:right-8">
          {actual.subtitulo && (
            <p className="text-white/75 text-xs md:text-sm mb-1 truncate">{actual.subtitulo}</p>
          )}
          <div className="flex items-end justify-between gap-3">
            <h3 className="text-white text-lg md:text-2xl font-semibold drop-shadow truncate">{actual.titulo}</h3>
            <span className="flex-shrink-0 bg-[#D4A017] text-[#1A1A1A] text-xs md:text-sm font-bold px-4 py-2 rounded-full whitespace-nowrap">
              {actual.ctaTexto}
            </span>
          </div>
        </div>
      </a>

      {/* Flechas prev/next — solo si hay más de 1 banner */}
      {banners.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Banner anterior"
            onClick={() => irA(indice - 1, true)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            aria-label="Banner siguiente"
            onClick={() => irA(indice + 1, true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Ir al banner ${i + 1}`}
                onClick={() => irA(i, true)}
                className={`rounded-full transition-all duration-300 ${
                  i === indice ? 'w-6 h-2 bg-[#D4A017]' : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
