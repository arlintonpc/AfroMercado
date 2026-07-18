'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  listarInmuebles,
  TIPOS_INMUEBLE,
  TIPOS_OPERACION_INMUEBLE,
  type Inmueble,
  type TipoInmueble,
  type TipoOperacionInmueble,
} from '@/lib/api/bienes-raices'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { optimizarImagenPequena } from '@/lib/cloudinary'
import { DEPARTAMENTOS, MUNICIPIOS_POR_DEPARTAMENTO } from '@/lib/data/colombia'

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

function TarjetaInmueble({ inmueble }: { inmueble: Inmueble }) {
  const foto = inmueble.fotoUrls.length > 0 ? inmueble.fotoUrls[0] : null
  const tipoInfo = TIPOS_INMUEBLE.find(t => t.value === inmueble.tipoInmueble)
  const precio = Number(inmueble.precio)
  const esArriendo = inmueble.tipoOperacion === 'ARRIENDO'

  return (
    <Link href={`/bienes-raices/${inmueble.id}`} className="group block rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-white border border-gray-100/80 shadow-sm">
      {/* Imagen */}
      <div className="relative h-56 overflow-hidden bg-[#1B4332]">
        {foto ? (
          <img src={optimizarImagenPequena(foto)} alt={inmueble.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#52B788] flex items-center justify-center">
            <span className="text-5xl opacity-30">{tipoInfo?.icono ?? '🏘️'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Badges de tipo + operación */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <span className="bg-white/90 backdrop-blur-sm text-[#1B4332] text-[10px] font-bold px-2.5 py-1 rounded-full">
            {tipoInfo?.icono} {tipoInfo?.label}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${
            esArriendo ? 'bg-[#D4A017]/90 text-white' : 'bg-[#2D6A4F]/90 text-white'
          }`}>
            {esArriendo ? 'Arriendo' : 'Venta'}
          </span>
        </div>

        {inmueble.folioMatricula && (
          <div className="absolute top-3 right-3">
            <span className="bg-white/95 backdrop-blur-sm text-[#1B4332] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg">
              ✓ Folio verificable
            </span>
          </div>
        )}

        {/* Título + ubicación */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-bold text-base leading-snug line-clamp-2">{inmueble.titulo}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-70 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="text-white/75 text-xs">{inmueble.municipio}, {inmueble.departamento}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[#1B4332] font-black text-lg leading-none">
            {formatearPrecio(precio)}{esArriendo && <span className="text-xs font-semibold text-gray-400">/mes</span>}
          </p>
          {(inmueble.areaM2 || inmueble.habitaciones) && (
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              {inmueble.areaM2 && <span>{inmueble.areaM2} m²</span>}
              {inmueble.habitaciones && <span>🛏️ {inmueble.habitaciones}</span>}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function PanelFiltros({ onClose, filtros, onChange }: {
  onClose: () => void
  filtros: { departamento: string; municipio: string; tipoInmueble: TipoInmueble | ''; tipoOperacion: TipoOperacionInmueble | ''; precioMax: number }
  onChange: (f: { departamento: string; municipio: string; tipoInmueble: TipoInmueble | ''; tipoOperacion: TipoOperacionInmueble | ''; precioMax: number }) => void
}) {
  const [local, setLocal] = useState(filtros)
  const municipiosDisponibles = local.departamento ? MUNICIPIOS_POR_DEPARTAMENTO[local.departamento] ?? [] : []

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-[#111]">Filtros</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-[#111] block mb-3">Departamento</label>
              <select value={local.departamento}
                onChange={e => setLocal(p => ({ ...p, departamento: e.target.value, municipio: '' }))}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-[#1B4332]">
                <option value="">Todos</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {municipiosDisponibles.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-[#111] block mb-3">Municipio</label>
                <select value={local.municipio}
                  onChange={e => setLocal(p => ({ ...p, municipio: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-[#1B4332]">
                  <option value="">Todos</option>
                  {municipiosDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-[#111] block mb-3">Tipo de inmueble</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_INMUEBLE.map(t => {
                  const sel = local.tipoInmueble === t.value
                  return (
                    <button key={t.value} onClick={() => setLocal(p => ({ ...p, tipoInmueble: sel ? '' : t.value }))}
                      className={`px-4 py-2 rounded-full text-xs font-semibold border-2 transition-colors ${
                        sel ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4332]'
                      }`}>{t.icono} {t.label}</button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#111] block mb-3">Tipo de operación</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_OPERACION_INMUEBLE.map(o => {
                  const sel = local.tipoOperacion === o.value
                  return (
                    <button key={o.value} onClick={() => setLocal(p => ({ ...p, tipoOperacion: sel ? '' : o.value }))}
                      className={`px-4 py-2 rounded-full text-xs font-semibold border-2 transition-colors ${
                        sel ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4332]'
                      }`}>{o.label}</button>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-3">
                <label className="text-sm font-semibold text-[#111]">Precio máximo</label>
                <span className="text-sm font-bold text-[#1B4332]">{local.precioMax === 0 ? 'Sin límite' : formatearPrecio(local.precioMax)}</span>
              </div>
              <input type="range" min={0} max={1000000000} step={5000000} value={local.precioMax}
                onChange={e => setLocal(p => ({ ...p, precioMax: Number(e.target.value) }))}
                className="w-full accent-[#1B4332]" />
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={() => {
              const vacio = { departamento: '', municipio: '', tipoInmueble: '' as const, tipoOperacion: '' as const, precioMax: 0 }
              setLocal(vacio); onChange(vacio); onClose()
            }}
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

export default function BienesRaicesPage() {
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([])
  const [cargando, setCargando] = useState(true)
  const [tardando, setTardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtros, setFiltros] = useState({
    departamento: '', municipio: '',
    tipoInmueble: '' as TipoInmueble | '',
    tipoOperacion: '' as TipoOperacionInmueble | '',
    precioMax: 0,
  })

  useEffect(() => {
    const t = setTimeout(() => setTardando(true), 6000)
    setCargando(true)
    setError(null)
    listarInmuebles({
      departamento: filtros.departamento || undefined,
      municipio: filtros.municipio || undefined,
      tipoInmueble: filtros.tipoInmueble || undefined,
      tipoOperacion: filtros.tipoOperacion || undefined,
      precioMax: filtros.precioMax > 0 ? filtros.precioMax : undefined,
    })
      .then(data => setInmuebles(data))
      .catch(e => setError(e instanceof Error ? e.message : 'No pudimos cargar los inmuebles.'))
      .finally(() => { setCargando(false); clearTimeout(t) })
    return () => clearTimeout(t)
  }, [filtros])

  const filtrosActivos = !!filtros.departamento || !!filtros.municipio || !!filtros.tipoInmueble || !!filtros.tipoOperacion || filtros.precioMax > 0
  const nFiltros = [!!filtros.departamento, !!filtros.municipio, !!filtros.tipoInmueble, !!filtros.tipoOperacion, filtros.precioMax > 0].filter(Boolean).length

  const filtrados = useMemo(() => {
    if (!busqueda) return inmuebles
    const q = busqueda.toLowerCase()
    return inmuebles.filter(i =>
      i.titulo.toLowerCase().includes(q) ||
      i.municipio.toLowerCase().includes(q) ||
      i.departamento.toLowerCase().includes(q)
    )
  }, [inmuebles, busqueda])

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ backgroundImage: "linear-gradient(135deg, rgba(13,43,29,0.88) 0%, rgba(27,67,50,0.80) 50%, rgba(45,106,79,0.75) 100%), url('https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
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
                  🏘️ Predios verificados
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Bienes Raíces<br />
                <span className="text-[#52B788]">del territorio</span>
              </h1>
              <p className="text-white/55 text-sm mt-2.5 max-w-sm">
                Predios verificados con documento de soporte — contacto directo, sin comisiones ni pagos en la plataforma.
              </p>
            </div>
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{inmuebles.length > 0 ? `${inmuebles.length}` : '–'}</p>
                <p className="text-white/50 text-xs">Publicaciones</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">
                  {(() => {
                    const n = new Set(inmuebles.map(i => i.departamento).filter(Boolean)).size
                    return n > 0 ? `${n}` : '–'
                  })()}
                </p>
                <p className="text-white/50 text-xs">Regiones</p>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="mt-6 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-2 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Título, municipio, departamento…"
                className="w-full pl-10 pr-4 py-2.5 bg-transparent text-white placeholder-white/40 text-sm focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMostrarFiltros(true)}
                className={`relative flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  filtrosActivos ? 'bg-[#D4A017] text-white' : 'bg-white/10 hover:bg-white/20 text-white/70'
                }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                Filtros
                {filtrosActivos && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[#D4A017] text-[9px] font-black rounded-full flex items-center justify-center">
                    {nFiltros}
                  </span>
                )}
              </button>
              <Link href="/bienes-raices/publicar"
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-[#1B4332] hover:bg-white/90 transition-all whitespace-nowrap">
                Publicar mi predio
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p className="text-sm text-gray-500">
          {cargando ? 'Buscando publicaciones…' : (
            <><span className="font-semibold text-gray-800">{filtrados.length}</span> {filtrados.length !== 1 ? 'publicaciones' : 'publicación'}</>
          )}
        </p>
      </div>

      {/* ── CONTENIDO ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {cargando && tardando && (
          <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-4">
            ⏳ La API está despertando… puede tardar hasta 30 segundos la primera vez del día.
          </p>
        )}

        {error && !cargando && (
          <p className="text-xs text-center text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
            {error}
          </p>
        )}

        {cargando ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-[#1B4332]/8 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏘️</span>
            </div>
            <p className="font-semibold text-gray-700 text-lg">
              {busqueda || filtrosActivos ? 'Sin resultados' : 'Aún no hay publicaciones'}
            </p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
              {busqueda
                ? `No encontramos predios para "${busqueda}"`
                : filtrosActivos
                ? 'Ningún predio cumple los filtros seleccionados'
                : 'Sé la primera persona en publicar un predio en tu territorio.'}
            </p>
            <div className="flex gap-3 mt-5 justify-center">
              {busqueda && (
                <button onClick={() => setBusqueda('')}
                  className="px-5 py-2 border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors">
                  Limpiar búsqueda
                </button>
              )}
              {filtrosActivos && (
                <button onClick={() => setFiltros({ departamento: '', municipio: '', tipoInmueble: '', tipoOperacion: '', precioMax: 0 })}
                  className="px-5 py-2 bg-[#1B4332] text-white rounded-full text-sm font-medium hover:bg-[#2D6A4F] transition-colors">
                  Quitar filtros
                </button>
              )}
              {!busqueda && !filtrosActivos && (
                <Link href="/bienes-raices/publicar"
                  className="px-5 py-2 bg-[#1B4332] text-white rounded-full text-sm font-medium hover:bg-[#2D6A4F] transition-colors">
                  Publicar mi predio
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtrados.map(i => <TarjetaInmueble key={i.id} inmueble={i} />)}
          </div>
        )}
      </main>

      {mostrarFiltros && (
        <PanelFiltros filtros={filtros} onChange={setFiltros} onClose={() => setMostrarFiltros(false)} />
      )}
    </div>
  )
}
