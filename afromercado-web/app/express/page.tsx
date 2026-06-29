'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { listarComerciosExpress, type ComercioExpress } from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'

// Fórmula Haversine: distancia en km entre dos coordenadas
function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function formatearDistancia(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export default function ExpressPage() {
  const [todos, setTodos]               = useState<ComercioExpress[]>([])
  const [busqueda, setBusqueda]         = useState('')
  const [gpsEstado, setGpsEstado]       = useState<'idle'|'buscando'|'ok'|'error'>('idle')
  const [gpsCiudad, setGpsCiudad]       = useState('')
  const [userLat, setUserLat]           = useState<number | null>(null)
  const [userLon, setUserLon]           = useState<number | null>(null)
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      try {
        const data = await listarComerciosExpress()
        setTodos(data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
    const interval = setInterval(cargar, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Municipios únicos de los comercios reales
  const municipios = Array.from(new Set(todos.map(c => c.comercio.municipio).filter(Boolean)))

  // Filtro: búsqueda de texto (nombre o municipio del comercio)
  const termino = busqueda.trim().toLowerCase()
  const filtrados = termino
    ? todos.filter(c =>
        c.comercio.nombre.toLowerCase().includes(termino) ||
        (c.comercio.municipio ?? '').toLowerCase().includes(termino)
      )
    : todos

  // Si el usuario tiene GPS y los comercios tienen coordenadas, ordenar por distancia
  const comercios = userLat && userLon
    ? [...filtrados].sort((a, b) => {
        const dA = a.comercio.latitud && a.comercio.longitud
          ? distanciaKm(userLat!, userLon!, a.comercio.latitud, a.comercio.longitud)
          : Infinity
        const dB = b.comercio.latitud && b.comercio.longitud
          ? distanciaKm(userLat!, userLon!, b.comercio.latitud, b.comercio.longitud)
          : Infinity
        return dA - dB
      })
    : filtrados

  async function usarUbicacion() {
    if (!navigator.geolocation) {
      setGpsEstado('error')
      return
    }
    setGpsEstado('buscando')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setUserLat(coords.latitude)
        setUserLon(coords.longitude)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=es`,
            { headers: { 'User-Agent': 'AfroMercado/1.0' } }
          )
          const json = await res.json()
          const raw =
            json.address?.city ||
            json.address?.town ||
            json.address?.village ||
            json.address?.municipality ||
            ''
          // Solo mostramos la ciudad en el botón, NO filtramos por ella
          const ciudad = raw.replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim()
          setGpsCiudad(ciudad)
          setGpsEstado('ok')
        } catch {
          setGpsEstado('ok')
        }
      },
      () => setGpsEstado('error'),
      { timeout: 8000 }
    )
  }

  function limpiar() {
    setBusqueda('')
    setGpsCiudad('')
    setGpsEstado('idle')
    inputRef.current?.focus()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-[#2D6A4F] transition-colors p-1 -ml-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">🍽️ Express</h1>
          <p className="text-sm text-gray-500">Pide comida y recíbela en minutos</p>
        </div>
      </div>

      {/* Buscador + GPS */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setGpsCiudad(''); setGpsEstado('idle') }}
              placeholder="Busca por ciudad o restaurante..."
              className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 bg-white"
            />
            {busqueda && (
              <button onClick={limpiar} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Botón GPS */}
          <button
            onClick={usarUbicacion}
            disabled={gpsEstado === 'buscando'}
            title="Usar mi ubicación"
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap ${
              gpsEstado === 'ok'
                ? 'bg-green-600 text-white border-green-600'
                : gpsEstado === 'error'
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {gpsEstado === 'buscando' ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
              </svg>
            )}
            <span className="hidden sm:inline">
              {gpsEstado === 'ok' ? gpsCiudad : gpsEstado === 'error' ? 'Sin permiso' : 'Mi ubicación'}
            </span>
          </button>
        </div>

        {/* Chips municipios con comercios reales */}
        {municipios.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            <button
              onClick={limpiar}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                !busqueda ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              Todos
            </button>
            {municipios.map(m => (
              <button
                key={m}
                onClick={() => setBusqueda(m)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  busqueda.toLowerCase() === m.toLowerCase()
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {cargando && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!cargando && comercios.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🍳</div>
          <p className="font-medium">
            {termino ? `Sin restaurantes en "${busqueda}"` : 'Ningún comercio Express disponible'}
          </p>
          <p className="text-sm mt-1">
            {termino ? 'Prueba con otra ciudad o nombre' : 'Vuelve más tarde'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {comercios.map(cfg => (
          <Link
            key={cfg.id}
            href={`/express/${cfg.comercio.id}`}
            className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-4 hover:border-green-300 hover:shadow-sm transition-all"
          >
            {cfg.comercio.logoUrl ? (
              <Image
                src={cfg.comercio.logoUrl}
                alt={cfg.comercio.nombre}
                width={56} height={56}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">
                🍽️
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-gray-900 truncate">{cfg.comercio.nombre}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  cfg.abierto ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {cfg.abierto ? 'ABIERTO' : 'CERRADO'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                📍 {cfg.comercio.municipio}
                {cfg.comercio.calificacion > 0 && ` · ⭐ ${Number(cfg.comercio.calificacion).toFixed(1)}`}
                {userLat && userLon && cfg.comercio.latitud && cfg.comercio.longitud && (
                  <span className="ml-1 text-green-600 font-medium">
                    · 📏 {formatearDistancia(distanciaKm(userLat, userLon, cfg.comercio.latitud, cfg.comercio.longitud))}
                  </span>
                )}
              </p>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span>⏱ ~{cfg.tiempoPrepMinutos} min</span>
                {cfg.modalidades.includes('DOMICILIO') && (
                  <span>🛵 Envío {formatearPrecio(Number(cfg.costoEnvioBase))}</span>
                )}
                {cfg.modalidades.includes('RECOGER') && <span>🏃 Recoger</span>}
              </div>
            </div>

            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      <Link
        href="/express/mis-pedidos"
        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span>📦 Mis pedidos Express</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}
