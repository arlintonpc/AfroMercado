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
      {/* Imagen principal o placeholder */}
      <div className="h-44 bg-gradient-to-br from-[#2D6A4F] to-[#40916C] relative flex items-center justify-center">
        {hotel.habitaciones[0]?.fotos[0] ? (
          <img src={hotel.habitaciones[0].fotos[0]} alt={hotel.comercio.nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">🏨</span>
        )}
        {hotel.activo && (
          <span className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Disponible
          </span>
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
              <span className="text-xs font-semibold text-[#1A1A1A]">{Number(hotel.comercio.calificacion).toFixed(1)}</span>
              <span className="text-xs text-gray-400">({hotel.comercio.totalReviews})</span>
            </div>
          )}
        </div>

        {/* Servicios */}
        {hotel.servicios.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hotel.servicios.slice(0, 5).map(s => (
              <span key={s} className="text-sm" title={s}>{SERVICIOS_ICONOS[s] ?? '✓'}</span>
            ))}
          </div>
        )}

        {/* Precio y habitaciones */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">{hotel.habitaciones.length} tipo{hotel.habitaciones.length !== 1 ? 's' : ''} de habitación</span>
          </div>
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

export default function HotelesPage() {
  const [hoteles, setHoteles] = useState<ConfigHotel[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [gpsCargando, setGpsCargando] = useState(false)
  const [gpsCiudad, setGpsCiudad] = useState('')

  useEffect(() => {
    listarHoteles().then(data => { setHoteles(data); setCargando(false) })
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
          const ciudad = (j.address?.city || j.address?.town || j.address?.village || j.address?.county || '')
            .replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim()
          setGpsCiudad(ciudad)
        } catch {}
        setGpsCargando(false)
      },
      () => setGpsCargando(false)
    )
  }

  const filtrados = hoteles.filter(h => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return h.comercio.nombre.toLowerCase().includes(q) ||
      h.comercio.municipio.toLowerCase().includes(q) ||
      (h.comercio.departamento?.toLowerCase().includes(q) ?? false)
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
      {/* Header */}
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

          {/* Buscador + GPS */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Ciudad, hotel…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
            <button
              onClick={activarGPS}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                userLat ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {gpsCargando ? <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : '📍'}
              {gpsCiudad || 'GPS'}
            </button>
            <button
              onClick={() => setVista(v => v === 'lista' ? 'mapa' : 'lista')}
              className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-600"
            >
              {vista === 'lista' ? '🗺️' : '☰'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-10">
        {/* Contador */}
        <p className="text-xs text-gray-400 mb-3">
          {ordenados.length} hotel{ordenados.length !== 1 ? 'es' : ''}
          {userLat ? ' · ordenados por cercanía' : ''}
        </p>

        {/* Vista mapa */}
        {vista === 'mapa' && (
          <div className="mb-4">
            <MapaHoteles hoteles={ordenados} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {/* Lista */}
        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ordenados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏨</p>
            <p className="font-medium">No hay hoteles disponibles</p>
            {busqueda && <p className="text-sm mt-1">Intenta con otra búsqueda</p>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ordenados.map(h => (
              <TarjetaHotel key={h.id} hotel={h} userLat={userLat} userLon={userLon} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
