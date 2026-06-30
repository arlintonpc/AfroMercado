'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { listarHoteles, type ConfigHotel } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { optimizarImagenPequena } from '@/lib/cloudinary'

const MapaHoteles = dynamic(() => import('@/components/hoteles/MapaHoteles'), { ssr: false })

const SERVICIOS_ICONOS: Record<string, string> = {
  wifi: '📶', desayuno: '🍳', parking: '🅿️', piscina: '🏊', restaurante: '🍽️',
  aire: '❄️', gym: '💪', spa: '💆', bar: '🍸', mascotas: '🐾',
}

const SERVICIOS_FILTRO = [
  { key: 'wifi', label: 'WiFi' },
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'parking', label: 'Parking' },
  { key: 'piscina', label: 'Piscina' },
  { key: 'mascotas', label: 'Mascotas' },
  { key: 'aire', label: 'Aire' },
]

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function TarjetaHotel({ hotel, userLat, userLon }: { hotel: ConfigHotel; userLat: number | null; userLon: number | null }) {
  const desde = hotel.habitaciones.length > 0
    ? Math.min(...hotel.habitaciones.map(h => Number(h.precioPorNoche)))
    : null
  const dist = userLat && userLon && hotel.comercio.latitud && hotel.comercio.longitud
    ? distanciaKm(userLat, userLon, hotel.comercio.latitud, hotel.comercio.longitud)
    : null
  const foto = hotel.habitaciones.find(h => h.fotos.length > 0)?.fotos[0] ?? null
  const rating = Number(hotel.comercio.calificacion)
  const reviews = Number(hotel.comercio.totalReviews)

  return (
    <Link href={`/hoteles/${hotel.id}`} className="group block">
      {/* Imagen */}
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 mb-3">
        {foto ? (
          <img
            src={optimizarImagenPequena(foto)}
            alt={hotel.comercio.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1B4332] to-[#40916C] flex items-center justify-center">
            <span className="text-6xl opacity-30">🏨</span>
          </div>
        )}

        {/* Badge distancia */}
        {dist !== null && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
          </span>
        )}

        {/* Servicios top */}
        {hotel.servicios.length > 0 && (
          <div className="absolute bottom-3 left-3 flex gap-1">
            {hotel.servicios.slice(0, 4).map(s => (
              <span key={s} className="bg-white/90 backdrop-blur-sm text-sm w-7 h-7 rounded-full flex items-center justify-center shadow-sm" title={s}>
                {SERVICIOS_ICONOS[s] ?? '✓'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-[#111] text-sm leading-snug truncate group-hover:text-[#1B4332] transition-colors">
              {hotel.comercio.nombre}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}
            </p>
          </div>
          {reviews > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span className="text-xs font-semibold text-[#111]">{rating.toFixed(2)}</span>
            </div>
          )}
        </div>

        {desde !== null && (
          <div className="mt-1.5">
            <span className="text-sm font-semibold text-[#111]">{formatearPrecio(desde)}</span>
            <span className="text-xs text-gray-500"> / noche</span>
          </div>
        )}
        {hotel.habitaciones.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">{hotel.habitaciones.length} tipo{hotel.habitaciones.length !== 1 ? 's' : ''} de habitación</p>
        )}
      </div>
    </Link>
  )
}

function PanelFiltros({ onClose, filtros, onChange }: {
  onClose: () => void
  filtros: { precioMax: number; capacidad: number; servicios: string[] }
  onChange: (f: { precioMax: number; capacidad: number; servicios: string[] }) => void
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
                <label className="text-sm font-semibold text-[#111]">Precio máximo por noche</label>
                <span className="text-sm font-bold text-[#1B4332]">
                  {local.precioMax === 0 ? 'Sin límite' : formatearPrecio(local.precioMax)}
                </span>
              </div>
              <input type="range" min={0} max={500000} step={10000} value={local.precioMax}
                onChange={e => setLocal(p => ({ ...p, precioMax: Number(e.target.value) }))}
                className="w-full accent-[#1B4332]" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Sin límite</span><span>{formatearPrecio(500000)}</span>
              </div>
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
              <label className="text-sm font-semibold text-[#111] block mb-3">Servicios</label>
              <div className="flex flex-wrap gap-2">
                {SERVICIOS_FILTRO.map(s => {
                  const sel = local.servicios.includes(s.key)
                  return (
                    <button key={s.key} onClick={() => setLocal(p => ({
                      ...p,
                      servicios: sel ? p.servicios.filter(x => x !== s.key) : [...p.servicios, s.key]
                    }))} className={`px-4 py-2 rounded-full text-xs font-semibold border-2 transition-colors ${
                      sel ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4332]'
                    }`}>
                      {SERVICIOS_ICONOS[s.key]} {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button onClick={() => { setLocal({ precioMax: 0, capacidad: 1, servicios: [] }); onChange({ precioMax: 0, capacidad: 1, servicios: [] }); onClose() }}
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

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] bg-gray-200 rounded-2xl mb-3" />
      <div className="px-0.5 space-y-2">
        <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
        <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
        <div className="h-4 bg-gray-200 rounded-lg w-1/3 mt-1" />
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
  const [filtros, setFiltros] = useState({ precioMax: 0, capacidad: 1, servicios: [] as string[] })

  useEffect(() => {
    const t = setTimeout(() => setTardando(true), 6000)
    listarHoteles().then(data => { setHoteles(data); setCargando(false) }).finally(() => clearTimeout(t))
  }, [])

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
          const ciudad = (j.address?.city || j.address?.town || j.address?.village || '')
            .replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim()
          setGpsCiudad(ciudad)
        } catch {}
        setGpsCargando(false)
      },
      () => setGpsCargando(false)
    )
  }

  const filtrosActivos = filtros.precioMax > 0 || filtros.capacidad > 1 || filtros.servicios.length > 0

  const filtrados = hoteles.filter(h => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const coincide = h.comercio.nombre.toLowerCase().includes(q) ||
        h.comercio.municipio.toLowerCase().includes(q) ||
        (h.comercio.departamento?.toLowerCase().includes(q) ?? false)
      if (!coincide) return false
    }
    if (filtros.precioMax > 0) {
      const min = h.habitaciones.length > 0 ? Math.min(...h.habitaciones.map(hab => Number(hab.precioPorNoche))) : Infinity
      if (min > filtros.precioMax) return false
    }
    if (filtros.capacidad > 1) {
      const maxCap = h.habitaciones.length > 0 ? Math.max(...h.habitaciones.map(hab => hab.capacidad)) : 0
      if (maxCap < filtros.capacidad) return false
    }
    if (filtros.servicios.length > 0) {
      if (!filtros.servicios.every(s => h.servicios.includes(s))) return false
    }
    return true
  })

  const ordenados = userLat && userLon
    ? [...filtrados].sort((a, b) => {
        const da = a.comercio.latitud && a.comercio.longitud ? distanciaKm(userLat, userLon, a.comercio.latitud, a.comercio.longitud) : 9999
        const db = b.comercio.latitud && b.comercio.longitud ? distanciaKm(userLat, userLon, b.comercio.latitud, b.comercio.longitud) : 9999
        return da - db
      })
    : filtrados

  return (
    <div className="min-h-screen bg-white">

      {/* Header sticky */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <Link href="/" className="flex-shrink-0 text-gray-500 hover:text-gray-800 transition-colors p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </Link>

            {/* Buscador central */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar ciudad, hotel, hospedaje…"
                  className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#1B4332] transition-colors bg-gray-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setMostrarFiltros(true)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                  filtrosActivos
                    ? 'border-[#1B4332] bg-[#1B4332] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                }`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
                Filtros
                {filtrosActivos && <span className="bg-white text-[#1B4332] rounded-full w-5 h-5 flex items-center justify-center text-xs font-black">
                  {[filtros.precioMax > 0, filtros.capacidad > 1, filtros.servicios.length > 0].filter(Boolean).length}
                </span>}
              </button>

              <button
                onClick={activarGPS}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                  userLat ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                }`}>
                {gpsCargando
                  ? <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>
                }
                {gpsCiudad || 'Cerca de mí'}
              </button>

              <button
                onClick={() => setVista(v => v === 'lista' ? 'mapa' : 'lista')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border-2 border-gray-200 text-gray-600 hover:border-gray-300 bg-white transition-colors">
                {vista === 'lista'
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg> Mapa</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Lista</>
                }
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">

        {/* Hero título */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-[#111] tracking-tight">
            Hoteles y Hospedaje
          </h1>
          <p className="text-gray-500 mt-1 text-base">
            {cargando ? 'Buscando alojamientos…' : (
              ordenados.length > 0
                ? `${ordenados.length} alojamiento${ordenados.length !== 1 ? 's' : ''} en el Chocó${userLat ? ' · ordenados por cercanía' : ''}`
                : 'Turismo afrocolombianos del Chocó'
            )}
          </p>
        </div>

        {/* Mapa */}
        {vista === 'mapa' && (
          <div className="mb-8 rounded-3xl overflow-hidden border border-gray-200 shadow-sm">
            <MapaHoteles hoteles={ordenados} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {/* Aviso lentitud */}
        {cargando && tardando && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6 text-sm text-amber-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            La API está despertando — puede tardar hasta 30 seg la primera vez del día.
          </div>
        )}

        {/* Grid */}
        {cargando ? (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : ordenados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#111] mb-2">
              {busqueda || filtrosActivos ? 'Sin resultados' : 'Próximamente'}
            </h3>
            <p className="text-gray-400 text-sm max-w-xs">
              {busqueda
                ? `No encontramos hoteles para "${busqueda}"`
                : filtrosActivos
                ? 'Ningún hotel cumple los filtros seleccionados'
                : 'Estamos incorporando hoteles y hospedajes del Chocó. Vuelve pronto.'}
            </p>
            {(busqueda || filtrosActivos) && (
              <div className="flex gap-3 mt-6">
                {busqueda && (
                  <button onClick={() => setBusqueda('')}
                    className="px-5 py-2.5 border-2 border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:border-gray-300 transition-colors">
                    Limpiar búsqueda
                  </button>
                )}
                {filtrosActivos && (
                  <button onClick={() => setFiltros({ precioMax: 0, capacidad: 1, servicios: [] })}
                    className="px-5 py-2.5 bg-[#1B4332] text-white rounded-full text-sm font-semibold hover:bg-[#2D6A4F] transition-colors">
                    Quitar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ordenados.map(h => <TarjetaHotel key={h.id} hotel={h} userLat={userLat} userLon={userLon} />)}
          </div>
        )}
      </main>

      {mostrarFiltros && (
        <PanelFiltros filtros={filtros} onChange={setFiltros} onClose={() => setMostrarFiltros(false)} />
      )}
    </div>
  )
}
