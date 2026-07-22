'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { listarHoteles, type ConfigHotel, type TipoAlojamiento, TIPOS_ALOJAMIENTO } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { optimizarImagenPequena } from '@/lib/cloudinary'
import BannerDisplay from '@/components/publicidad/BannerDisplay'

const MapaHoteles = dynamic(() => import('@/components/hoteles/MapaHoteles'), { ssr: false })

const SERVICIOS_ICONOS: Record<string, string> = {
  wifi: '📶', desayuno: '🍳', parking: '🅿️', piscina: '🏊', restaurante: '🍽️',
  aire: '❄️', gym: '💪', spa: '💆', bar: '🍸', mascotas: '🐾',
}

const SERVICIOS_FILTRO = [
  { key: 'wifi', label: '📶 WiFi' },
  { key: 'desayuno', label: '🍳 Desayuno' },
  { key: 'parking', label: '🅿️ Parking' },
  { key: 'piscina', label: '🏊 Piscina' },
  { key: 'mascotas', label: '🐾 Mascotas' },
  { key: 'aire', label: '❄️ Aire acond.' },
]

const RADIO_CERCA_KM = 150

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse shadow-sm">
      <div className="h-52 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="flex justify-between mt-3">
          <div className="h-3 bg-gray-100 rounded w-16" />
          <div className="h-5 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  )
}

