'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import BannerDisplay from '@/components/publicidad/BannerDisplay'
import Footer from '@/components/layout/Footer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/context/AuthContext'
import {
  listarOfertasEmpleo,
  obtenerMiHojaDeVida,
  misPostulacionesEmpleo,
  misFavoritosEmpleo,
  CATEGORIAS_EMPLEO,
  CATEGORIAS_SERVICIO,
  type OfertaEmpleo,
  type TipoContratoEmpleo,
  type TipoPublicacionEmpleo,
  type PostulacionEmpleo,
} from '@/lib/api/empleo'
import { DEPARTAMENTOS } from '@/lib/data/colombia'
import TarjetaOfertaEmpleo, { TIPO_LABEL } from '@/components/empleo/TarjetaOfertaEmpleo'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function PaginaEmpleo() {
  const { usuario, autenticado } = useAuth()
  const [ofertas, setOfertas] = useState<OfertaEmpleo[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [municipio, setMunicipio] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [tipoContrato, setTipoContrato] = useState<TipoContratoEmpleo | ''>('')
  const [tipoPublicacion, setTipoPublicacion] = useState<TipoPublicacionEmpleo>('OFERTA_EMPLEO')
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [misPostulaciones, setMisPostulaciones] = useState<Map<number, PostulacionEmpleo>>(new Map())
  const [tieneHojaDeVida, setTieneHojaDeVida] = useState<boolean | null>(null)
  const [categoria, setCategoria] = useState('')
  const [favoritos, setFavoritos] = useState<Set<number>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 400)
  const [salarioMin, setSalarioMin] = useState('')
  const [salarioMax, setSalarioMax] = useState('')
  const [avisoSecundario, setAvisoSecundario] = useState<string | null>(null)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  useEffect(() => {
    if (!autenticado) return
    misPostulacionesEmpleo()
      .then((lista) => setMisPostulaciones(new Map(lista.map((p) => [p.ofertaEmpleoId, p]))))
      .catch(() => setAvisoSecundario('No pudimos cargar tus postulaciones. Intenta recargar la página.'))
    obtenerMiHojaDeVida().then((h) => setTieneHojaDeVida(!!h)).catch(() => setTieneHojaDeVida(false))
    misFavoritosEmpleo()
      .then((lista) => setFavoritos(new Set(lista.map((o) => o.id))))
      .catch(() => setAvisoSecundario('No pudimos cargar tus favoritos. Intenta recargar la página.'))
  }, [autenticado])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const r = await listarOfertasEmpleo({
        municipio: municipio || undefined,
        departamento: departamento || undefined,
        categoria: categoria || undefined,
        tipoContrato: tipoContrato || undefined,
        tipoPublicacion,
        search: busquedaDebounced || undefined,
        salarioMin: salarioMin ? Number(salarioMin) : undefined,
        salarioMax: salarioMax ? Number(salarioMax) : undefined,
        page: 1,
      })
      setOfertas(r.items)
      setTotal(r.total)
      setPagina(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar las ofertas de empleo.')
      setOfertas([])
      setTotal(0)
    } finally {
      setCargando(false)
    }
  }, [municipio, departamento, categoria, tipoContrato, tipoPublicacion, busquedaDebounced, salarioMin, salarioMax])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function cargarMas() {
    setCargandoMas(true)
    try {
      const siguiente = pagina + 1
      const r = await listarOfertasEmpleo({
        municipio: municipio || undefined,
        departamento: departamento || undefined,
        categoria: categoria || undefined,
        tipoContrato: tipoContrato || undefined,
        tipoPublicacion,
        search: busquedaDebounced || undefined,
        salarioMin: salarioMin ? Number(salarioMin) : undefined,
        salarioMax: salarioMax ? Number(salarioMax) : undefined,
        page: siguiente,
      })
      setOfertas((prev) => [...prev, ...r.items])
      setTotal(r.total)
      setPagina(siguiente)
    } finally {
      setCargandoMas(false)
    }
  }

  function alternarFavorito(id: number, favorito: boolean) {
    setFavoritos((prev) => {
      const next = new Set(prev)
      if (favorito) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const hayMas = ofertas.length < total

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 py-8 pb-12">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              Empleo
            </h1>
            <p className="mt-1 text-sm text-[#1A1A1A]/55">
              {tipoPublicacion === 'OFRECE_SERVICIO'
                ? 'Trabajadores independientes que ofrecen su servicio — contacto directo por WhatsApp.'
                : 'Bolsa de trabajo comunitaria — ofertas locales del Chocó y todo el país.'}
            </p>
          </div>
          <Link href="/empleo/publicar" className="rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors whitespace-nowrap">
            Publicar
          </Link>
        </div>

        {avisoSecundario && (
          <div className="mb-4 rounded-xl border border-[#C0392B]/18 bg-[#C0392B]/6 px-4 py-2.5 text-sm font-medium text-[#842029]">
            {avisoSecundario}
          </div>
        )}

        <div className="flex items-center gap-8 border-b border-[#1A1A1A]/10 mb-6 px-2">
          <button
            type="button"
            onClick={() => { setTipoPublicacion('OFERTA_EMPLEO'); setCategoria(''); setTipoContrato('') }}
            aria-pressed={tipoPublicacion === 'OFERTA_EMPLEO'}
            className={`pb-3 text-base font-semibold border-b-[3px] transition-colors relative top-[1px] ${
              tipoPublicacion === 'OFERTA_EMPLEO' ? 'border-[#2D6A4F] text-[#2D6A4F]' : 'border-transparent text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80'
            }`}
          >
            💼 Empleos
          </button>
          <button
            type="button"
            onClick={() => { setTipoPublicacion('OFRECE_SERVICIO'); setCategoria(''); setTipoContrato('') }}
            aria-pressed={tipoPublicacion === 'OFRECE_SERVICIO'}
            className={`pb-3 text-base font-semibold border-b-[3px] transition-colors relative top-[1px] ${
              tipoPublicacion === 'OFRECE_SERVICIO' ? 'border-[#D4A017] text-[#D4A017]' : 'border-transparent text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80'
            }`}
          >
            🛠️ Servicios Profesionales
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-2.5 rounded-2xl border border-[#1A1A1A]/12 shadow-sm">
          <div className="flex-1 flex items-center gap-3 px-3 py-1">
            <svg className="w-5 h-5 text-[#1A1A1A]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={tipoPublicacion === 'OFERTA_EMPLEO' ? 'Buscar cargo, empresa o palabra clave...' : 'Buscar electricista, plomero, asesor...'}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[#1A1A1A]/40"
            />
          </div>
          <div className="w-[1px] bg-[#1A1A1A]/10 hidden md:block"></div>
          <div className="flex-1 flex items-center gap-3 px-3 py-1">
            <svg className="w-5 h-5 text-[#1A1A1A]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              placeholder="¿En qué ciudad?"
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[#1A1A1A]/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className={`md:ml-auto px-5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              mostrarFiltros ? 'bg-[#1A1A1A] text-white' : 'bg-[#F8F5F0] text-[#1A1A1A] hover:bg-[#EBE7E0]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Filtros
          </button>
        </div>

        {mostrarFiltros && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-5 bg-white rounded-2xl border border-[#1A1A1A]/10 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1.5 uppercase tracking-wider">Departamento</label>
              <select
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value)}
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
              >
                <option value="">Todos</option>
                {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            
            {tipoPublicacion === 'OFERTA_EMPLEO' && (
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1.5 uppercase tracking-wider">Contrato</label>
                <select
                  value={tipoContrato}
                  onChange={(e) => setTipoContrato(e.target.value as TipoContratoEmpleo | '')}
                  className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                >
                  <option value="">Todos</option>
                  {Object.entries(TIPO_LABEL).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>{etiqueta}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1.5 uppercase tracking-wider">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
              >
                <option value="">Todas</option>
                {(tipoPublicacion === 'OFRECE_SERVICIO' ? CATEGORIAS_SERVICIO : CATEGORIAS_EMPLEO).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="lg:col-span-1 md:col-span-2">
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1.5 uppercase tracking-wider">Rango Salarial</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={salarioMin}
                  onChange={(e) => setSalarioMin(e.target.value)}
                  placeholder="Mín"
                  className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                />
                <span className="flex items-center text-[#1A1A1A]/40">-</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={salarioMax}
                  onChange={(e) => setSalarioMax(e.target.value)}
                  placeholder="Máx"
                  className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                />
              </div>
            </div>
          </div>
        )}

        {cargando ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#C0392B]/18 bg-[#C0392B]/6 p-8 text-center">
            <p className="text-sm font-semibold text-[#842029]">{error}</p>
            <button
              type="button"
              onClick={cargar}
              className="mt-4 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : ofertas.length === 0 ? (
          <EmptyState titulo="No hay ofertas disponibles" descripcion="Prueba con otro municipio, categoría o tipo de contrato, o vuelve más tarde." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ofertas.map((o) => (
                o.esBannerDisplay ? (
                  <div key={o.id} className="col-span-1 lg:col-span-2">
                    <BannerDisplay 
                      banner={{
                        id: String(o.id),
                        esBannerDisplay: true,
                        titulo: o.titulo,
                        subtitulo: o.subtitulo,
                        mediaUrl: o.mediaUrl,
                        urlDestino: o.urlDestino,
                        ctaTexto: o.ctaTexto,
                        etiqueta: o.etiqueta
                      }} 
                    />
                  </div>
                ) : (
                  <TarjetaOfertaEmpleo
                    key={o.id}
                    oferta={o}
                    usuarioId={usuario?.id}
                    postulacion={misPostulaciones.get(o.id)}
                    tieneHojaDeVida={tieneHojaDeVida}
                    onPostulado={(p) => setMisPostulaciones((prev) => new Map(prev).set(o.id, p))}
                    autenticado={autenticado}
                    esFavorito={favoritos.has(o.id)}
                    onToggleFavorito={alternarFavorito}
                  />
                )
              ))}
            </div>
            {hayMas && (
              <button
                type="button"
                onClick={cargarMas}
                disabled={cargandoMas}
                className="self-center rounded-xl border border-[#1A1A1A]/15 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/70 hover:bg-white disabled:opacity-50"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar más ofertas'}
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
