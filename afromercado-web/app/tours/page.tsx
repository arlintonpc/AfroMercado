'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listarTours, type ConfigTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'

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

function TarjetaTour({ tour, userLat, userLon }: { tour: ConfigTour; userLat: number | null; userLon: number | null }) {
  const dist = userLat && userLon && tour.comercio.latitud && tour.comercio.longitud
    ? distanciaKm(userLat, userLon, tour.comercio.latitud, tour.comercio.longitud)
    : null

  return (
    <Link href={`/tours/${tour.id}`} className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-44 bg-gradient-to-br from-[#40916C] to-[#74C69D] relative flex items-center justify-center">
        {tour.fotos[0] ? (
          <img src={tour.fotos[0]} alt={tour.nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">🗺️</span>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            ⏱️ {tour.duracionHoras}h
          </span>
          {tour.maxParticipantes > 0 && (
            <span className="bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
              👥 máx. {tour.maxParticipantes}
            </span>
          )}
        </div>
        {dist !== null && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            📍 {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-[#1A1A1A] truncate">{tour.nombre}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {tour.comercio.nombre} · 📍 {tour.comercio.municipio}
        </p>

        {tour.descripcion && (
          <p className="text-xs text-gray-600 mt-2 line-clamp-2">{tour.descripcion}</p>
        )}

        {tour.servicios.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tour.servicios.slice(0, 5).map(s => (
              <span key={s} className="text-sm" title={s}>{SERVICIOS_ICONOS[s] ?? '✓'}</span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {tour.idiomas.length > 0 ? `🗣️ ${tour.idiomas.join(' · ')}` : ''}
          </span>
          <div className="text-right">
            <span className="font-bold text-[#2D6A4F]">{formatearPrecio(Number(tour.precioPersona))}</span>
            <span className="text-xs text-gray-400">/persona</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function ToursPage() {
  const [tours, setTours] = useState<ConfigTour[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [gpsCargando, setGpsCargando] = useState(false)
  const [gpsCiudad, setGpsCiudad] = useState('')

  useEffect(() => {
    listarTours().then(d => { setTours(d); setCargando(false) })
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

  const filtrados = tours.filter(t => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return t.nombre.toLowerCase().includes(q) ||
      t.comercio.nombre.toLowerCase().includes(q) ||
      t.comercio.municipio.toLowerCase().includes(q)
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
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-10">
        <p className="text-xs text-gray-400 mb-3">
          {ordenados.length} tour{ordenados.length !== 1 ? 's' : ''}
          {userLat ? ' · ordenados por cercanía' : ''}
        </p>

        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ordenados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-medium">No hay tours disponibles</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ordenados.map(t => <TarjetaTour key={t.id} tour={t} userLat={userLat} userLon={userLon} />)}
          </div>
        )}
      </main>
    </div>
  )
}
