'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Producto } from '@/types/producto'
import { formatearPrecio } from '@/lib/formatearPrecio'

/* ─── Tipos ─────────────────────────────────────────────────── */
type ModoHero   = 'FIJAS' | 'DINAMICO' | 'ALEATORIO'
type FuenteHero = 'ORGANICO' | 'CAMPANAS' | 'MIXTO'
type TipoCampana = 'PUBLICIDAD' | 'SOCIAL'

interface FotoHero {
  url:       string
  alt:       string
  etiqueta:  string
  precio:    string   // precio del producto ó texto del CTA
  href:      string   // destino al hacer clic
  campanaId?: number  // si viene de una campaña
  esCampaña?: boolean
  tipoCampana?: TipoCampana
  subtitulo?: string
}

interface HeroConfig {
  modo:              ModoHero
  intervaloSegundos: number
  fuente:            FuenteHero
}

interface CampanaAPI {
  id:         number
  tipo:       TipoCampana
  titulo:     string
  subtitulo?: string
  imagenUrl:  string
  ctaTexto:   string
  urlDestino: string
}

/* ─── Fallback visual cuando no hay productos ni campañas ───── */
const FALLBACK: FotoHero[] = [
  { url: 'https://images.unsplash.com/photo-1743252878695-367d69dc87a8?w=600&q=80&auto=format&fit=crop', alt: 'Cacao fino de aroma',     etiqueta: 'Cacao fino',     precio: '$32.000', href: '/' },
  { url: 'https://images.unsplash.com/photo-1589820296156-2454bb8a6ad1?w=600&q=80&auto=format&fit=crop', alt: 'Piña perolera del Pacífico', etiqueta: 'Piña perolera', precio: '$6.000',  href: '/' },
  { url: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=600&q=80&auto=format&fit=crop', alt: 'Plátano hartón orgánico',   etiqueta: 'Plátano hartón', precio: '$4.500',  href: '/' },
  { url: 'https://images.unsplash.com/photo-1775817590687-f1da5d70d9ad?w=600&q=80&auto=format&fit=crop', alt: 'Panela negra artesanal',    etiqueta: 'Panela negra',   precio: '$8.000',  href: '/' },
]

/* ─── Utilidades ─────────────────────────────────────────────── */
function mezclar<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function badgeCampana(foto: FotoHero) {
  const esSocial = foto.tipoCampana === 'SOCIAL'
  return {
    label: esSocial ? 'Comunidad' : 'Destacado',
    cls: esSocial
      ? 'bg-[#52B788] text-white'
      : 'bg-[#D4A017] text-[#1A1A1A]',
    ctaCls: esSocial
      ? 'bg-[#52B788] text-white'
      : 'bg-white text-[#2D6A4F]',
  }
}

/* ─── Sub-componente: rejilla de 4 tarjetas ─────────────────── */
function Collage({ fotos, priority = false, onClic }: {
  fotos:    FotoHero[]
  priority?: boolean
  onClic:   (foto: FotoHero) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {fotos.map((foto, idx) => (
        <Link
          key={idx}
          href={foto.href}
          onClick={() => onClic(foto)}
          className="group relative block rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]"
          style={{ aspectRatio: '3 / 4' }}
          tabIndex={0}
        >
          <Image
            src={foto.url}
            alt={foto.alt}
            fill
            sizes="(max-width: 1024px) 0px, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            priority={priority && idx < 2}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

          {/* Badge campaña */}
          {foto.esCampaña && (
            <span className={`absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full leading-none tracking-wide uppercase ${badgeCampana(foto).cls}`}>
              {badgeCampana(foto).label}
            </span>
          )}

          <figcaption className="absolute bottom-3 left-3 right-3">
            {foto.subtitulo && (
              <p className="text-white/70 text-[10px] mb-0.5 truncate">{foto.subtitulo}</p>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-white text-sm font-semibold drop-shadow truncate">{foto.etiqueta}</span>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                foto.esCampaña
                  ? badgeCampana(foto).ctaCls
                  : 'bg-[#D4A017] text-[#1A1A1A]'
              }`}>
                {foto.precio}
              </span>
            </div>
          </figcaption>
        </Link>
      ))}
    </div>
  )
}

/* ─── Sub-componente: tira mobile ───────────────────────────── */
function CollageMobile({ fotos, onClic }: {
  fotos:  FotoHero[]
  onClic: (foto: FotoHero) => void
}) {
  return (
    <>
      {fotos.map((foto, idx) => (
        <Link
          key={idx}
          href={foto.href}
          onClick={() => onClic(foto)}
          className="group relative flex-shrink-0 w-40 block rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]"
          style={{ aspectRatio: '3 / 4' }}
        >
          <Image src={foto.url} alt={foto.alt} fill sizes="160px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" priority={idx === 0} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          {foto.esCampaña && (
            <span className={`absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none tracking-wide uppercase ${badgeCampana(foto).cls}`}>
              {badgeCampana(foto).label}
            </span>
          )}
          <figcaption className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
            <span className="text-white text-xs font-semibold drop-shadow truncate">{foto.etiqueta}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${foto.esCampaña ? badgeCampana(foto).ctaCls : 'bg-[#D4A017] text-[#1A1A1A]'}`}>
              {foto.precio}
            </span>
          </figcaption>
        </Link>
      ))}
    </>
  )
}

/* ─── Componente principal ───────────────────────────────────── */
export default function HeroBanner({ productos = [] }: { productos?: Producto[] }) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

  const [config, setConfig] = useState<HeroConfig>({ modo: 'FIJAS', intervaloSegundos: 10, fuente: 'ORGANICO' })
  const [campanas, setCampanas] = useState<CampanaAPI[]>([])

  /* Dos capas para slide sin parpadeo */
  const [fotosA, setFotosA] = useState<FotoHero[]>(FALLBACK)
  const [fotosB, setFotosB] = useState<FotoHero[]>(FALLBACK)
  const [xA, setXA] = useState(0)
  const [xB, setXB] = useState(100)
  const [transA, setTransA] = useState(false)
  const [transB, setTransB] = useState(false)

  /* Dots */
  const [grupoActual, setGrupoActual] = useState(0)
  const [totalGrupos, setTotalGrupos] = useState(1)

  const activoRef      = useRef<'A' | 'B'>('A')
  const deslizandoRef  = useRef(false)
  const seqRef         = useRef<FotoHero[]>([])
  const idxRef         = useRef(0)

  /* ── Cargar config y campañas ── */
  useEffect(() => {
    fetch(`${API_URL}/config/hero`)
      .then(r => r.json())
      .then(j => { if (j.ok) setConfig({ modo: j.modo, intervaloSegundos: j.intervaloSegundos, fuente: j.fuente }) })
      .catch(() => {})
  }, [API_URL])

  useEffect(() => {
    if (config.fuente === 'ORGANICO') return
    fetch(`${API_URL}/campanas/activas`)
      .then(r => r.json())
      .then(j => { if (j.ok) setCampanas(j.items ?? []) })
      .catch(() => {})
  }, [API_URL, config.fuente])

  /* ── Pool de fotos según fuente ── */
  const pool = useMemo<FotoHero[]>(() => {
    const organico: FotoHero[] = productos
      .filter(p => p.fotoUrl)
      .map(p => ({
        url:      p.fotoUrl!,
        alt:      p.nombre,
        etiqueta: p.nombre,
        precio:   formatearPrecio(p.precio),
        href:     `/producto/${p.id}`,
      }))

    const campanasHero: FotoHero[] = campanas.map(c => ({
      url:       c.imagenUrl,
      alt:       c.titulo,
      etiqueta:  c.titulo,
      precio:    c.ctaTexto,
      href:      c.urlDestino,
      campanaId: c.id,
      esCampaña: true,
      tipoCampana: c.tipo,
      subtitulo: c.subtitulo,
    }))
    const sociales = campanasHero.filter(c => c.tipoCampana === 'SOCIAL')
    const pagadas = campanasHero.filter(c => c.tipoCampana !== 'SOCIAL')

    let base: FotoHero[]
    if (config.fuente === 'CAMPANAS') {
      base = campanasHero.length >= 4 ? campanasHero : [...campanasHero, ...organico]
    } else if (config.fuente === 'MIXTO') {
      // Las sociales no consumen el slot pagado: se intercalan aparte.
      const result: FotoHero[] = []
      let si = 0, pi = 0, oi = 0
      while (si < sociales.length || pi < pagadas.length || oi < organico.length) {
        if (si < sociales.length) result.push(sociales[si++])
        if (pi < pagadas.length) result.push(pagadas[pi++])
        for (let i = 0; i < 3 && oi < organico.length; i++) result.push(organico[oi++])
      }
      base = result
    } else {
      base = organico
    }

    if (base.length === 0) return FALLBACK
    // Relleno para tener al menos 4
    if (base.length < 4) {
      const pad = [...base]
      while (pad.length < 4) pad.push(FALLBACK[pad.length % FALLBACK.length])
      return pad
    }
    return base
  }, [productos, campanas, config.fuente])

  /* ── Registrar vista / clic ── */
  const registrarVista = useCallback((fotos: FotoHero[]) => {
    fotos.forEach(f => {
      if (f.campanaId) fetch(`${API_URL}/campanas/${f.campanaId}/vista`, { method: 'POST' }).catch(() => {})
    })
  }, [API_URL])

  function registrarClic(foto: FotoHero) {
    if (foto.campanaId) fetch(`${API_URL}/campanas/${foto.campanaId}/clic`, { method: 'POST' }).catch(() => {})
  }

  /* ── Slide: la capa inactiva carga imágenes off-screen, luego ambas se deslizan ── */
  const deslizar = useCallback((siguientes: FotoHero[], nuevoIdx: number) => {
    if (deslizandoRef.current) return
    deslizandoRef.current = true

    const activo   = activoRef.current
    const inactivo: 'A' | 'B' = activo === 'A' ? 'B' : 'A'

    // 1. Cargar nuevas fotos en la capa oculta (fuera de pantalla, sin parpadeo)
    if (inactivo === 'A') setFotosA(siguientes)
    else setFotosB(siguientes)

    // 2. Un frame después, activar transición y deslizar ambas capas
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransA(true)
        setTransB(true)
        if (activo   === 'A') setXA(-100); else setXB(-100)   // activa sale por la izquierda
        if (inactivo === 'A') setXA(0);    else setXB(0)      // inactiva entra por la derecha

        activoRef.current = inactivo
        setGrupoActual(nuevoIdx)
        registrarVista(siguientes)

        // 3. Al terminar la animación, desactivar transición y resetear capa vieja
        setTimeout(() => {
          if (activo === 'A') { setTransA(false); setXA(100) }
          else                { setTransB(false); setXB(100) }
          deslizandoRef.current = false
        }, 720)
      })
    })
  }, [registrarVista])

  /* ── Inicializar secuencia cuando cambia el pool o el modo ── */
  useEffect(() => {
    seqRef.current = config.modo === 'ALEATORIO' ? mezclar(pool) : [...pool]
    idxRef.current = 0
    const primeras = seqRef.current.slice(0, 4)
    setFotosA(primeras)
    setFotosB(primeras)
    setXA(0); setXB(100)
    setTransA(false); setTransB(false)
    activoRef.current = 'A'
    deslizandoRef.current = false
    setGrupoActual(0)
    setTotalGrupos(Math.max(1, Math.ceil(seqRef.current.length / 4)))
    registrarVista(primeras)
  }, [pool, config.modo, registrarVista])

  /* ── Rotación automática ── */
  useEffect(() => {
    if (config.modo === 'FIJAS') return
    const girar = () => {
      idxRef.current = (idxRef.current + 4) % seqRef.current.length
      if (config.modo === 'ALEATORIO' && idxRef.current === 0) seqRef.current = mezclar(pool)
      const inicio = idxRef.current
      const sig: FotoHero[] = []
      for (let i = 0; i < 4; i++) sig.push(seqRef.current[(inicio + i) % seqRef.current.length])
      const grupoIdx = Math.floor(idxRef.current / 4)
      deslizar(sig, grupoIdx)
    }
    const id = setInterval(girar, config.intervaloSegundos * 1000)
    return () => clearInterval(id)
  }, [config, pool, deslizar])

  /* ── Navegación manual por dots ── */
  function irAGrupo(grupoIdx: number) {
    if (deslizandoRef.current) return
    const idx = grupoIdx * 4
    const sig: FotoHero[] = []
    for (let i = 0; i < 4; i++) sig.push(seqRef.current[(idx + i) % seqRef.current.length])
    idxRef.current = idx
    deslizar(sig, grupoIdx)
  }

  const esInteractivo = config.modo !== 'FIJAS' || totalGrupos > 1

  return (
    <section className="relative overflow-hidden bg-[#1a3a2a]">
      {/* Patrón decorativo */}
      <div className="absolute inset-0 opacity-[0.06]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lp" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
              <circle cx="32" cy="32" r="22" fill="none" stroke="#52B788" strokeWidth="1" />
              <circle cx="32" cy="32" r="8" fill="#52B788" opacity="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp)" />
        </svg>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f2419] via-[#1a3a2a] to-[#23503a]" />
      <div className="absolute top-0 right-1/4 w-[520px] h-[520px] opacity-20 -translate-y-1/3 rounded-full bg-[#D4A017] blur-[90px]" />
      <div className="absolute bottom-0 left-0 w-72 h-72 opacity-25 -translate-x-1/4 translate-y-1/4 rounded-full bg-[#52B788] blur-[70px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">

          {/* ─── Texto ─── */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-[#D4A017]/30 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017] animate-pulse" />
              <span className="text-[#D4A017] text-xs font-semibold tracking-widest uppercase">Marketplace del Pacífico</span>
            </div>
            <h1 className="leading-[0.95] mb-6" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              <span className="block text-white text-5xl md:text-6xl lg:text-[68px] font-normal">Del Chocó</span>
              <span className="block text-5xl md:text-6xl lg:text-[68px] font-normal bg-gradient-to-r from-[#D4A017] via-[#F4C842] to-[#D4A017] bg-clip-text text-transparent">para el mundo</span>
            </h1>
            <p className="text-white/65 text-base md:text-lg mb-7 leading-relaxed max-w-md">
              Productos ancestrales, artesanías y sabores auténticos directo de las comunidades afrocolombianas e indígenas del Chocó.
            </p>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex">
                {[{ i: 'J', c: 'bg-[#52B788]' }, { i: 'A', c: 'bg-[#D4A017]' }, { i: 'M', c: 'bg-[#2D6A4F]' }].map((a, idx) => (
                  <span key={a.i} className={`w-9 h-9 rounded-full ${a.c} ring-2 ring-[#1a3a2a] flex items-center justify-center text-white text-xs font-bold ${idx > 0 ? '-ml-2.5' : ''}`}>{a.i}</span>
                ))}
              </div>
              <p className="text-white/55 text-sm">José, Ana Tulia, Marta <span className="text-white/40">y más productores</span></p>
            </div>
            <div className="flex flex-wrap gap-3 mb-10">
              <a href="#catalogo" className="group relative overflow-hidden bg-[#D4A017] text-[#1A1A1A] font-semibold px-7 py-3.5 rounded-full transition-all duration-300 hover:shadow-xl hover:shadow-[#D4A017]/25 hover:scale-[1.03] min-h-[48px] text-sm flex items-center">
                <span className="relative z-10">Explorar productos</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </a>
              <a href="/comerciante/ingresar" className="border border-white/20 text-white/85 hover:text-white hover:border-white/40 font-medium px-7 py-3.5 rounded-full transition-all duration-200 hover:bg-white/5 min-h-[48px] text-sm backdrop-blur-sm flex items-center">
                Soy comerciante →
              </a>
            </div>
            <div className="flex gap-8 pt-7 border-t border-white/10">
              {[{ valor: '6+', label: 'Productos' }, { valor: '4', label: 'Productores' }, { valor: '100%', label: 'Auténtico' }].map(s => (
                <div key={s.label}>
                  <p className="text-3xl text-white font-bold" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>{s.valor}</p>
                  <p className="text-white/40 text-xs tracking-wide uppercase mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Collage desktop con slide ─── */}
          <div className="hidden lg:block">
            {/* Dos capas apiladas en la misma celda CSS grid → el overflow se recorta */}
            <div className="overflow-hidden" style={{ display: 'grid' }}>
              <div
                className={transA ? 'transition-transform duration-700 ease-in-out' : ''}
                style={{ gridArea: '1/1', transform: `translateX(${xA}%)` }}
              >
                <Collage fotos={fotosA} priority onClic={registrarClic} />
              </div>
              <div
                className={transB ? 'transition-transform duration-700 ease-in-out' : ''}
                style={{ gridArea: '1/1', transform: `translateX(${xB}%)` }}
              >
                <Collage fotos={fotosB} onClic={registrarClic} />
              </div>
            </div>

            {/* Dots de navegación */}
            {esInteractivo && totalGrupos > 1 && (
              <div className="flex items-center justify-center gap-2 mt-5">
                {Array.from({ length: totalGrupos }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => irAGrupo(i)}
                    aria-label={`Grupo ${i + 1}`}
                    className={`rounded-full transition-all duration-300 ${
                      i === grupoActual
                        ? 'w-6 h-2 bg-[#D4A017]'
                        : 'w-2 h-2 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ─── Tira mobile con slide ─── */}
          <div className="lg:hidden" style={{ height: 224 }}>
            <div className="relative overflow-hidden h-full" style={{ display: 'grid' }}>
              <div
                className={`${transA ? 'transition-transform duration-700 ease-in-out' : ''} px-4 flex gap-3 overflow-x-auto pb-2`}
                style={{ gridArea: '1/1', transform: `translateX(${xA}%)`, scrollbarWidth: 'none' } as React.CSSProperties}
              >
                <CollageMobile fotos={fotosA} onClic={registrarClic} />
              </div>
              <div
                className={`${transB ? 'transition-transform duration-700 ease-in-out' : ''} px-4 flex gap-3 overflow-x-auto pb-2`}
                style={{ gridArea: '1/1', transform: `translateX(${xB}%)`, scrollbarWidth: 'none' } as React.CSSProperties}
              >
                <CollageMobile fotos={fotosB} onClic={registrarClic} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Indicador de modo */}
      {config.modo !== 'FIJAS' && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017] animate-pulse" />
          <span className="text-white/60 text-[10px] tracking-wide">
            {config.modo === 'ALEATORIO' ? 'Aleatorio' : 'Automático'} · {config.intervaloSegundos}s
          </span>
        </div>
      )}
    </section>
  )
}
