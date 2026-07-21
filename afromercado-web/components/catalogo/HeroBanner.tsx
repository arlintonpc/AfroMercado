'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  videoUrl?: string
  etiquetaCampana?: string
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
  videoUrl?:  string
  ctaTexto:   string
  urlDestino: string
  etiqueta:   string
}

/* ─── Fallback visual inmersivo ─────────────────────────────── */
const FALLBACK: FotoHero[] = [
  { url: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1600&q=80', alt: 'Paisaje del Pacífico', etiqueta: 'Paisaje Pacífico', precio: '', href: '/' },
  { url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80', alt: 'Gastronomía', etiqueta: 'Sabores locales', precio: '', href: '/express' },
  { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=80', alt: 'Alojamiento', etiqueta: 'Descanso natural', precio: '', href: '/hoteles' },
  { url: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=1600&q=80', alt: 'Productos', etiqueta: 'Productos del campo', precio: '', href: '#catalogo' },
]

const VERTICALES = [
  { id: 'tienda', icon: '🛒', label: 'Tienda', href: '#catalogo' },
  { id: 'express', icon: '🍽️', label: 'Restaurantes', href: '/express' },
  { id: 'hoteles', icon: '🏨', label: 'Hoteles', href: '/hoteles' },
  { id: 'tours', icon: '🌴', label: 'Tours', href: '/tours' },
  { id: 'transporte', icon: '🚐', label: 'Transporte', href: '/transportes' },
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

/* ─── Componente principal ───────────────────────────────────── */
export default function HeroBanner({ productos = [] }: { productos?: Producto[] }) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

  const [config, setConfig] = useState<HeroConfig>({ modo: 'FIJAS', intervaloSegundos: 10, fuente: 'ORGANICO' })
  const [campanas, setCampanas] = useState<CampanaAPI[]>([])
  
  const [currentIdx, setCurrentIdx] = useState(0)

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
      videoUrl:  c.videoUrl,
      etiquetaCampana: c.etiqueta,
    }))
    const sociales = campanasHero.filter(c => c.tipoCampana === 'SOCIAL')
    const pagadas = campanasHero.filter(c => c.tipoCampana !== 'SOCIAL')

    let base: FotoHero[]
    if (config.fuente === 'CAMPANAS') {
      base = campanasHero.length >= 4 ? campanasHero : [...campanasHero, ...organico]
    } else if (config.fuente === 'MIXTO') {
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
    return config.modo === 'ALEATORIO' ? mezclar(base) : base
  }, [productos, campanas, config.fuente, config.modo])

  /* ── Registrar vista / clic ── */
  const registrarVista = useCallback((foto: FotoHero) => {
    if (foto.campanaId) fetch(`${API_URL}/campanas/${foto.campanaId}/vista`, { method: 'POST' }).catch(() => {})
  }, [API_URL])

  function registrarClic(foto: FotoHero) {
    if (foto.campanaId) fetch(`${API_URL}/campanas/${foto.campanaId}/clic`, { method: 'POST' }).catch(() => {})
  }

  /* ── Rotación del fondo ── */
  useEffect(() => {
    if (config.modo === 'FIJAS' || pool.length === 0) return
    const id = setInterval(() => {
      setCurrentIdx((prev) => {
        const next = (prev + 1) % pool.length
        registrarVista(pool[next])
        return next
      })
    }, config.intervaloSegundos * 1000)
    
    // Registrar vista inicial
    registrarVista(pool[0])
    
    return () => clearInterval(id)
  }, [config, pool, registrarVista])

  const activeItem = pool[currentIdx] || FALLBACK[0]

  return (
    <section className="relative w-full h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-[#0f2419]">
      {/* ─── Carrusel de Fondos ─── */}
      {pool.map((slide, idx) => (
        <div
          key={slide.url + idx}
          className={`absolute inset-0 transition-opacity duration-[1500ms] ease-in-out ${
            idx === currentIdx ? 'opacity-100 z-0' : 'opacity-0 -z-10'
          }`}
        >
          {/* Si es video directo se podría manejar aquí, por ahora usamos la imagen como poster para simplicidad y estética */}
          <Image
            src={slide.url}
            alt={slide.alt}
            fill
            className="object-cover object-center transition-transform duration-[15000ms] ease-out"
            style={{ transform: idx === currentIdx ? 'scale(1)' : 'scale(1.1)' }}
            priority={idx === 0}
          />
        </div>
      ))}

      {/* Capa de oscurecimiento (Overlay) para asegurar legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f2419]/80 via-[#0f2419]/50 to-[#0f2419]/90 z-10" />

      {/* ─── Contenido Centrado ─── */}
      <div className="relative z-20 w-full max-w-5xl mx-auto px-4 flex flex-col items-center text-center mt-8">
        
        {/* Píldora Superior */}
        <div className="inline-flex items-center gap-2 bg-white/10 border border-[#D4A017]/40 backdrop-blur-md rounded-full px-5 py-2 mb-8 shadow-2xl">
          <span className="w-2 h-2 rounded-full bg-[#D4A017] animate-pulse" />
          <span className="text-[#D4A017] text-[10px] sm:text-xs font-bold tracking-widest uppercase">
            Plataforma Multiservicios de Colombia
          </span>
        </div>

        {/* Título Principal */}
        <h1 className="leading-[1.05] mb-6 drop-shadow-2xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          <span className="block text-white text-5xl md:text-7xl lg:text-[80px] font-normal mb-1">
            Conectando territorios,
          </span>
          <span className="block text-4xl md:text-6xl lg:text-[70px] font-normal bg-gradient-to-r from-[#D4A017] via-[#F4C842] to-[#D4A017] bg-clip-text text-transparent">
            creando oportunidades.
          </span>
        </h1>

        {/* Subtítulo */}
        <p className="text-white/80 text-sm md:text-lg lg:text-xl max-w-3xl mx-auto mb-10 md:mb-12 leading-relaxed drop-shadow-lg">
          Descubre artesanías ancestrales, saborea la gastronomía local, hospédate en el territorio y vive experiencias inolvidables con nuestras comunidades.
        </p>

        {/* ─── Hub de Navegación "Glassmorphism" ─── */}
        <div className="w-full max-w-4xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-3 shadow-2xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {VERTICALES.map((v) => (
              <Link
                key={v.id}
                href={v.href}
                className="group flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-white/20 border border-transparent hover:border-white/30 transition-all duration-300"
              >
                <span className="text-3xl mb-2 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 drop-shadow-md">
                  {v.icon}
                </span>
                <span className="text-white text-xs md:text-sm font-semibold tracking-wide">
                  {v.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Botón de Comerciante (Secundario) */}
        <div className="mt-12 flex justify-center">
           <Link href="/comerciante/ingresar" className="inline-flex items-center text-white/60 hover:text-white text-xs md:text-sm font-medium transition-colors border-b border-transparent hover:border-white/50 pb-0.5">
             Soy comerciante. Quiero vender mis productos o servicios →
           </Link>
        </div>

      </div>

      {/* ─── Tarjeta Flotante: Anuncio o Producto Activo ─── */}
      {activeItem && (activeItem.esCampaña || activeItem.precio) && (
        <div className="absolute bottom-6 right-4 md:right-8 z-30 animate-fade-in">
          <Link 
            href={activeItem.href} 
            onClick={() => registrarClic(activeItem)}
            className="flex items-center gap-3 bg-black/40 hover:bg-black/70 backdrop-blur-md rounded-2xl p-2.5 pr-5 border border-white/10 hover:border-white/30 transition-all shadow-xl group max-w-xs"
          >
             <div className="w-14 h-14 rounded-xl overflow-hidden relative flex-shrink-0">
               <Image src={activeItem.url} alt={activeItem.alt} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
             </div>
             <div className="flex flex-col min-w-0">
               <span className="text-[9px] text-[#52B788] font-bold uppercase tracking-wider mb-0.5">
                 {activeItem.etiquetaCampana || (activeItem.esCampaña ? 'Recomendado' : 'Destacado')}
               </span>
               <p className="text-white text-xs md:text-sm font-semibold truncate leading-tight">
                 {activeItem.etiqueta}
               </p>
               {activeItem.precio && (
                 <span className="text-[#D4A017] text-xs font-bold mt-1 inline-block">
                   {activeItem.precio}
                 </span>
               )}
             </div>
          </Link>
        </div>
      )}

    </section>
  )
}
