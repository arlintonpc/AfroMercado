'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { listarTransportes, type ConfigTransporte } from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'

const MapaTransportes = dynamic(() => import('@/components/hoteles/MapaTransportes'), { ssr: false })

const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', jueves: 'Ju',
  viernes: 'Vi', sabado: 'Sá', domingo: 'Do',
}

const TIPO_ICONO: Record<string, string> = {
  LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶',
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
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-40 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-full mt-3" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="flex justify-end mt-2">
          <div className="h-5 bg-gray-200 rounded w-24" />
        </div>
      </div>
    </div>
  )
}

function EstrellasMini({ valor, total }: { valor: number | string; total: number }) {
  const n = Number(valor)
  if (total === 0) return null
  return (
    <div className="flex items-center gap-1 mt-0.5">
      <span className="text-[#D4A017] text-xs">{'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}</span>
      <span className="text-[10px] text-gray-400">({total})</span>
    </div>
  )
}

function TarjetaTransporte({ t, userLat, userLon }: { t: ConfigTransporte; userLat: number | null; userLon: number | null }) {
  const dist = userLat && userLon && t.comercio.latitud && t.comercio.longitud
    ? distanciaKm(userLat, userLon, t.comercio.latitud, t.comercio.longitud)
    : null
  const rutas = t.rutas.filter(r => r.activo)
  const precioMin = rutas.length > 0 ? Math.min(...rutas.map(r => Number(r.precioAsiento))) : null

  return (
    <Link href={`/transportes/${t.id}`} className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="h-40 bg-gradient-to-br from-[#023E8A] to-[#0077B6] relative flex items-center justify-center">
        {t.fotos[0] ? (
          <img src={t.fotos[0]} alt={t.nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">{TIPO_ICONO[t.tipo] ?? '🛥️'}</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        {dist !== null && (
          <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            📍 {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
          </span>
        )}
        <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
          {TIPO_ICONO[t.tipo] ?? '🛥️'} {t.tipo}
        </span>
        <div className="absolute bottom-2 left-2">
          <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            {rutas.length} ruta{rutas.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-[#1A1A1A] truncate">{t.nombre}</h3>
        <p className="text-xs text-gray-500 mt-0.5 truncate">📍 {t.comercio.municipio}</p>
        <EstrellasMini valor={t.comercio.calificacion} total={t.comercio.totalReviews} />

        {rutas.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {rutas.slice(0, 2).map(r => (
              <div key={r.id} className="flex items-center justify-between text-xs bg-[#023E8A]/5 rounded-lg px-2 py-1.5">
                <span className="text-gray-700 font-medium">{r.origen} → {r.destino}</span>
                <span className="text-gray-400 flex-shrink-0 ml-2">🕐 {r.horario}</span>
              </div>
            ))}
            {rutas.length > 2 && <p className="text-xs text-[#023E8A]">+{rutas.length - 2} rutas más</p>}
          </div>
        )}

        {precioMin !== null && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
            <span className="text-xs text-gray-400">Precio por asiento</span>
            <div>
              <span className="text-xs text-gray-400">Desde </span>
              <span className="font-bold text-[#023E8A]">{formatearPrecio(precioMin)}</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

const TIPOS = ['LANCHA', 'BOTE', 'CHALUPA', 'CANOA']

export default function TransportesPage() {
  const [transportes, setTransportes] = useState<ConfigTransporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [tardando, setTardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [gpsCargando, setGpsCargando] = useState(false)
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')

  useEffect(() => {
    const t = setTimeout(() => setTardando(true), 6000)
    listarTransportes().then(d => { setTransportes(d); setCargando(false) }).finally(() => clearTimeout(t))
  }, [])

  function activarGPS() {
    setGpsCargando(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLon(pos.coords.longitude); setGpsCargando(false) },
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
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/" className="text-[#2D6A4F] p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </Link>
            <div>
              <h1 className="font-bold text-[#1A1A1A] text-lg leading-tight">Transporte Fluvial</h1>
              <p className="text-xs text-gray-500">Lanchas y botes por el Chocó</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por ruta, origen, destino…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#023E8A]" />
            </div>
            <button onClick={activarGPS}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center ${
                userLat ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {gpsCargando ? <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : '📍'}
            </button>
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setVista('lista')} className={`px-2.5 py-2 text-sm transition-colors ${vista === 'lista' ? 'bg-[#023E8A] text-white' : 'bg-white text-gray-500'}`} title="Lista">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button onClick={() => setVista('mapa')} className={`px-2.5 py-2 text-sm transition-colors ${vista === 'mapa' ? 'bg-[#023E8A] text-white' : 'bg-white text-gray-500'}`} title="Mapa">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
              </button>
            </div>
          </div>

          {tiposDisponibles.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <button onClick={() => setTipoFiltro('')}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  !tipoFiltro ? 'bg-[#023E8A] text-white border-[#023E8A]' : 'bg-white text-gray-600 border-gray-200'
                }`}>Todos</button>
              {tiposDisponibles.map(tp => (
                <button key={tp} onClick={() => setTipoFiltro(tp === tipoFiltro ? '' : tp)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    tipoFiltro === tp ? 'bg-[#023E8A] text-white border-[#023E8A]' : 'bg-white text-gray-600 border-gray-200'
                  }`}>{TIPO_ICONO[tp]} {tp}</button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-10">
        <p className="text-xs text-gray-400 mb-3">{ordenados.length} servicio{ordenados.length !== 1 ? 's' : ''}</p>

        {vista === 'mapa' && !cargando && (
          <div className="mb-4">
            <MapaTransportes transportes={ordenados} userLat={userLat} userLon={userLon} />
          </div>
        )}

        {cargando && tardando && (
          <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-xl px-4 py-2 mb-2">
            ⏳ La API está despertando… puede tardar hasta 30 segundos la primera vez del día.
          </p>
        )}

        {cargando ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonTransporte key={i} />)}
          </div>
        ) : vista === 'mapa' ? null : ordenados.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🛥️</p>
            <p className="font-semibold text-gray-600">Sin servicios disponibles</p>
            <p className="text-sm mt-1">Prueba con otra ruta o ciudad</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ordenados.map(t => <TarjetaTransporte key={t.id} t={t} userLat={userLat} userLon={userLon} />)}
          </div>
        )}
      </main>
    </div>
  )
}
