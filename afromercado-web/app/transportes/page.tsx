'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { listarTransportes, type ConfigTransporte } from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { optimizarImagenPequena } from '@/lib/cloudinary'

const MapaTransportes = dynamic(() => import('@/components/hoteles/MapaTransportes'), { ssr: false })

const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', jueves: 'Ju',
  viernes: 'Vi', sabado: 'Sá', domingo: 'Do',
}

const TIPO_ICONO: Record<string, string> = {
  LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶', PIRAGUA: '🚣', FERRY: '⛴️',
  BUS: '🚌', CHIVA: '🚐', VAN: '🚐', MOTOTAXI: '🏍️', RAPIMOTO: '🏍️', PICKUP: '🛻',
  TOUR_FLUVIAL: '🌊', PAQUETE_MIXTO: '🗺️',
}

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function SkeletonTransporte() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse shadow-sm">
      <div className="h-52 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-full mt-2" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
      </div>
    </div>
  )
}

function TarjetaTransporte({ t, userLat, userLon }: { t: ConfigTransporte; userLat: number | null; userLon: number | null }) {
  const dist = userLat && userLon && t.comercio.latitud && t.comercio.longitud
    ? distanciaKm(userLat, userLon, t.comercio.latitud, t.comercio.longitud)
    : null
  const rutas = t.rutas.filter(r => r.activo)
  const precioMin = rutas.length > 0 ? Math.min(...rutas.map(r => Number(r.precioAsiento))) : null
  const inicial = t.comercio.nombre.charAt(0).toUpperCase()

  return (
    <Link href={`/transportes/${t.id}`} className="group block rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-white border border-gray-100/80 shadow-sm">
      {/* Imagen hero */}
      <div className="relative h-52 overflow-hidden bg-[#0D2B1D]">
        {t.fotos[0] ? (
          <img src={optimizarImagenPequena(t.fotos[0])} alt={t.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0D2B1D] via-[#1B4332] to-[#2D6A4F] flex items-center justify-center">
            <span className="text-8xl opacity-20">{TIPO_ICONO[t.tipo] ?? '🛥️'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Badge tipo vehículo */}
        <div className="absolute top-3 left-3">
          <span className="bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            {TIPO_ICONO[t.tipo] ?? '🛥️'} {t.tipo}
          </span>
        </div>

        {/* Precio */}
        {precioMin !== null && (
          <div className="absolute top-3 right-3">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg">
              <p className="text-[9px] text-gray-400 font-medium leading-none mb-0.5">desde</p>
              <p className="text-[#1B4332] font-black text-sm leading-none">{formatearPrecio(precioMin)}</p>
            </div>
          </div>
        )}

        {/* Nombre + municipio */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-white font-bold text-base leading-snug line-clamp-1">{t.nombre}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-70 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span className="text-white/75 text-xs">{t.comercio.municipio}</span>
                {rutas.length > 0 && (
                  <span className="text-white/50 text-[10px]">· {rutas.length} ruta{rutas.length !== 1 ? 's' : ''}</span>
                )}
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

      {/* Rutas preview */}
      {rutas.length > 0 && (
        <div className="px-4 pt-3 space-y-1.5">
          {rutas.slice(0, 2).map(r => (
            <div key={r.id} className="flex items-center justify-between text-xs bg-[#1B4332]/6 rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[#2D6A4F] font-semibold truncate">{r.origen}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" className="flex-shrink-0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                <span className="text-[#2D6A4F] font-semibold truncate">{r.destino}</span>
              </div>
              <span className="text-gray-400 flex-shrink-0 ml-2 text-[10px]">{r.horario}</span>
            </div>
          ))}
          {rutas.length > 2 && (
            <p className="text-[11px] text-[#2D6A4F] font-medium px-1 pb-1">+{rutas.length - 2} rutas más</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2D6A4F] to-[#1B4332] flex items-center justify-center shadow-sm">
          {t.comercio.logoUrl ? (
            <img src={t.comercio.logoUrl} alt={t.comercio.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-xs font-bold">{inicial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-gray-500 leading-none truncate">{t.comercio.nombre}</p>
          {Number(t.comercio.totalReviews) > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span className="text-[11px] font-semibold text-gray-700">{Number(t.comercio.calificacion).toFixed(1)}</span>
              <span className="text-[10px] text-gray-400">({t.comercio.totalReviews})</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

const TIPOS = [
  'LANCHA', 'BOTE', 'CHALUPA', 'CANOA', 'PIRAGUA', 'FERRY',
  'BUS', 'CHIVA', 'VAN', 'MOTOTAXI', 'RAPIMOTO', 'PICKUP',
  'TOUR_FLUVIAL', 'PAQUETE_MIXTO',
]

export default function TransportesPage() {
  const [transportes, setTransportes] = useState<ConfigTransporte[]>([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState('')
  const [tardando, setTardando]       = useState(false)
  const [busqueda, setBusqueda]       = useState('')
  const [userLat, setUserLat]         = useState<number | null>(null)
  const [userLon, setUserLon]         = useState<number | null>(null)
  const [gpsCargando, setGpsCargando] = useState(false)
  const [gpsCiudad, setGpsCiudad]     = useState('')
  const [tipoFiltro, setTipoFiltro]   = useState('')
  const [vista, setVista]             = useState<'lista' | 'mapa'>('lista')

  function cargar() {
    setCargando(true)
    setError('')
    const t = setTimeout(() => setTardando(true), 6000)
    listarTransportes()
      .then(d => setTransportes(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No pudimos cargar los transportes.'))
      .finally(() => { setCargando(false); clearTimeout(t) })
  }

  useEffect(() => { cargar() }, [])

  async function activarGPS() {
    if (!navigator.geolocation) return
    setGpsCargando(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setUserLat(pos.coords.latitude); setUserLon(pos.coords.longitude)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          const j = await res.json()
          setGpsCiudad((j.address?.city || j.address?.town || j.address?.village || '').replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim())
        } catch {}
        setGpsCargando(false)
      },
      () => setGpsCargando(false)
    )
  }

  const filtrados = transportes.filter(t => {
    if (tipoFiltro && t.tipo !== tipoFiltro) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return t.nombre.toLowerCase().includes(q) || t.comercio.municipio.toLowerCase().includes(q) ||
      t.rutas.some(r => r.origen.toLowerCase().includes(q) || r.destino.toLowerCase().includes(q))
  })

  const ordenados = userLat && userLon
    ? [...filtrados].sort((a, b) => {
        const da = a.comercio.latitud && a.comercio.longitud ? distanciaKm(userLat, userLon, a.comercio.latitud, a.comercio.longitud) : 9999
        const db = b.comercio.latitud && b.comercio.longitud ? distanciaKm(userLat, userLon, b.comercio.latitud, b.comercio.longitud) : 9999
        return da - db
      })
    : filtrados

  const tiposDisponibles = TIPOS.filter(tp => transportes.some(t => t.tipo === tp))

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ backgroundImage: "linear-gradient(135deg, rgba(13,43,29,0.88) 0%, rgba(27,67,50,0.80) 50%, rgba(45,106,79,0.75) 100%), url('https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1600&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute -top-16 -right-16 w-72 h-72 bg-white/5 rounded-full" />
        <div className="absolute top-12 -left-10 w-40 h-40 bg-[#D4A017]/10 rounded-full" />
        <div className="absolute bottom-0 right-1/3 w-96 h-32 bg-[#52B788]/10 rounded-full blur-2xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Inicio
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#D4A017]/20 border border-[#D4A017]/30 text-[#D4A017] text-xs font-semibold px-3 py-1 rounded-full">
                  🛥️ Movilidad regional
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Transporte<br />
                <span className="text-[#52B788]">de Colombia</span>
              </h1>
              <p className="text-white/55 text-sm mt-2.5 max-w-sm">
                Lanchas, buses, chivas y más — conéctate entre municipios de todo el país
              </p>
            </div>
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{transportes.length > 0 ? transportes.length : '–'}</p>
                <p className="text-white/50 text-xs">Servicios</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{transportes.reduce((s, t) => s + t.rutas.filter(r => r.activo).length, 0) || '–'}</p>
                <p className="text-white/50 text-xs">Rutas</p>
              </div>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="mt-6 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-2 flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Ruta, origen, destino o municipio…"
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
          </div>

          {/* Chips tipo vehículo */}
          {tiposDisponibles.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              <button onClick={() => setTipoFiltro('')}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  !tipoFiltro ? 'bg-white text-[#1B4332] border-white' : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                }`}>
                Todos
              </button>
              {tiposDisponibles.map(tp => (
                <button key={tp} onClick={() => setTipoFiltro(tp === tipoFiltro ? '' : tp)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    tipoFiltro === tp ? 'bg-white text-[#1B4332] border-white' : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}>
                  {TIPO_ICONO[tp]} {tp}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── TOOLBAR ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {cargando ? 'Buscando…' : (
              <><span className="font-semibold text-gray-800">{ordenados.length}</span> servicio{ordenados.length !== 1 ? 's' : ''}{userLat ? <span className="text-[#2D6A4F]"> · por cercanía</span> : ''}</>
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

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm mb-4 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={cargar} className="shrink-0 font-semibold underline hover:no-underline">Reintentar</button>
          </div>
        )}

        {vista === 'mapa' && !cargando && (
          <div className="mb-6 rounded-2xl overflow-hidden shadow-md">
            <MapaTransportes transportes={ordenados} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {cargando && tardando && (
          <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-4">
            ⏳ La API está despertando… puede tardar hasta 30 segundos la primera vez del día.
          </p>
        )}

        {cargando ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonTransporte key={i} />)}
          </div>
        ) : vista === 'mapa' ? null : ordenados.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-[#1B4332]/8 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🛥️</span>
            </div>
            <p className="font-semibold text-gray-700 text-lg">Sin servicios disponibles</p>
            <p className="text-sm text-gray-400 mt-1">
              {busqueda ? `No encontramos servicios para "${busqueda}"` : 'Prueba con otra ruta o ciudad'}
            </p>
            {(busqueda || tipoFiltro) && (
              <button onClick={() => { setBusqueda(''); setTipoFiltro('') }}
                className="mt-4 px-5 py-2 bg-[#1B4332] text-white text-sm rounded-full font-medium">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ordenados.map(t => <TarjetaTransporte key={t.id} t={t} userLat={userLat} userLon={userLon} />)}
          </div>
        )}
      </main>
    </div>
  )
}
