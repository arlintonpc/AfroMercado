'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { SkeletonCard, EmptyState } from '@/components/ui'
import { listarProductos, listarCategorias } from '@/lib/api/productos'
import { apiFetch } from '@/lib/api/client'
import { mapearProductos } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'
import type { Categoria } from '@/types/categoria'

const FILTROS_VACIOS = {
  categoriaId: '',
  precioMin: '',
  precioMax: '',
  alcance: '' as '' | 'LOCAL' | 'NACIONAL' | 'AMBOS',
  enOferta: false,
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

function Resultados() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const categoriaSlug = searchParams.get('categoria') ?? ''

  const [termino, setTermino] = useState(q)
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [paginas, setPaginas] = useState(0)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const filtrosRef = useRef(filtros)

  useEffect(() => {
    filtrosRef.current = filtros
  }, [filtros])

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {})
  }, [])

  // Si la URL trae ?categoria=<slug> (desde el home), aplica ese filtro.
  useEffect(() => {
    if (!categoriaSlug || categorias.length === 0) return
    const cat = categorias.find((c) => c.slug === categoriaSlug)
    if (cat) setFiltros((f) => ({ ...f, categoriaId: cat.id }))
  }, [categoriaSlug, categorias])

  useEffect(() => {
    setTermino(q)
  }, [q])

  const cargar = useCallback(async (texto: string, paginaNum: number, append: boolean) => {
    const f = filtrosRef.current
    const hayTermino = !!texto.trim()
    const hayFiltros = contarFiltrosActivos(f) > 0

    if (!hayTermino && !hayFiltros) {
      setProductos([])
      setTotal(0)
      setPaginas(0)
      return
    }

    if (append) {
      setCargandoMas(true)
    } else {
      setCargando(true)
    }
    setError(null)

    try {
      const { items, total: tot, paginas: pags } = await listarProductos({
        q: texto.trim() || undefined,
        categoriaId: f.categoriaId || undefined,
        precioMin: f.precioMin ? Number(f.precioMin) : undefined,
        precioMax: f.precioMax ? Number(f.precioMax) : undefined,
        alcance: f.alcance || undefined,
        enOferta: f.enOferta || undefined,
        pagina: paginaNum,
        porPagina: 24,
      })
      const mapeados = mapearProductos(items)
      setProductos(prev => append ? [...prev, ...mapeados] : mapeados)
      setTotal(tot)
      setPaginas(pags)

      if (!append && texto.trim()) {
        const sesionId = (() => {
          try {
            let s = sessionStorage.getItem('afm_sid')
            if (!s) { s = Math.random().toString(36).slice(2); sessionStorage.setItem('afm_sid', s) }
            return s
          } catch { return undefined }
        })()
        apiFetch('/productos/busqueda', { method: 'POST', body: { query: texto.trim(), sesionId } }).catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo realizar la búsqueda.')
      if (!append) setProductos([])
    } finally {
      setCargando(false)
      setCargandoMas(false)
    }
  }, [])

  useEffect(() => {
    setPagina(1)
    cargar(q, 1, false)
  }, [q, filtros, cargar])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const texto = termino.trim()
    router.push(texto ? `/buscar?q=${encodeURIComponent(texto)}` : '/buscar')
  }

  function actualizarFiltro<K extends keyof typeof FILTROS_VACIOS>(clave: K, valor: (typeof FILTROS_VACIOS)[K]) {
    setFiltros(prev => ({ ...prev, [clave]: valor }))
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS)
  }

  function cargarMas() {
    const sig = pagina + 1
    setPagina(sig)
    cargar(q, sig, true)
  }

  const filtrosActivos = contarFiltrosActivos(filtros)
  const hayResultados = !cargando && !error && productos.length > 0
  const sinTerminoNiFiltros = !q && filtrosActivos === 0 && !cargando

  const inputCls = 'h-10 px-3 rounded-xl border border-[#1A1A1A]/15 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] text-sm w-full'
  const btnPrimario = 'bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold rounded-xl px-4 py-2 text-sm transition-colors'

  const PanelFiltros = (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[#1A1A1A] text-sm">Filtros</span>
        {filtrosActivos > 0 && (
          <button
            onClick={limpiarFiltros}
            className="text-xs text-[#2D6A4F] hover:underline font-medium"
          >
            Limpiar ({filtrosActivos})
          </button>
        )}
      </div>

      {/* Chips de filtros activos */}
      {filtrosActivos > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filtros.categoriaId && (
            <span className="bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">
              {categorias.find(c => c.id === filtros.categoriaId)?.nombre ?? 'Categoría'}
            </span>
          )}
          {filtros.precioMin && (
            <span className="bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">
              Desde ${filtros.precioMin}
            </span>
          )}
          {filtros.precioMax && (
            <span className="bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">
              Hasta ${filtros.precioMax}
            </span>
          )}
          {filtros.alcance && (
            <span className="bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">
              {filtros.alcance === 'LOCAL' ? 'Solo local' : filtros.alcance === 'NACIONAL' ? 'Nacional' : 'Ambos'}
            </span>
          )}
          {filtros.enOferta && (
            <span className="bg-[#D4A017]/15 text-[#D4A017] text-xs font-medium px-2.5 py-1 rounded-full">
              En oferta
            </span>
          )}
        </div>
      )}

      {/* Categoría */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide">Categoría</label>
        <select
          value={filtros.categoriaId}
          onChange={e => actualizarFiltro('categoriaId', e.target.value)}
          className={inputCls}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.icono ? `${cat.icono} ` : ''}{cat.nombre}</option>
          ))}
        </select>
      </div>

      {/* Rango de precio */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide">Precio</label>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            placeholder="Desde $"
            value={filtros.precioMin}
            onChange={e => actualizarFiltro('precioMin', e.target.value)}
            className={inputCls}
          />
          <input
            type="number"
            min={0}
            placeholder="Hasta $"
            value={filtros.precioMax}
            onChange={e => actualizarFiltro('precioMax', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Alcance */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide">Alcance</label>
        <div className="flex flex-col gap-1.5">
          {([['', 'Todos'], ['LOCAL', 'Solo local'], ['NACIONAL', 'Nacional']] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-[#1A1A1A]">
              <input
                type="radio"
                name="alcance"
                value={val}
                checked={filtros.alcance === val}
                onChange={() => actualizarFiltro('alcance', val)}
                className="accent-[#2D6A4F]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* En oferta */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={filtros.enOferta}
          onChange={e => actualizarFiltro('enOferta', e.target.checked)}
          className="w-4 h-4 rounded accent-[#2D6A4F]"
        />
        <span className="text-sm text-[#1A1A1A]">Solo con descuento</span>
      </label>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">

        {/* Buscador */}
        <form onSubmit={onSubmit} role="search" className="w-full">
          <div className="relative">
            <input
              type="search"
              autoFocus
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              placeholder="Buscar productos del Chocó..."
              aria-label="Buscar productos"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#1A1A1A]/15 bg-white focus:outline-none focus:border-[#D4A017] text-base"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1A1A1A]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        {/* Encabezado de resultados + botón filtros móvil */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {q ? (
              <>
                <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-1">Resultados</p>
                <h1 className="text-2xl md:text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                  «{q}»
                </h1>
              </>
            ) : filtrosActivos > 0 ? (
              <h1 className="text-xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                Catálogo filtrado
              </h1>
            ) : null}
            {!cargando && !error && (q || filtrosActivos > 0) && (
              <p className="text-sm text-[#1A1A1A]/40 mt-1">
                Mostrando {productos.length} de {total} {total === 1 ? 'producto' : 'productos'}
              </p>
            )}
          </div>

          {/* Botón filtros móvil */}
          <button
            onClick={() => setMostrarFiltros(v => !v)}
            className="md:hidden flex items-center gap-2 border border-[#1A1A1A]/15 bg-white rounded-xl px-3 py-2 text-sm font-medium text-[#1A1A1A] shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12M10 20h4" />
            </svg>
            Filtros
            {filtrosActivos > 0 && (
              <span className="bg-[#2D6A4F] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {filtrosActivos}
              </span>
            )}
          </button>
        </div>

        {/* Panel filtros móvil colapsable */}
        {mostrarFiltros && (
          <div className="md:hidden">
            {PanelFiltros}
          </div>
        )}

        {/* Layout desktop: sidebar + grid */}
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">

          {/* Sidebar filtros desktop */}
          <aside className="hidden md:block sticky top-4">
            {PanelFiltros}
          </aside>

          {/* Contenido principal */}
          <div className="flex flex-col gap-6">

            {/* Error */}
            {error && !cargando && (
              <EmptyState
                titulo="No pudimos buscar"
                descripcion={error}
                onReintentar={() => cargar(q, pagina, false)}
              />
            )}

            {/* Skeleton carga inicial */}
            {cargando && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {/* Sin término ni filtros */}
            {sinTerminoNiFiltros && (
              <EmptyState
                titulo="¿Qué estás buscando?"
                descripcion="Escribe el nombre de un producto, un sabor o un productor del Chocó, o usa los filtros."
              />
            )}

            {/* Sin resultados */}
            {!cargando && !error && productos.length === 0 && (q || filtrosActivos > 0) && (
              <EmptyState
                titulo={q ? `Sin resultados para «${q}»` : 'Sin resultados'}
                descripcion="Prueba con otra palabra o ajusta los filtros. Nuestro catálogo crece con productos del campo chocoano."
              />
            )}

            {/* Grid de resultados */}
            {!cargando && !error && productos.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {productos.map((producto) => (
                  <TarjetaProducto key={producto.id} producto={producto} />
                ))}
              </div>
            )}

            {/* Skeleton cargar más */}
            {cargandoMas && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={`mas-${i}`} />
                ))}
              </div>
            )}

            {/* Paginación */}
            {hayResultados && pagina < paginas && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  onClick={cargarMas}
                  disabled={cargandoMas}
                  className={`${btnPrimario} min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {cargandoMas ? 'Cargando...' : 'Cargar más'}
                </button>
                <span className="text-xs text-[#1A1A1A]/40">
                  Página {pagina} de {paginas}
                </span>
              </div>
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
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
          <Header />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <Resultados />
    </Suspense>
  )
}
