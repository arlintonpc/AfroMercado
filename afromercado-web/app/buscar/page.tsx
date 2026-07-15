'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { SkeletonCard, EmptyState } from '@/components/ui'
import { listarProductos, listarCategorias } from '@/lib/api/productos'
import { listarHoteles, type ConfigHotel } from '@/lib/api/hotel'
import { listarTours, type ConfigTour } from '@/lib/api/tour'
import { listarTransportes, type ConfigTransporte } from '@/lib/api/transporte'
import { apiFetch } from '@/lib/api/client'
import { mapearProductos } from '@/lib/mapearProducto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import type { Producto } from '@/types/producto'
import type { Categoria } from '@/types/categoria'

type Tab = 'productos' | 'hoteles' | 'tours' | 'transportes'

const FILTROS_VACIOS = {
  categoriaId: '',
  precioMin: '',
  precioMax: '',
  alcance: '' as '' | 'LOCAL' | 'NACIONAL' | 'AMBOS',
  enOferta: false,
  grupo: 'ANCESTRAL' as 'ANCESTRAL' | 'LOCAL',
}

function contarFiltrosActivos(f: typeof FILTROS_VACIOS): number {
  return (
    (f.categoriaId ? 1 : 0) +
    (f.precioMin ? 1 : 0) +
    (f.precioMax ? 1 : 0) +
    (f.alcance ? 1 : 0) +
    (f.enOferta ? 1 : 0)
  )
}

// ── Tarjetas compactas para hoteles/tours/transportes ──────────────────────

