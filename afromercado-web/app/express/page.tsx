'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { listarComerciosExpress, type ComercioExpress } from '@/lib/api/express'
import TarjetaRestaurante from '@/components/express/TarjetaRestaurante'
import BannerDisplay from '@/components/publicidad/BannerDisplay'

const MapaExpress = dynamic(() => import('@/components/express/MapaExpress'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center" style={{ height: 420 }}>
      <div className="w-7 h-7 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

const RADIO_CERCA_KM = 20

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse shadow-sm">
      <div className="h-48 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-2/3 mt-1" />
      </div>
    </div>
  )
}

export default function ExpressPage() {
  const [todos, setTodos]               = useState<ComercioExpress[]>([])
  const [busqueda, setBusqueda]         = useState('')
  const [soloAbiertos, setSoloAbiertos] = useState(false)
  const [vista, setVista]               = useState<'lista'|'mapa'>('lista')
  const [gpsEstado, setGpsEstado]       = useState<'idle'|'buscando'|'ok'|'error'>('idle')
  const [gpsCiudad, setGpsCiudad]       = useState('')
  const [userLat, setUserLat]           = useState<number | null>(null)
  const [userLon, setUserLon]           = useState<number | null>(null)
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Carrusel dinámico
  const [fotoHeroIdx, setFotoHeroIdx] = useState(0)

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

  const heroFotos = useMemo(() => {
    const urls = new Set<string>()
    todos.forEach(c => {
      if (c.comercio.logoUrl) urls.add(c.comercio.logoUrl)
    })
    const arr = Array.from(urls)
    return arr.length > 0 ? arr : ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80']
  }, [todos])

  useEffect(() => {
    if (heroFotos.length <= 1) return
    const id = setInterval(() => {
      setFotoHeroIdx(prev => (prev + 1) % heroFotos.length)
    }, 4000)
    return () => clearInterval(id)
  }, [heroFotos])

  const banners = todos.filter((c: any) => c.esBannerDisplay)
  const organicos = todos.filter((c: any) => !c.esBannerDisplay)

  const municipios = Array.from(new Set(organicos.map(c => c.comercio?.municipio).filter(Boolean)))
  const termino = busqueda.trim().toLowerCase()

  let filtrados = organicos
    .filter(c => !soloAbiertos || c.abierto)
    .filter(c => !termino ||
      c.comercio?.nombre.toLowerCase().includes(termino) ||
      (c.comercio?.municipio ?? '').toLowerCase().includes(termino)
    )

  if (userLat && userLon) {
    filtrados = [...filtrados].sort((a, b) => {
      const dA = a.comercio?.latitud && a.comercio?.longitud ? distanciaKm(userLat!, userLon!, a.comercio.latitud, a.comercio.longitud) : Infinity
      const dB = b.comercio?.latitud && b.comercio?.longitud ? distanciaKm(userLat!, userLon!, b.comercio.latitud, b.comercio.longitud) : Infinity
      return dA - dB
    }).filter(c => c.comercio?.latitud && c.comercio?.longitud && distanciaKm(userLat!, userLon!, c.comercio.latitud, c.comercio.longitud) <= RADIO_CERCA_KM)
  }

  const sinCercania = userLat != null && userLon != null && filtrados.length === 0 && organicos.length > 0

  // Reinjectar banners en los resultados finales (e.g. en la posición 3 y 7)
  const comercios = [...filtrados]
  if (banners.length > 0 && comercios.length >= 3) {
    comercios.splice(3, 0, banners[0])
    if (banners.length > 1 && comercios.length >= 7) {
      comercios.splice(7, 0, banners[1])
    }
  }

  function limpiarGPS() {
    setUserLat(null); setUserLon(null); setGpsCiudad(''); setGpsEstado('idle')
  }

  async function usarUbicacion() {
    if (!navigator.geolocation) { setGpsEstado('error'); return }
    setGpsEstado('buscando')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setUserLat(coords.latitude); setUserLon(coords.longitude)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=es`, { headers: { 'User-Agent': 'AfroMercado/1.0' } })
          const json = await res.json()
          const raw = json.address?.city || json.address?.town || json.address?.village || json.address?.municipality || ''
          setGpsCiudad(raw.replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim())
          setGpsEstado('ok')
        } catch { setGpsEstado('ok') }
      },
      () => setGpsEstado('error'),
      { timeout: 8000 }
    )
  }

  function limpiar() {
    setBusqueda(''); setGpsCiudad(''); setGpsEstado('idle')
    inputRef.current?.focus()
  }

  const abiertosCount = todos.filter(c => c.abierto).length

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden min-h-[280px] sm:min-h-[320px] flex flex-col justify-end bg-[#111]">
        {heroFotos.map((url, idx) => (
          <img 
            key={url}
            src={url} 
            alt="Gastronomía local"
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
                  🍽️ Gastronomía local
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Sabores de<br />
                <span className="text-[#52B788]">Colombia</span>
              </h1>
              <p className="text-white/55 text-sm mt-2.5 max-w-sm">
                Pide comida de restaurantes y comercios locales — entrega a domicilio o recoge en el lugar
              </p>
            </div>
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{todos.length > 0 ? todos.length : '–'}</p>
                <p className="text-white/50 text-xs">Restaurantes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{abiertosCount}</p>
                <p className="text-white/50 text-xs">Abiertos ahora</p>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="mt-6 bg-white shadow-2xl rounded-2xl p-2 flex flex-col sm:flex-row gap-2 border border-gray-100 relative z-10">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={inputRef} value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setGpsCiudad(''); setGpsEstado('idle') }}
                placeholder="Ciudad o restaurante…"
                className="w-full pl-10 pr-4 py-2.5 bg-transparent text-gray-900 placeholder-gray-400 text-sm font-medium focus:outline-none" />
            </div>
            <button onClick={usarUbicacion} disabled={gpsEstado === 'buscando'}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                gpsEstado === 'ok' ? 'bg-[#1B4332] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}>
              {gpsEstado === 'buscando' ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              )}
              {gpsEstado === 'ok' ? gpsCiudad : gpsEstado === 'error' ? 'Sin permiso' : 'Cerca de mí'}
            </button>
          </div>

          {/* Chips municipios */}
          {municipios.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              <button onClick={limpiar}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  !busqueda ? 'bg-white text-[#1B4332] border-white' : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                }`}>
                Todos
              </button>
              {municipios.map(m => (
                <button key={m} onClick={() => setBusqueda(m)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    busqueda.toLowerCase() === m.toLowerCase()
                      ? 'bg-white text-[#1B4332] border-white'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── TOOLBAR ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              {cargando ? 'Buscando…' : (
                <><span className="font-semibold text-gray-800">{comercios.length}</span> {comercios.length !== 1 ? 'restaurantes' : 'restaurante'}{userLat ? <span className="text-[#2D6A4F]"> · a menos de {RADIO_CERCA_KM}km</span> : ''}</>
              )}
            </p>
            <button onClick={() => setSoloAbiertos(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                soloAbiertos ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${soloAbiertos ? 'bg-white' : 'bg-emerald-500'}`} />
              Solo abiertos
            </button>
          </div>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
        )}

        {vista === 'mapa' && !cargando && (
          <div className="mb-6 rounded-2xl overflow-hidden shadow-md">
            <MapaExpress comercios={comercios} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {cargando ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : vista === 'mapa' ? null : comercios.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-[#1B4332]/8 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🍳</span>
            </div>
            <p className="font-semibold text-gray-700 text-lg">
              {termino ? `Sin resultados para "${busqueda}"` : sinCercania ? 'Nada cerca de ti todavía' : 'Ningún restaurante disponible'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {termino
                ? 'Prueba con otra ciudad o nombre'
                : sinCercania
                ? `No hay restaurantes a menos de ${RADIO_CERCA_KM}km de tu ubicación.`
                : 'Vuelve más tarde'}
            </p>
            <div className="flex gap-3 mt-4 justify-center">
              {termino && (
                <button onClick={limpiar} className="px-5 py-2 bg-[#1B4332] text-white text-sm rounded-full font-medium">
                  Limpiar búsqueda
                </button>
              )}
              {sinCercania && (
                <button onClick={limpiarGPS} className="px-5 py-2 bg-[#1B4332] text-white text-sm rounded-full font-medium">
                  Ver todos los restaurantes
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {comercios.map((cfg: any) => (
              cfg.esBannerDisplay ? (
                <div key={cfg.id} className="col-span-full mt-2 mb-2">
                  <BannerDisplay banner={cfg} />
                </div>
              ) : (
                <TarjetaRestaurante key={cfg.id} cfg={cfg} userLat={userLat} userLon={userLon} />
              )
            ))}
          </div>
        )}

        {/* Mis pedidos */}
        <Link href="/express/mis-pedidos"
          className="flex items-center justify-between mt-8 bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm text-gray-700 hover:shadow-md hover:border-[#2D6A4F]/30 transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1B4332]/8 rounded-xl flex items-center justify-center">
              <span className="text-lg">📦</span>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Mis pedidos</p>
              <p className="text-xs text-gray-400">Revisa el estado de tus órdenes</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-300 group-hover:text-[#2D6A4F] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </main>
    </div>
  )
}
