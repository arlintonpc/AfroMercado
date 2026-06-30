'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { listarTours, type ConfigTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'

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
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-200" />
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

function TarjetaTour({ tour, userLat, userLon }: { tour: ConfigTour; userLat: number | null; userLon: number | null }) {
  const dist = userLat && userLon && tour.comercio.latitud && tour.comercio.longitud
    ? distanciaKm(userLat, userLon, tour.comercio.latitud, tour.comercio.longitud)
    : null

  return (
    <Link href={`/tours/${tour.id}`} className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="h-44 bg-gradient-to-br from-[#40916C] to-[#74C69D] relative flex items-center justify-center">
        {tour.fotos[0] ? (
          <img src={tour.fotos[0]} alt={tour.nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">🗺️</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            ⏱️ {tour.duracionHoras}h
          </span>
          {tour.maxParticipantes > 0 && (
            <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
              👥 {tour.maxParticipantes}
            </span>
          )}
        </div>
        {dist !== null && (
          <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            📍 {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
          </span>
        )}
        {tour.confirmacionAuto && (
          <span className="absolute bottom-2 left-2 bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            ✓ Confirmación inmediata
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-[#1A1A1A] truncate">{tour.nombre}</h3>
        <p className="text-xs text-gray-500 mt-0.5 truncate">📍 {tour.comercio.municipio}</p>

        <EstrellasMini valor={tour.comercio.calificacion} total={tour.comercio.totalReviews} />

        {tour.descripcion && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{tour.descripcion}</p>
        )}

        {tour.servicios.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {tour.servicios.slice(0, 5).map(s => (
              <span key={s} className="text-base" title={s}>{SERVICIOS_ICONOS[s] ?? '✓'}</span>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">{tour.idiomas[0] ?? 'Español'}</span>
          <div className="text-right">
            <span className="font-bold text-[#2D6A4F] text-base">{formatearPrecio(Number(tour.precioPersona))}</span>
            <span className="text-xs text-gray-400">/pers.</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

const SERVICIOS_FILTRO = [
  { key: 'transporte', label: '🚐 Transporte' },
  { key: 'almuerzo',   label: '🍱 Almuerzo' },
  { key: 'guia',       label: '🧭 Guía' },
  { key: 'seguro',     label: '🛡️ Seguro' },
]

export default function ToursPage() {
  const [tours, setTours] = useState<ConfigTour[]>([])
  const [cargando, setCargando] = useState(true)
  const [tardando, setTardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [gpsCargando, setGpsCargando] = useState(false)
  const [gpsCiudad, setGpsCiudad] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [precioMax, setPrecioMax] = useState(0)
  const [durMax, setDurMax] = useState(0)
  const [serviciosFiltro, setServiciosFiltro] = useState<string[]>([])
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')

  useEffect(() => {
    const t = setTimeout(() => setTardando(true), 6000)
    listarTours().then(d => { setTours(d); setCargando(false) }).finally(() => clearTimeout(t))
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
          setGpsCiudad((j.address?.city || j.address?.town || j.address?.village || '').replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim())
        } catch {}
        setGpsCargando(false)
      },
      () => setGpsCargando(false)
    )
  }

  const maxPrecioReal = tours.length > 0 ? Math.max(...tours.map(t => Number(t.precioPersona))) : 0
  const maxDurReal = tours.length > 0 ? Math.max(...tours.map(t => t.duracionHoras)) : 0

  const filtrados = tours.filter(t => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!t.nombre.toLowerCase().includes(q) && !t.comercio.nombre.toLowerCase().includes(q) && !t.comercio.municipio.toLowerCase().includes(q)) return false
    }
    if (precioMax > 0 && Number(t.precioPersona) > precioMax) return false
    if (durMax > 0 && t.duracionHoras > durMax) return false
    if (serviciosFiltro.length > 0 && !serviciosFiltro.every(s => t.servicios.includes(s))) return false
    return true
  })

  const ordenados = userLat && userLon
    ? [...filtrados].sort((a, b) => {
        const da = a.comercio.latitud && a.comercio.longitud ? distanciaKm(userLat, userLon, a.comercio.latitud, a.comercio.longitud) : 9999
        const db = b.comercio.latitud && b.comercio.longitud ? distanciaKm(userLat, userLon, b.comercio.latitud, b.comercio.longitud) : 9999
        return da - db
      })
    : filtrados

  const filtrosActivos = (precioMax > 0 ? 1 : 0) + (durMax > 0 ? 1 : 0) + serviciosFiltro.length

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/" className="text-[#2D6A4F] p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </Link>
            <div>
              <h1 className="font-bold text-[#1A1A1A] text-lg leading-tight">Tours & Experiencias</h1>
              <p className="text-xs text-gray-500">Vive el Chocó con guías locales</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Tour, ciudad, operador…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <button onClick={activarGPS}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                userLat ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {gpsCargando ? <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : '📍'}
              {gpsCiudad || 'GPS'}
            </button>
            <button onClick={() => setMostrarFiltros(v => !v)}
              className={`relative px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                mostrarFiltros || filtrosActivos > 0 ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              ⚙️
              {filtrosActivos > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#D4A017] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {filtrosActivos}
                </span>
              )}
            </button>
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setVista('lista')} className={`px-2.5 py-2 text-sm transition-colors ${vista === 'lista' ? 'bg-[#2D6A4F] text-white' : 'bg-white text-gray-500'}`} title="Lista">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button onClick={() => setVista('mapa')} className={`px-2.5 py-2 text-sm transition-colors ${vista === 'mapa' ? 'bg-[#2D6A4F] text-white' : 'bg-white text-gray-500'}`} title="Mapa">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
              </button>
            </div>
          </div>

          {mostrarFiltros && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Precio máximo</span>
                  <span className="font-medium text-[#2D6A4F]">{precioMax > 0 ? `$${precioMax.toLocaleString('es-CO')}` : 'Cualquiera'}</span>
                </div>
                <input type="range" min={0} max={maxPrecioReal || 500000} step={10000} value={precioMax}
                  onChange={e => setPrecioMax(Number(e.target.value))}
                  className="w-full accent-[#2D6A4F]" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Duración máxima</span>
                  <span className="font-medium text-[#2D6A4F]">{durMax > 0 ? `${durMax}h` : 'Cualquiera'}</span>
                </div>
                <input type="range" min={0} max={maxDurReal || 24} step={1} value={durMax}
                  onChange={e => setDurMax(Number(e.target.value))}
                  className="w-full accent-[#2D6A4F]" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Incluye</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICIOS_FILTRO.map(s => {
                    const sel = serviciosFiltro.includes(s.key)
                    return (
                      <button key={s.key} onClick={() => setServiciosFiltro(prev =>
                        sel ? prev.filter(x => x !== s.key) : [...prev, s.key]
                      )} className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${
                        sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>{s.label}</button>
                    )
                  })}
                </div>
              </div>
              {filtrosActivos > 0 && (
                <button onClick={() => { setPrecioMax(0); setDurMax(0); setServiciosFiltro([]) }}
                  className="text-xs text-red-500 hover:text-red-700">Limpiar filtros</button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-10">
        <p className="text-xs text-gray-400 mb-3">
          {ordenados.length} tour{ordenados.length !== 1 ? 's' : ''}
          {userLat ? ' · ordenados por cercanía' : ''}
        </p>

        {vista === 'mapa' && !cargando && (
          <div className="mb-4">
            <MapaTours tours={ordenados} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {cargando && tardando && (
          <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-xl px-4 py-2 mb-2">
            ⏳ La API está despertando… puede tardar hasta 30 segundos la primera vez del día.
          </p>
        )}

        {cargando ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonTour key={i} />)}
          </div>
        ) : vista === 'mapa' ? null : ordenados.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🗺️</p>
            <p className="font-semibold text-gray-600">No hay tours disponibles</p>
            <p className="text-sm mt-1">Prueba con otra búsqueda</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ordenados.map(t => <TarjetaTour key={t.id} tour={t} userLat={userLat} userLon={userLon} />)}
          </div>
        )}
      </main>
    </div>
  )
}