function TarjetaHotelBuscar({ h }: { h: ConfigHotel }) {
  const desde = h.habitaciones.length > 0 ? Math.min(...h.habitaciones.map(x => Number(x.precioPorNoche))) : null
  const foto = h.habitaciones[0]?.fotos[0]
  const calificacion = Number(h.comercio.calificacion)
  return (
    <Link href={`/hoteles/${h.id}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-[#2D6A4F]/30 transition-all flex flex-col">
      <div className="h-40 bg-gradient-to-br from-[#2D6A4F] to-[#40916C] flex items-center justify-center overflow-hidden relative">
        {foto ? <img src={foto} alt={h.comercio.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <span className="text-4xl">🏨</span>}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <p className="font-bold text-sm text-[#1A1A1A] truncate">{h.comercio.nombre}</p>
        <p className="text-xs text-gray-500">📍 {h.comercio.municipio}</p>
        {calificacion > 0 && <p className="text-xs text-amber-500">{'★'.repeat(Math.round(calificacion))} <span className="text-gray-400">{calificacion.toFixed(1)}</span></p>}
        {desde !== null && <p className="text-sm text-[#2D6A4F] font-semibold mt-1">Desde {formatearPrecio(desde)}<span className="text-xs font-normal text-gray-400">/noche</span></p>}
      </div>
    </Link>
  )
}

function TarjetaTourBuscar({ t }: { t: ConfigTour }) {
  const calificacion = Number(t.comercio.calificacion)
  return (
    <Link href={`/tours/${t.id}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-[#2D6A4F]/30 transition-all flex flex-col">
      <div className="h-40 bg-gradient-to-br from-[#40916C] to-[#74C69D] flex items-center justify-center overflow-hidden">
        {t.fotos[0] ? <img src={t.fotos[0]} alt={t.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <span className="text-4xl">🗺️</span>}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <p className="font-bold text-sm text-[#1A1A1A] truncate">{t.nombre}</p>
        <p className="text-xs text-gray-500">📍 {t.comercio.municipio} · ⏱️ {t.duracionHoras}h · 👥 máx {t.maxParticipantes}</p>
        {calificacion > 0 && <p className="text-xs text-amber-500">{'★'.repeat(Math.round(calificacion))} <span className="text-gray-400">{calificacion.toFixed(1)}</span></p>}
        <p className="text-sm text-[#2D6A4F] font-semibold mt-1">{formatearPrecio(Number(t.precioPersona))}<span className="text-xs font-normal text-gray-400">/persona</span></p>
      </div>
    </Link>
  )
}

function TarjetaTransporteBuscar({ t }: { t: ConfigTransporte }) {
  const rutas = t.rutas.filter(r => r.activo)
  const precioMin = rutas.length > 0 ? Math.min(...rutas.map(r => Number(r.precioAsiento))) : null
  const TIPO_ICONO: Record<string, string> = { LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶' }
  return (
    <Link href={`/transportes/${t.id}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-[#023E8A]/30 transition-all flex flex-col">
      <div className="h-40 bg-gradient-to-br from-[#023E8A] to-[#0077B6] flex items-center justify-center overflow-hidden">
        {t.fotos[0] ? <img src={t.fotos[0]} alt={t.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <span className="text-4xl">{TIPO_ICONO[t.tipo] ?? '🛥️'}</span>}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <p className="font-bold text-sm text-[#1A1A1A] truncate">{t.nombre}</p>
        <p className="text-xs text-gray-500">📍 {t.comercio.municipio} · {TIPO_ICONO[t.tipo]} {t.tipo}</p>
        {rutas.length > 0 && <p className="text-xs text-gray-400">{rutas.length} ruta{rutas.length !== 1 ? 's' : ''} disponible{rutas.length !== 1 ? 's' : ''}</p>}
        {precioMin !== null && <p className="text-sm text-[#023E8A] font-semibold mt-1">Desde {formatearPrecio(precioMin)}<span className="text-xs font-normal text-gray-400">/asiento</span></p>}
      </div>
    </Link>
  )
}

// ── Componente principal ────────────────────────────────────────────────────

function Resultados() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const categoriaSlug = searchParams.get('categoria') ?? ''
  const tabParam = (searchParams.get('tab') ?? 'productos') as Tab

  const [termino, setTermino] = useState(q)
  const [tab, setTab] = useState<Tab>(tabParam)

  // Productos
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargandoProductos, setCargandoProductos] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorProductos, setErrorProductos] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [paginas, setPaginas] = useState(0)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Turismo
  const [hoteles, setHoteles] = useState<ConfigHotel[]>([])
  const [tours, setTours] = useState<ConfigTour[]>([])
  const [transportes, setTransportes] = useState<ConfigTransporte[]>([])
  const [cargandoTurismo, setCargandoTurismo] = useState(false)

  const filtrosRef = useRef(filtros)
  useEffect(() => { filtrosRef.current = filtros }, [filtros])

  const turismoYaCargado = useRef(false)

  // Carga categorías al montar; turismo solo cuando se activa un tab de turismo
  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {})
  }, [])

  useEffect(() => {
    if (turismoYaCargado.current) return
    turismoYaCargado.current = true
    setCargandoTurismo(true)
    Promise.all([listarHoteles(), listarTours(), listarTransportes()])
      .then(([h, t, tr]) => { setHoteles(h); setTours(t); setTransportes(tr) })
      .catch(() => {})
      .finally(() => setCargandoTurismo(false))
  }, [])

  function tabParaCategoria(cat: Categoria): Tab | null {
    const s = cat.slug.toLowerCase()
    const n = cat.nombre.toLowerCase()
    if (s.includes('hotel') || n.includes('hotel') || n.includes('hosped') || n.includes('alojam')) return 'hoteles'
    if (s === 'turismo' || s.includes('tour') || n.includes('turismo') || n.includes('tour') || n.includes('excurs')) return 'tours'
    if (s.includes('transport') || n.includes('transport') || n.includes('lancha') || n.includes('fluvial')) return 'transportes'
    return null
  }

  useEffect(() => {
    if (!categoriaSlug || categorias.length === 0) return
    const cat = categorias.find(c => c.slug === categoriaSlug)
    if (!cat) return
    const moduloTab = tabParaCategoria(cat)
    if (moduloTab) { cambiarTab(moduloTab); return }
    setFiltros(f => ({ ...f, categoriaId: cat.id }))
  }, [categoriaSlug, categorias])

  useEffect(() => { setTermino(q) }, [q])

  const cargarProductos = useCallback(async (texto: string, paginaNum: number, append: boolean) => {
    const f = filtrosRef.current
    const hayTermino = !!texto.trim()
    const grupoEsLocal = f.grupo === 'LOCAL'
    const hayFiltros = contarFiltrosActivos(f) > 0 || grupoEsLocal
    if (!hayTermino && !hayFiltros) { setProductos([]); setTotal(0); setPaginas(0); return }
    if (append) setCargandoMas(true); else setCargandoProductos(true)
    setErrorProductos(null)
    try {
      const { items, total: tot, paginas: pags } = await listarProductos({
        q: texto.trim() || undefined,
        categoriaId: f.categoriaId || undefined,
        grupo: f.grupo,
        precioMin: f.precioMin ? Number(f.precioMin) : undefined,
        precioMax: f.precioMax ? Number(f.precioMax) : undefined,
        alcance: f.alcance || undefined,
        enOferta: f.enOferta || undefined,
        pagina: paginaNum,
        porPagina: 24,
      })
      const mapeados = mapearProductos(items)
      setProductos(prev => append ? [...prev, ...mapeados] : mapeados)
      setTotal(tot); setPaginas(pags)
      if (!append && texto.trim()) {
        const sesionId = (() => { try { let s = sessionStorage.getItem('afm_sid'); if (!s) { s = Math.random().toString(36).slice(2); sessionStorage.setItem('afm_sid', s) } return s } catch { return undefined } })()
        apiFetch('/productos/busqueda', { method: 'POST', body: { query: texto.trim(), sesionId } }).catch(() => {})
      }
    } catch (e) {
      setErrorProductos(e instanceof Error ? e.message : 'Error en la búsqueda.')
      if (!append) setProductos([])
    } finally { setCargandoProductos(false); setCargandoMas(false) }
  }, [])

  useEffect(() => { setPagina(1); cargarProductos(q, 1, false) }, [q, filtros, cargarProductos])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const texto = termino.trim()
    router.push(texto ? `/buscar?q=${encodeURIComponent(texto)}&tab=${tab}` : `/buscar?tab=${tab}`)
  }

  function cambiarTab(t: Tab) {
    setTab(t)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', t)
    router.replace(url.pathname + url.search)
  }

  function actualizarFiltro<K extends keyof typeof FILTROS_VACIOS>(clave: K, valor: (typeof FILTROS_VACIOS)[K]) {
    setFiltros(prev => ({ ...prev, [clave]: valor }))
  }

  function limpiarFiltros() { setFiltros(FILTROS_VACIOS) }

  function cambiarGrupo(g: 'ANCESTRAL' | 'LOCAL') {
    setFiltros(prev => {
      if (prev.grupo === g) return prev
      const catSeleccionada = categorias.find(c => c.id === prev.categoriaId)
      // Si la categoría elegida no pertenece al nuevo grupo (y sí tiene grupo asignado), se limpia.
      const siguePerteneciendo = !catSeleccionada || !catSeleccionada.grupo || catSeleccionada.grupo === g
      return { ...prev, grupo: g, categoriaId: siguePerteneciendo ? prev.categoriaId : '' }
    })
  }

  function cargarMas() { const sig = pagina + 1; setPagina(sig); cargarProductos(q, sig, true) }

  // Filtrado cliente-side para turismo
  const qLower = q.toLowerCase()
  const hotelesFiltrados = q ? hoteles.filter(h =>
    h.comercio.nombre.toLowerCase().includes(qLower) ||
    h.comercio.municipio.toLowerCase().includes(qLower) ||
    (h.comercio.descripcion ?? '').toLowerCase().includes(qLower)
  ) : hoteles
  const toursFiltrados = q ? tours.filter(t =>
    t.nombre.toLowerCase().includes(qLower) ||
    t.comercio.municipio.toLowerCase().includes(qLower) ||
    (t.descripcion ?? '').toLowerCase().includes(qLower) ||
    t.comercio.nombre.toLowerCase().includes(qLower)
  ) : tours
  const transportesFiltrados = q ? transportes.filter(t =>
    t.nombre.toLowerCase().includes(qLower) ||
    t.comercio.municipio.toLowerCase().includes(qLower) ||
    t.rutas.some(r => r.origen.toLowerCase().includes(qLower) || r.destino.toLowerCase().includes(qLower))
  ) : transportes

  const filtrosActivos = contarFiltrosActivos(filtros)
  const grupoEsLocal = filtros.grupo === 'LOCAL'
  const sinTerminoNiFiltros = !q && filtrosActivos === 0 && !grupoEsLocal && !cargandoProductos
  const categoriasDelGrupo = categorias.filter(c => !c.grupo || c.grupo === filtros.grupo)

  const inputCls = 'h-10 px-3 rounded-xl border border-[#1A1A1A]/15 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] text-sm w-full'
  const btnPrimario = 'bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold rounded-xl px-4 py-2 text-sm transition-colors'

  const TABS: { key: Tab; label: string; count: number | null }[] = [
    { key: 'productos',    label: '🛍️ Productos',   count: q ? total : null },
    { key: 'hoteles',     label: '🏨 Hoteles',      count: q ? hotelesFiltrados.length : null },
    { key: 'tours',       label: '🗺️ Tours',        count: q ? toursFiltrados.length : null },
    { key: 'transportes', label: '🛥️ Transporte',   count: q ? transportesFiltrados.length : null },
  ]

  const PanelFiltros = (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[#1A1A1A] text-sm">Filtros</span>
        {filtrosActivos > 0 && <button onClick={limpiarFiltros} className="text-xs text-[#2D6A4F] hover:underline font-medium">Limpiar ({filtrosActivos})</button>}
      </div>
      {filtrosActivos > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filtros.categoriaId && <span className="bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">{categorias.find(c => c.id === filtros.categoriaId)?.nombre ?? 'Categoría'}</span>}
          {filtros.precioMin && <span className="bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">Desde ${filtros.precioMin}</span>}
          {filtros.precioMax && <span className="bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">Hasta ${filtros.precioMax}</span>}
          {filtros.alcance && <span className="bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">{filtros.alcance === 'LOCAL' ? 'Solo local' : filtros.alcance === 'NACIONAL' ? 'Nacional' : 'Ambos'}</span>}
          {filtros.enOferta && <span className="bg-[#D4A017]/15 text-[#D4A017] text-xs font-medium px-2.5 py-1 rounded-full">En oferta</span>}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide">Categoría</label>
        <select
          value={filtros.categoriaId}
          onChange={e => {
            const cat = categorias.find(c => c.id === e.target.value)
            if (cat) {
              const moduloTab = tabParaCategoria(cat)
              if (moduloTab) { cambiarTab(moduloTab); return }
            }
            actualizarFiltro('categoriaId', e.target.value)
          }}
          className={inputCls}
        >
          <option value="">Todas las categorías</option>
          {categoriasDelGrupo.map(cat => <option key={cat.id} value={cat.id}>{cat.icono ? `${cat.icono} ` : ''}{cat.nombre}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide">Precio</label>
        <div className="flex gap-2">
          <input type="number" min={0} placeholder="Desde $" value={filtros.precioMin} onChange={e => actualizarFiltro('precioMin', e.target.value)} className={inputCls} />
          <input type="number" min={0} placeholder="Hasta $" value={filtros.precioMax} onChange={e => actualizarFiltro('precioMax', e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide">Alcance</label>
        <div className="flex flex-col gap-1.5">
          {([['', 'Todos'], ['LOCAL', 'Solo local'], ['NACIONAL', 'Nacional']] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-[#1A1A1A]">
              <input type="radio" name="alcance" value={val} checked={filtros.alcance === val} onChange={() => actualizarFiltro('alcance', val)} className="accent-[#2D6A4F]" />
              {label}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={filtros.enOferta} onChange={e => actualizarFiltro('enOferta', e.target.checked)} className="w-4 h-4 rounded accent-[#2D6A4F]" />
        <span className="text-sm text-[#1A1A1A]">Solo con descuento</span>
      </label>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-4">

        {/* Buscador */}
        <form onSubmit={onSubmit} role="search">
          <div className="relative">
            <input
              type="search" autoFocus value={termino} onChange={e => setTermino(e.target.value)}
              placeholder="Buscar productos, hoteles, tours, transportes…"
              aria-label="Buscar en Teravia"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#1A1A1A]/15 bg-white focus:outline-none focus:border-[#D4A017] text-base"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1A1A1A]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => cambiarTab(t.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                tab === t.key ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#2D6A4F]/40'
              }`}>
              {t.label}
              {t.count !== null && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-gray-100'}`}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Toggle Productos ancestrales / Tienda local — secundario, solo dentro del tab Productos */}
        {tab === 'productos' && (
          <div className="inline-flex self-start bg-white border border-[#1A1A1A]/10 rounded-full p-1 gap-1">
            <button
              type="button"
              onClick={() => cambiarGrupo('ANCESTRAL')}
              aria-pressed={filtros.grupo === 'ANCESTRAL'}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filtros.grupo === 'ANCESTRAL' ? 'bg-[#1B4332] text-white' : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
              }`}
            >
              🌿 Productos ancestrales
            </button>
            <button
              type="button"
              onClick={() => cambiarGrupo('LOCAL')}
              aria-pressed={filtros.grupo === 'LOCAL'}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filtros.grupo === 'LOCAL' ? 'bg-[#023E8A] text-white' : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
              }`}
            >
              🏬 Tienda local
            </button>
          </div>
        )}

        {/* Encabezado — el botón de Filtros en móvil no depende de tener un
            término de búsqueda: en escritorio el panel de filtros siempre
            está visible, así que en móvil también debe poder abrirse sin
            haber buscado texto primero. */}
        {(q || tab === 'productos') && (
          <div className="flex items-start justify-between gap-4">
            {q ? (
              <div>
                <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-1">Resultados</p>
                <h1 className="text-2xl md:text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>«{q}»</h1>
              </div>
            ) : <div />}
            {tab === 'productos' && (
              <button onClick={() => setMostrarFiltros(v => !v)}
                className="md:hidden flex items-center gap-2 border border-[#1A1A1A]/15 bg-white rounded-xl px-3 py-2 text-sm font-medium text-[#1A1A1A] shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12M10 20h4" /></svg>
                Filtros
                {filtrosActivos > 0 && <span className="bg-[#2D6A4F] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">{filtrosActivos}</span>}
              </button>
            )}
          </div>
        )}

        {tab === 'productos' && mostrarFiltros && <div className="md:hidden">{PanelFiltros}</div>}

        {/* Layout */}
        <div className={tab === 'productos' ? 'grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start' : ''}>
          {tab === 'productos' && <aside className="hidden md:block sticky top-4">{PanelFiltros}</aside>}

          <div className="flex flex-col gap-6">

            {/* ── PRODUCTOS ── */}
            {tab === 'productos' && (
              <>
                {errorProductos && !cargandoProductos && <EmptyState titulo="No pudimos buscar" descripcion={errorProductos} onReintentar={() => cargarProductos(q, pagina, false)} />}
                {cargandoProductos && <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>}
                {sinTerminoNiFiltros && <EmptyState titulo="¿Qué estás buscando?" descripcion="Escribe el nombre de un producto, un sabor o un productor, o usa los filtros." />}
                {!cargandoProductos && !errorProductos && productos.length === 0 && (q || filtrosActivos > 0 || grupoEsLocal) && (
                  <EmptyState titulo={q ? `Sin resultados para «${q}»` : 'Sin resultados'} descripcion={grupoEsLocal ? 'Aún no hay productos en Tienda Local que coincidan.' : 'Prueba con otra palabra o ajusta los filtros.'} />
                )}
                {!cargandoProductos && !errorProductos && productos.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{productos.map(p => <TarjetaProducto key={p.id} producto={p} mostrarBadgeVerificado={grupoEsLocal} />)}</div>
                )}
                {cargandoMas && <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`mas-${i}`} />)}</div>}
                {!cargandoProductos && !errorProductos && productos.length > 0 && pagina < paginas && (
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <button onClick={cargarMas} disabled={cargandoMas} className={`${btnPrimario} min-w-[160px] disabled:opacity-50`}>{cargandoMas ? 'Cargando...' : 'Cargar más'}</button>
                    <span className="text-xs text-[#1A1A1A]/40">Página {pagina} de {paginas}</span>
                  </div>
                )}
              </>
            )}

            {/* ── HOTELES ── */}
            {tab === 'hoteles' && (
              <>
                {cargandoTurismo && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />)}</div>}
                {!cargandoTurismo && q && hotelesFiltrados.length === 0 && (
                  <EmptyState titulo={`Sin hoteles para «${q}»`} descripcion="Prueba con el nombre de una ciudad o del hotel." />
                )}
                {!cargandoTurismo && hotelesFiltrados.length === 0 && !q && (
                  <EmptyState titulo="No hay hoteles disponibles" descripcion="Aún no hay hoteles registrados." />
                )}
                {!cargandoTurismo && hotelesFiltrados.length > 0 && (
                  <>
                    <p className="text-xs text-gray-400">{hotelesFiltrados.length} hotel{hotelesFiltrados.length !== 1 ? 'es' : ''}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{hotelesFiltrados.map(h => <TarjetaHotelBuscar key={h.id} h={h} />)}</div>
                  </>
                )}
              </>
            )}

            {/* ── TOURS ── */}
            {tab === 'tours' && (
              <>
                {cargandoTurismo && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />)}</div>}
                {!cargandoTurismo && q && toursFiltrados.length === 0 && (
                  <EmptyState titulo={`Sin tours para «${q}»`} descripcion="Prueba con la ciudad, el nombre del tour o el operador." />
                )}
                {!cargandoTurismo && toursFiltrados.length === 0 && !q && (
                  <EmptyState titulo="No hay tours disponibles" descripcion="Aún no hay tours registrados." />
                )}
                {!cargandoTurismo && toursFiltrados.length > 0 && (
                  <>
                    <p className="text-xs text-gray-400">{toursFiltrados.length} tour{toursFiltrados.length !== 1 ? 's' : ''}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{toursFiltrados.map(t => <TarjetaTourBuscar key={t.id} t={t} />)}</div>
                  </>
                )}
              </>
            )}

            {/* ── TRANSPORTES ── */}
            {tab === 'transportes' && (
              <>
                {cargandoTurismo && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />)}</div>}
                {!cargandoTurismo && q && transportesFiltrados.length === 0 && (
                  <EmptyState titulo={`Sin transporte para «${q}»`} descripcion="Prueba con el origen, destino o tipo de embarcación." />
                )}
                {!cargandoTurismo && transportesFiltrados.length === 0 && !q && (
                  <EmptyState titulo="No hay servicios disponibles" descripcion="Aún no hay transportes registrados." />
                )}
                {!cargandoTurismo && transportesFiltrados.length > 0 && (
                  <>
                    <p className="text-xs text-gray-400">{transportesFiltrados.length} servicio{transportesFiltrados.length !== 1 ? 's' : ''}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{transportesFiltrados.map(t => <TarjetaTransporteBuscar key={t.id} t={t} />)}</div>
                  </>
                )}
              </>
            )}

          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function PaginaBuscar() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </main>
        <Footer />
      </div>
    }>
      <Resultados />
    </Suspense>
  )
}