function TarjetaHotel({ hotel, userLat, userLon }: { hotel: ConfigHotel; userLat: number | null; userLon: number | null }) {
  const desde = hotel.habitaciones.length > 0
    ? Math.min(...hotel.habitaciones.map(h => Number(h.precioPorNoche)))
    : null
  const tiposDistintos = new Set(hotel.habitaciones.map(h => h.tipoAlojamiento ?? 'HABITACION'))
  const tipoUnico = tiposDistintos.size === 1 ? [...tiposDistintos][0] as TipoAlojamiento : null
  const badgeTipo = tipoUnico && tipoUnico !== 'HABITACION'
    ? TIPOS_ALOJAMIENTO.find(t => t.value === tipoUnico)
    : tiposDistintos.size > 1 ? { icono: '✨', label: 'Varios tipos' } : null
  const dist = userLat && userLon && hotel.comercio.latitud && hotel.comercio.longitud
    ? distanciaKm(userLat, userLon, hotel.comercio.latitud, hotel.comercio.longitud)
    : null
  const foto = hotel.habitaciones.find(h => h.fotos.length > 0)?.fotos[0] ?? null
  const rating = Number(hotel.comercio.calificacion)
  const reviews = Number(hotel.comercio.totalReviews)
  const inicial = hotel.comercio.nombre.charAt(0).toUpperCase()

  return (
    <Link href={`/hoteles/${hotel.id}`} className="group block rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-white shadow-sm relative h-[18rem] sm:h-96">
      {/* Imagen full */}
      <div className="absolute inset-0 bg-[#1B4332]">
        {foto ? (
          <img src={optimizarImagenPequena(foto)} alt={hotel.comercio.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#52B788] flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="0.8" strokeLinecap="round" className="opacity-20">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        )}
      </div>
      {/* Overlay gradiente profundo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      {/* Badges superiores */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col gap-1 sm:gap-1.5 items-start">
        {badgeTipo && (
          <span className="bg-white/10 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/20 shadow-sm">{badgeTipo.icono} {badgeTipo.label}</span>
        )}
        {hotel.habitaciones.length === 1 && (
          <span className="bg-red-500/90 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-sm">🔥 Última unidad</span>
        )}
      </div>

      {/* Precio */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl px-2 py-1 sm:px-3 sm:py-2 shadow-xl border border-white/40">
        <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium leading-none mb-0.5 text-right">desde</p>
        <p className="text-[#1A1A1A] font-black text-sm sm:text-base leading-none">
          {desde !== null ? formatearPrecio(desde) : '–'}
        </p>
      </div>

      {/* Info inferior superpuesta */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5">
        <p className="text-white/80 text-[10px] sm:text-xs font-semibold mb-1 sm:mb-2 uppercase tracking-widest flex items-center justify-between gap-1">
          <span className="truncate">📍 {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}</span>
          {dist !== null && (
            <span className="bg-black/50 backdrop-blur-sm px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] text-white/90 whitespace-nowrap flex-shrink-0">
              {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
            </span>
          )}
        </p>
        <h3 className="text-white font-black text-lg sm:text-2xl leading-tight line-clamp-2 mb-2 sm:mb-4 drop-shadow-md">{hotel.comercio.nombre}</h3>
        
        <div className="flex items-center justify-between border-t border-white/20 pt-2 sm:pt-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
              {hotel.comercio.logoUrl ? (
                <img src={hotel.comercio.logoUrl} alt={hotel.comercio.nombre} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold">{inicial}</span>
              )}
            </div>
            {reviews > 0 ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B" className="sm:w-3.5 sm:h-3.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <span className="text-xs sm:text-sm font-black text-white">{rating.toFixed(1)}</span>
                </div>
                <span className="text-[8px] sm:text-[10px] text-white/70 font-medium tracking-wide">({reviews} RESEÑAS)</span>
              </div>
            ) : (
              <span className="text-[9px] sm:text-[11px] text-white/50 font-medium">Sin reseñas</span>
            )}
          </div>
          {hotel.servicios.length > 0 && (
            <div className="flex gap-1 sm:gap-1.5 flex-shrink-0">
              {hotel.servicios.slice(0, 3).map(s => (
                <span key={s} className="text-[10px] sm:text-xs bg-white/10 backdrop-blur-md w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border border-white/10 shadow-sm" title={s}>{SERVICIOS_ICONOS[s] ?? '✓'}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function PanelFiltros({ onClose, filtros, onChange }: {
  onClose: () => void
  filtros: { precioMax: number; capacidad: number; servicios: string[]; tipos: TipoAlojamiento[] }
  onChange: (f: { precioMax: number; capacidad: number; servicios: string[]; tipos: TipoAlojamiento[] }) => void
}) {
  const [local, setLocal] = useState(filtros)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-[#111]">Filtros</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-3">
                <label className="text-sm font-semibold text-[#111]">Precio máximo / noche</label>
                <span className="text-sm font-bold text-[#1B4332]">{local.precioMax === 0 ? 'Sin límite' : formatearPrecio(local.precioMax)}</span>
              </div>
              <input type="range" min={0} max={500000} step={10000} value={local.precioMax}
                onChange={e => setLocal(p => ({ ...p, precioMax: Number(e.target.value) }))}
                className="w-full accent-[#1B4332]" />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#111] block mb-3">
                Huéspedes: <span className="text-[#1B4332]">{local.capacidad === 1 ? 'Cualquiera' : `${local.capacidad}+ personas`}</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setLocal(p => ({ ...p, capacidad: n }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      local.capacidad === n ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4332]'
                    }`}>
                    {n === 1 ? 'Todos' : `${n}+`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#111] block mb-3">Tipo de alojamiento</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_ALOJAMIENTO.map(t => {
                  const sel = local.tipos.includes(t.value)
                  return (
                    <button key={t.value} onClick={() => setLocal(p => ({
                      ...p, tipos: sel ? p.tipos.filter(x => x !== t.value) : [...p.tipos, t.value]
                    }))} className={`px-4 py-2 rounded-full text-xs font-semibold border-2 transition-colors ${
                      sel ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4332]'
                    }`}>{t.icono} {t.label}</button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#111] block mb-3">Servicios</label>
              <div className="flex flex-wrap gap-2">
                {SERVICIOS_FILTRO.map(s => {
                  const sel = local.servicios.includes(s.key)
                  return (
                    <button key={s.key} onClick={() => setLocal(p => ({
                      ...p, servicios: sel ? p.servicios.filter(x => x !== s.key) : [...p.servicios, s.key]
                    }))} className={`px-4 py-2 rounded-full text-xs font-semibold border-2 transition-colors ${
                      sel ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4332]'
                    }`}>{s.label}</button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={() => { const vacio = { precioMax: 0, capacidad: 1, servicios: [], tipos: [] as TipoAlojamiento[] }; setLocal(vacio); onChange(vacio); onClose() }}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-2xl text-sm hover:border-gray-300 transition-colors">
              Limpiar
            </button>
            <button onClick={() => { onChange(local); onClose() }}
              className="flex-1 bg-[#1B4332] text-white font-bold py-3 rounded-2xl text-sm hover:bg-[#2D6A4F] transition-colors">
              Mostrar resultados
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HotelesPage() {
  const [hoteles, setHoteles] = useState<ConfigHotel[]>([])
  const [cargando, setCargando] = useState(true)
  const [tardando, setTardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [gpsCargando, setGpsCargando] = useState(false)
  const [gpsCiudad, setGpsCiudad] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtros, setFiltros] = useState({ precioMax: 0, capacidad: 1, servicios: [] as string[], tipos: [] as TipoAlojamiento[] })
  const [fotoHeroIdx, setFotoHeroIdx] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setTardando(true), 6000)
    listarHoteles().then(data => { setHoteles(data); setCargando(false) }).finally(() => clearTimeout(t))
  }, [])

  const heroFotos = useMemo(() => {
    const urls = new Set<string>()
    hoteles.forEach(h => {
      h.habitaciones?.forEach((hab: any) => {
        hab.fotos?.forEach((f: string) => urls.add(f))
      })
    })
    const arr = Array.from(urls)
    return arr.length > 0 ? arr : ['https://images.unsplash.com/photo-1542314831-c6a4d14d8387?auto=format&fit=crop&w=1600&q=80']
  }, [hoteles])

  useEffect(() => {
    if (heroFotos.length <= 1) return
    const id = setInterval(() => {
      setFotoHeroIdx(prev => (prev + 1) % heroFotos.length)
    }, 4000)
    return () => clearInterval(id)
  }, [heroFotos])

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
          setGpsCiudad((j.address?.city || j.address?.town || j.address?.village || '')
            .replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim())
        } catch {}
        setGpsCargando(false)
      },
      () => setGpsCargando(false)
    )
  }

  const filtrosActivos = filtros.precioMax > 0 || filtros.capacidad > 1 || filtros.servicios.length > 0 || filtros.tipos.length > 0
  const nFiltros = [filtros.precioMax > 0, filtros.capacidad > 1, filtros.servicios.length > 0, filtros.tipos.length > 0].filter(Boolean).length

  const banners = hoteles.filter((h: any) => h.esBannerDisplay)
  const organicos = hoteles.filter((h: any) => !h.esBannerDisplay)

  let filtrados = organicos.filter(h => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!h.comercio.nombre.toLowerCase().includes(q) && !h.comercio.municipio.toLowerCase().includes(q) && !(h.comercio.departamento?.toLowerCase().includes(q) ?? false)) return false
    }
    if (filtros.precioMax > 0) {
      const min = h.habitaciones.length > 0 ? Math.min(...h.habitaciones.map(hab => Number(hab.precioPorNoche))) : Infinity
      if (min > filtros.precioMax) return false
    }
    if (filtros.capacidad > 1) {
      const maxCap = h.habitaciones.length > 0 ? Math.max(...h.habitaciones.map(hab => hab.capacidad)) : 0
      if (maxCap < filtros.capacidad) return false
    }
    if (filtros.servicios.length > 0 && !filtros.servicios.every(s => h.servicios.includes(s))) return false
    if (filtros.tipos.length > 0 && !h.habitaciones.some(hab => filtros.tipos.includes(hab.tipoAlojamiento ?? 'HABITACION'))) return false
    return true
  })

  if (userLat && userLon) {
    filtrados = [...filtrados].sort((a, b) => {
        const da = a.comercio.latitud && a.comercio.longitud ? distanciaKm(userLat, userLon, a.comercio.latitud, a.comercio.longitud) : 9999
        const db = b.comercio.latitud && b.comercio.longitud ? distanciaKm(userLat, userLon, b.comercio.latitud, b.comercio.longitud) : 9999
        return da - db
      })
  }

  const cercanos = userLat && userLon
    ? filtrados.filter(h => h.comercio.latitud && h.comercio.longitud && distanciaKm(userLat, userLon, h.comercio.latitud, h.comercio.longitud) <= RADIO_CERCA_KM)
    : filtrados

  const ordenados = [...cercanos]
  if (banners.length > 0 && ordenados.length >= 3) {
    ordenados.splice(3, 0, banners[0])
    if (banners.length > 1 && ordenados.length >= 7) {
      ordenados.splice(7, 0, banners[1])
    }
  }

  const sinCercania = userLat != null && userLon != null && cercanos.length === 0 && ordenados.length > 0

  function limpiarGPS() {
    setUserLat(null); setUserLon(null); setGpsCiudad('')
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden min-h-[280px] sm:min-h-[320px] flex flex-col justify-end bg-[#111]">
        {heroFotos.map((url, idx) => (
          <img 
            key={url}
            src={url} 
            alt="Hoteles de Colombia"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === fotoHeroIdx ? 'opacity-100' : 'opacity-0'}`} 
          />
        ))}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute top-0 right-0 p-12 opacity-30 pointer-events-none">
          <div className="w-72 h-72 bg-white/20 rounded-full blur-3xl mix-blend-overlay" />
        </div>

        <div className="relative max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Inicio
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#D4A017]/20 border border-[#D4A017]/30 text-[#D4A017] text-xs font-semibold px-3 py-1 rounded-full">
                  🏨 Alojamiento auténtico
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Hoteles y Hospedaje<br />
                <span className="text-[#52B788]">de Colombia</span>
              </h1>
              <p className="text-white/55 text-sm mt-2.5 max-w-sm">
                Alójate con familias y establecimientos locales en el corazón de cada territorio
              </p>
            </div>
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{hoteles.length > 0 ? `${hoteles.length}` : '–'}</p>
                <p className="text-white/50 text-xs">Alojamientos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">
                  {(() => {
                    const n = new Set(hoteles.map(h => h.comercio?.departamento).filter(Boolean)).size
                    return n > 0 ? `${n}` : '–'
                  })()}
                </p>
                <p className="text-white/50 text-xs">Regiones</p>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda dentro del hero */}
          <div className="mt-6 bg-white shadow-2xl rounded-2xl p-2 flex flex-col sm:flex-row gap-2 border border-gray-100 relative z-10">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Ciudad, hotel, hospedaje…"
                className="w-full pl-10 pr-4 py-2.5 bg-transparent text-gray-900 placeholder-gray-400 text-sm font-medium focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={activarGPS}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  userLat ? 'bg-[#1B4332] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}>
                {gpsCargando ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                )}
                {gpsCiudad || 'Cerca de mí'}
              </button>
              <button onClick={() => setMostrarFiltros(v => !v)}
                className={`relative flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  mostrarFiltros || filtrosActivos ? 'bg-[#D4A017] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                Filtros
                {filtrosActivos && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[#D4A017] text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                    {nFiltros}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {cargando ? 'Buscando alojamientos…' : (
              <><span className="font-semibold text-gray-800">{cercanos.length}</span> {cercanos.length !== 1 ? 'alojamientos' : 'alojamiento'}{userLat ? <span className="text-[#2D6A4F]"> · a menos de {RADIO_CERCA_KM}km</span> : ''}</>
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

      {/* ── CONTENIDO ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {vista === 'mapa' && !cargando && (
          <div className="mb-6 rounded-2xl overflow-hidden shadow-md">
            <MapaHoteles hoteles={cercanos} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {cargando && tardando && (
          <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-4">
            ⏳ La API está despertando… puede tardar hasta 30 segundos la primera vez del día.
          </p>
        )}

        {cargando ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : vista === 'mapa' ? null : cercanos.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-[#1B4332]/8 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <p className="font-semibold text-gray-700 text-lg">
              {busqueda || filtrosActivos ? 'Sin resultados' : sinCercania ? 'Nada cerca de ti todavía' : 'Próximamente'}
            </p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
              {busqueda
                ? `No encontramos hoteles para "${busqueda}"`
                : filtrosActivos
                ? 'Ningún hotel cumple los filtros seleccionados'
                : sinCercania
                ? `No hay alojamientos a menos de ${RADIO_CERCA_KM}km de tu ubicación.`
                : 'Estamos incorporando hoteles y hospedajes de todo el país. Vuelve pronto.'}
            </p>
            {(busqueda || filtrosActivos || sinCercania) && (
              <div className="flex gap-3 mt-5 justify-center">
                {busqueda && (
                  <button onClick={() => setBusqueda('')}
                    className="px-5 py-2 border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors">
                    Limpiar búsqueda
                  </button>
                )}
                {filtrosActivos && (
                  <button onClick={() => setFiltros({ precioMax: 0, capacidad: 1, servicios: [], tipos: [] })}
                    className="px-5 py-2 bg-[#1B4332] text-white rounded-full text-sm font-medium hover:bg-[#2D6A4F] transition-colors">
                    Quitar filtros
                  </button>
                )}
                {sinCercania && (
                  <button onClick={limpiarGPS}
                    className="px-5 py-2 bg-[#1B4332] text-white rounded-full text-sm font-medium hover:bg-[#2D6A4F] transition-colors">
                    Ver todos los alojamientos
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cercanos.map((h: any) => (
              h.esBannerDisplay ? (
                <div key={h.id} className="col-span-full mt-2 mb-2">
                  <BannerDisplay banner={h} />
                </div>
              ) : (
                <TarjetaHotel key={h.id} hotel={h} userLat={userLat} userLon={userLon} />
              )
            ))}
          </div>
        )}
      </main>

      {mostrarFiltros && (
        <PanelFiltros filtros={filtros} onChange={setFiltros} onClose={() => setMostrarFiltros(false)} />
      )}
    </div>
  )
}
