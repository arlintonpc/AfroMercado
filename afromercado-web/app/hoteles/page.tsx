'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { listarHoteles, type ConfigHotel } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'

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
  { key: 'aire', label: '❄️ Aire' },
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

  return (
    <Link href={`/hoteles/${hotel.id}`} className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-44 bg-gradient-to-br from-[#2D6A4F] to-[#40916C] relative flex items-center justify-center">
        {hotel.habitaciones[0]?.fotos[0] ? (
          <img src={hotel.habitaciones[0].fotos[0]} alt={hotel.comercio.nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">🏨</span>
        )}
        {dist !== null && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            📍 {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-[#1A1A1A] truncate">{hotel.comercio.nombre}</h3>
            <p className="text-xs text-gray-500 mt-0.5">📍 {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}</p>
          </div>
          {Number(hotel.comercio.totalReviews) > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-yellow-400 text-xs">★</span>
              <span className="text-xs font-semibold">{Number(hotel.comercio.calificacion).toFixed(1)}</span>
              <span className="text-xs text-gray-400">({hotel.comercio.totalReviews})</span>
            </div>
          )}
        </div>

        {hotel.servicios.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hotel.servicios.slice(0, 5).map(s => (
              <span key={s} className="text-sm" title={s}>{SERVICIOS_ICONOS[s] ?? '✓'}</span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">{hotel.habitaciones.length} tipo{hotel.habitaciones.length !== 1 ? 's' : ''}</span>
          {desde !== null && (
            <div className="text-right">
              <span className="text-xs text-gray-400">Desde </span>
              <span className="font-bold text-[#2D6A4F]">{formatearPrecio(desde)}</span>
              <span className="text-xs text-gray-400">/noche</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Panel de filtros ──────────────────────────────────────────────
function PanelFiltros({ onClose, filtros, onChange }: {
  onClose: () => void
  filtros: { precioMax: number; capacidad: number; servicios: string[] }
  onChange: (f: { precioMax: number; capacidad: number; servicios: string[] }) => void
}) {
  const [local, setLocal] = useState(filtros)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-[#1A1A1A]">Filtros</h3>
            <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
          </div>

          <div className="space-y-5">
            {/* Precio máximo */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Precio máximo por noche</label>
                <span className="text-sm font-bold text-[#2D6A4F]">
                  {local.precioMax === 0 ? 'Sin límite' : formatearPrecio(local.precioMax)}
                </span>
              </div>
              <input type="range" min={0} max={500000} step={10000} value={local.precioMax}
                onChange={e => setLocal(p => ({ ...p, precioMax: Number(e.target.value) }))}
                className="w-full accent-[#2D6A4F]" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Sin límite</span><span>{formatearPrecio(500000)}</span>
              </div>
            </div>

            {/* Capacidad mínima */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Capacidad mínima: <span className="text-[#2D6A4F] font-bold">{local.capacidad === 1 ? 'Cualquiera' : `${local.capacidad}+ personas`}</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setLocal(p => ({ ...p, capacidad: n }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      local.capacidad === n ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                    {n === 1 ? 'Todas' : `${n}+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Servicios */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Servicios incluidos</label>
              <div className="flex flex-wrap gap-2">
                {SERVICIOS_FILTRO.map(s => {
                  const sel = local.servicios.includes(s.key)
                  return (
                    <button key={s.key} onClick={() => setLocal(p => ({
                      ...p,
                      servicios: sel ? p.servicios.filter(x => x !== s.key) : [...p.servicios, s.key]
                    }))} className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                      sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => { setLocal({ precioMax: 0, capacidad: 1, servicios: [] }); onChange({ precioMax: 0, capacidad: 1, servicios: [] }); onClose() }}
              className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">
              Limpiar
            </button>
            <button onClick={() => { onChange(local); onClose() }}
              className="flex-1 bg-[#2D6A4F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#40916C]">
              Aplicar filtros
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
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/" className="text-[#2D6A4F] p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </Link>
            <div>
              <h1 className="font-bold text-[#1A1A1A] text-lg leading-tight">Hoteles & Hospedaje</h1>
              <p className="text-xs text-gray-500">Turismo afrocolombianos del Chocó</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Ciudad, hotel…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <button onClick={() => setMostrarFiltros(true)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center gap-1 ${
                filtrosActivos ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              ⚙️{filtrosActivos ? ` (${[filtros.precioMax > 0, filtros.capacidad > 1, filtros.servicios.length > 0].filter(Boolean).length})` : ''}
            </button>
            <button onClick={activarGPS}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                userLat ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {gpsCargando ? <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : '📍'}
              {gpsCiudad || 'GPS'}
            </button>
            <button onClick={() => setVista(v => v === 'lista' ? 'mapa' : 'lista')}
              className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-600">
              {vista === 'lista' ? '🗺️' : '☰'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-10">
        <p className="text-xs text-gray-400 mb-3">
          {ordenados.length} hotel{ordenados.length !== 1 ? 'es' : ''}
          {userLat ? ' · ordenados por cercanía' : ''}
          {filtrosActivos ? ' · filtros activos' : ''}
        </p>

        {vista === 'mapa' && (
          <div className="mb-4">
            <MapaHoteles hoteles={ordenados} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {cargando && tardando && (
          <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-xl px-4 py-2 mb-2">
            ⏳ La API está despertando… puede tardar hasta 30 segundos la primera vez del día.
          </p>
        )}

        {cargando ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-44 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-full mt-3" />
                  <div className="flex justify-between mt-3">
                    <div className="h-3 bg-gray-100 rounded w-16" />
                    <div className="h-5 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : ordenados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏨</p>
            <p className="font-medium">No hay hoteles con esos filtros</p>
            {filtrosActivos && (
              <button onClick={() => setFiltros({ precioMax: 0, capacidad: 1, servicios: [] })}
                className="mt-3 text-sm text-[#2D6A4F] underline">Limpiar filtros</button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
