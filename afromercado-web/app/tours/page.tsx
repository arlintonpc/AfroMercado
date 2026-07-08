'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { listarTours, type ConfigTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { optimizarImagenPequena } from '@/lib/cloudinary'

const MapaTours = dynamic(() => import('@/components/tours/MapaTours'), { ssr: false })

const SERVICIOS_ICONOS: Record<string, string> = {
  transporte: '🚐', almuerzo: '🍱', guia: '🧭', equipo: '🎒', foto: '📸',
  seguro: '🛡️', snacks: '🍎', audio: '🎧',
}

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function SkeletonTour() {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-56 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="flex justify-between mt-3">
          <div className="h-3 bg-gray-100 rounded w-16" />
          <div className="h-5 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  )
}

function EstrellasMini({ valor, total }: { valor: number | string; total: number }) {
  const n = Number(valor)
  if (total === 0) return null
  return (
    <div className="flex items-center gap-1">
      <span className="text-[#D4A017] text-xs">{'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}</span>
      <span className="text-[10px] text-gray-400">({total})</span>
    </div>
  )
}

interface ItemListing {
  tourId: number
  lugarId?: number
  titulo: string
  foto?: string
  municipio: string
  precio: number
  duracionHoras: number
  confirmacionAuto: boolean
  maxParticipantes: number
  servicios: string[]
  idiomas: string[]
  operadorNombre: string
  operadorLogo?: string | null
  calificacion: number | string
  totalReviews: number
  latitud?: number | null
  longitud?: number | null
  tipo?: string | null
}

function TarjetaItem({ item, userLat, userLon }: { item: ItemListing; userLat: number | null; userLon: number | null }) {
  const dist = userLat && userLon && item.latitud && item.longitud
    ? distanciaKm(userLat, userLon, item.latitud, item.longitud)
    : null
  const inicial = item.operadorNombre.charAt(0).toUpperCase()

  return (
    <Link href={`/tours/${item.tourId}${item.lugarId ? `#lugar-${item.lugarId}` : ''}`} className="group block rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-white border border-gray-100/80 shadow-sm">
      {/* Imagen */}
      <div className="relative h-52 overflow-hidden bg-[#1B4332]">
        {item.foto ? (
          <img src={optimizarImagenPequena(item.foto)} alt={item.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#52B788] flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {item.confirmacionAuto && (
            <span className="bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">✓ Confirmación inmediata</span>
          )}
          {!item.confirmacionAuto && item.maxParticipantes > 0 && item.maxParticipantes <= 5 && (
            <span className="bg-[#D4A017]/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">✨ Grupo exclusivo</span>
          )}
        </div>

        {/* Precio */}
        <div className="absolute top-3 right-3">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg">
            <p className="text-[9px] text-gray-400 font-medium leading-none mb-0.5">desde</p>
            <p className="text-[#1B4332] font-black text-sm leading-none">{formatearPrecio(item.precio)}</p>
          </div>
        </div>

        {/* Nombre + ubicación */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-white font-bold text-base leading-snug line-clamp-2">{item.titulo}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-70 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span className="text-white/75 text-xs">{item.municipio}</span>
              </div>
            </div>
            {dist !== null && (
              <span className="text-white/65 text-[10px] flex-shrink-0 bg-black/20 px-2 py-0.5 rounded-full">
                {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2D6A4F] to-[#1B4332] flex items-center justify-center shadow-sm">
          {item.operadorLogo ? (
            <img src={item.operadorLogo} alt={item.operadorNombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-xs font-bold">{inicial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-gray-500 leading-none truncate">{item.operadorNombre}</p>
          <div className="mt-1">
            <EstrellasMini valor={item.calificacion} total={item.totalReviews} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-[#2D6A4F] font-semibold bg-[#2D6A4F]/8 px-2 py-0.5 rounded-full">⏱ {item.duracionHoras}h</span>
          {item.servicios.slice(0, 3).map(s => (
            <span key={s} className="text-xs" title={s}>{SERVICIOS_ICONOS[s] ?? '✓'}</span>
          ))}
        </div>
      </div>
    </Link>
  )
}

function tourToItems(tour: ConfigTour): ItemListing[] {
  const base = {
    tourId: tour.id,
    municipio: tour.comercio.municipio,
    precio: Number(tour.precioPersona),
    duracionHoras: tour.duracionHoras,
    confirmacionAuto: tour.confirmacionAuto,
    maxParticipantes: tour.maxParticipantes,
    servicios: tour.servicios,
    idiomas: tour.idiomas,
    operadorNombre: tour.comercio.nombre,
    operadorLogo: tour.comercio.logoUrl,
    calificacion: tour.comercio.calificacion,
    totalReviews: tour.comercio.totalReviews,
    latitud: tour.comercio.latitud,
    longitud: tour.comercio.longitud,
  }

  const lugares = (tour.lugares ?? []).filter(l => l.activo)
  if (lugares.length === 0) {
    // Sin lugares: usar el tour mismo como una tarjeta
    return [{
      ...base,
      titulo: tour.nombre,
      foto: tour.fotos[0],
    }]
  }

  return lugares.map(l => {
    const fotoLugar = l.media.find(m => m.tipo === 'FOTO' && m.activo)?.url
    return {
      ...base,
      lugarId: l.id,
      titulo: l.titulo,
      foto: fotoLugar ?? tour.fotos[0],
      tipo: l.tipo,
    }
  })
}

const SERVICIOS_FILTRO = [
  { key: 'transporte', label: '🚐 Transporte' },
  { key: 'almuerzo',   label: '🍱 Almuerzo' },
  { key: 'guia',       label: '🧭 Guía' },
  { key: 'seguro',     label: '🛡️ Seguro' },
]

export default function ToursPage() {
  const [tours, setTours]           = useState<ConfigTour[]>([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState('')
  const [tardando, setTardando]     = useState(false)
  const [busqueda, setBusqueda]     = useState('')
  const [userLat, setUserLat]       = useState<number | null>(null)
  const [userLon, setUserLon]       = useState<number | null>(null)
  const [gpsCargando, setGpsCargando] = useState(false)
  const [gpsCiudad, setGpsCiudad]   = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [precioMax, setPrecioMax]   = useState(0)
  const [durMax, setDurMax]         = useState(0)
  const [serviciosFiltro, setServiciosFiltro] = useState<string[]>([])
  const [vista, setVista]           = useState<'lista' | 'mapa'>('lista')

  function cargar() {
    setCargando(true)
    setError('')
    const t = setTimeout(() => setTardando(true), 6000)
    listarTours()
      .then(d => setTours(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No pudimos cargar los tours.'))
      .finally(() => { setCargando(false); clearTimeout(t) })
  }

  useEffect(() => { cargar() }, [])

  function activarGPS() {
    if (!navigator.geolocation) return
    setGpsCargando(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        setUserLat(lat); setUserLon(lon)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const j = await res.json()
          setGpsCiudad((j.address?.city || j.address?.town || j.address?.village || '').replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim())
        } catch {}
        setGpsCargando(false)
      },
      () => setGpsCargando(false)
    )
  }

  const items: ItemListing[] = tours.flatMap(tourToItems)

  const maxPrecioReal = items.length > 0 ? Math.max(...items.map(i => i.precio)) : 0
  const maxDurReal = items.length > 0 ? Math.max(...items.map(i => i.duracionHoras)) : 0

  const filtrados = items.filter(i => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!i.titulo.toLowerCase().includes(q) && !i.operadorNombre.toLowerCase().includes(q) && !i.municipio.toLowerCase().includes(q)) return false
    }
    if (precioMax > 0 && i.precio > precioMax) return false
    if (durMax > 0 && i.duracionHoras > durMax) return false
    if (serviciosFiltro.length > 0 && !serviciosFiltro.every(s => i.servicios.includes(s))) return false
    return true
  })

  const ordenados = userLat && userLon
    ? [...filtrados].sort((a, b) => {
        const da = a.latitud && a.longitud ? distanciaKm(userLat, userLon, a.latitud, a.longitud) : 9999
        const db = b.latitud && b.longitud ? distanciaKm(userLat, userLon, b.latitud, b.longitud) : 9999
        return da - db
      })
    : filtrados

  const filtrosActivos = (precioMax > 0 ? 1 : 0) + (durMax > 0 ? 1 : 0) + serviciosFiltro.length

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ backgroundImage: "linear-gradient(135deg, rgba(13,43,29,0.88) 0%, rgba(27,67,50,0.80) 50%, rgba(45,106,79,0.75) 100%), url('https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1600&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-72 h-72 bg-white/5 rounded-full" />
        <div className="absolute top-12 -left-10 w-40 h-40 bg-[#D4A017]/10 rounded-full" />
        <div className="absolute bottom-0 right-1/3 w-96 h-32 bg-[#52B788]/10 rounded-full blur-2xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          {/* Back link */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Inicio
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#D4A017]/20 border border-[#D4A017]/30 text-[#D4A017] text-xs font-semibold px-3 py-1 rounded-full">
                  🌿 Turismo auténtico
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Tours & Experiencias<br />
                <span className="text-[#52B788]">de Colombia</span>
              </h1>
              <p className="text-white/55 text-sm mt-2.5 max-w-sm">
                Vive el territorio colombiano con guías locales que conocen cada rincón
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-4 sm:gap-6">
              {[
                { label: 'Experiencias', value: items.length > 0 ? `${items.length}` : '–' },
                {
                  label: 'Regiones',
                  value: (() => {
                    const n = new Set(tours.map(t => t.comercio?.departamento).filter(Boolean)).size
                    return n > 0 ? `${n}` : '–'
                  })(),
                },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-white/50 text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Search bar within hero */}
          <div className="mt-6 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-2 flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Tour, destino o guía…"
                className="w-full pl-10 pr-4 py-2.5 bg-transparent text-white placeholder-white/40 text-sm focus:outline-none" />
            </div>
            <button onClick={activarGPS}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                userLat ? 'bg-blue-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}>
              {gpsCargando ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              )}
              {gpsCiudad || 'Cerca de mí'}
            </button>
            <button onClick={() => setMostrarFiltros(v => !v)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mostrarFiltros || filtrosActivos > 0 ? 'bg-[#D4A017] text-white' : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              Filtros
              {filtrosActivos > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[#D4A017] text-[9px] font-black rounded-full flex items-center justify-center">
                  {filtrosActivos}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── FILTROS (desplegables) ─────────────────────────── */}
      {mostrarFiltros && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span className="font-medium">Precio máximo</span>
                  <span className="font-semibold text-[#2D6A4F]">{precioMax > 0 ? `$${precioMax.toLocaleString('es-CO')}` : 'Cualquiera'}</span>
                </div>
                <input type="range" min={0} max={maxPrecioReal || 500000} step={10000} value={precioMax}
                  onChange={e => setPrecioMax(Number(e.target.value))}
                  className="w-full accent-[#2D6A4F]" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span className="font-medium">Duración máxima</span>
                  <span className="font-semibold text-[#2D6A4F]">{durMax > 0 ? `${durMax}h` : 'Cualquiera'}</span>
                </div>
                <input type="range" min={0} max={maxDurReal || 24} step={1} value={durMax}
                  onChange={e => setDurMax(Number(e.target.value))}
                  className="w-full accent-[#2D6A4F]" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Servicios incluidos</p>
              <div className="flex flex-wrap gap-2">
                {SERVICIOS_FILTRO.map(s => {
                  const sel = serviciosFiltro.includes(s.key)
                  return (
                    <button key={s.key} onClick={() => setServiciosFiltro(prev =>
                      sel ? prev.filter(x => x !== s.key) : [...prev, s.key]
                    )} className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                      sel ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#2D6A4F]'
                    }`}>{s.label}</button>
                  )
                })}
                {filtrosActivos > 0 && (
                  <button onClick={() => { setPrecioMax(0); setDurMax(0); setServiciosFiltro([]) }}
                    className="px-3 py-1.5 rounded-full text-xs border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                    × Limpiar todo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOOLBAR resultado ─────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {cargando ? 'Cargando…' : (
              <><span className="font-semibold text-gray-800">{ordenados.length}</span> {ordenados.length !== 1 ? 'experiencias' : 'experiencia'}{userLat ? <span className="text-[#2D6A4F]"> · ordenadas por cercanía</span> : ''}</>
            )}
          </p>
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => setVista('lista')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${vista === 'lista' ? 'bg-[#1B4332] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Lista
            </button>
            <button onClick={() => setVista('mapa')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${vista === 'mapa' ? 'bg-[#1B4332] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
              Mapa
            </button>
          </div>
        </div>
      </div>

      {/* ── CONTENIDO ─────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm mb-4 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={cargar} className="shrink-0 font-semibold underline hover:no-underline">Reintentar</button>
          </div>
        )}

        {vista === 'mapa' && !cargando && (
          <div className="mb-6 rounded-2xl overflow-hidden shadow-md">
            <MapaTours tours={tours} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {cargando && tardando && (
          <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-4">
            ⏳ La API está despertando… puede tardar hasta 30 segundos la primera vez del día.
          </p>
        )}

        {cargando ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonTour key={i} />)}
          </div>
        ) : vista === 'mapa' ? null : ordenados.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-[#1B4332]/8 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
            </div>
            <p className="font-semibold text-gray-700 text-lg">No hay tours disponibles</p>
            <p className="text-sm text-gray-400 mt-1">Intenta con otra búsqueda o limpia los filtros</p>
            {filtrosActivos > 0 && (
              <button onClick={() => { setPrecioMax(0); setDurMax(0); setServiciosFiltro([]) }}
                className="mt-4 px-5 py-2 bg-[#1B4332] text-white text-sm rounded-full font-medium">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ordenados.map((item, i) => <TarjetaItem key={`${item.tourId}-${item.lugarId ?? i}`} item={item} userLat={userLat} userLon={userLon} />)}
          </div>
        )}
      </main>
    </div>
  )
}
