'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
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
  type OfertaEmpleo,
  type TipoContratoEmpleo,
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

  useEffect(() => {
    if (!autenticado) return
    misPostulacionesEmpleo()
      .then((lista) => setMisPostulaciones(new Map(lista.map((p) => [p.ofertaEmpleoId, p]))))
      .catch(() => {})
    obtenerMiHojaDeVida().then((h) => setTieneHojaDeVida(!!h)).catch(() => setTieneHojaDeVida(false))
    misFavoritosEmpleo().then((lista) => setFavoritos(new Set(lista.map((o) => o.id)))).catch(() => {})
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
  }, [municipio, departamento, categoria, tipoContrato, busquedaDebounced, salarioMin, salarioMax])

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
            <p className="mt-1 text-sm text-[#1A1A1A]/55">Bolsa de trabajo comunitaria — ofertas locales del Chocó y todo el país.</p>
          </div>
          <Link href="/empleo/publicar" className="rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors whitespace-nowrap">
            Publicar oferta
          </Link>
        </div>

        <div className="mb-3">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título…"
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <select
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            placeholder="Filtrar por municipio…"
            className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          />
          <select
            value={tipoContrato}
            onChange={(e) => setTipoContrato(e.target.value as TipoContratoEmpleo | '')}
            className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Todos los tipos de contrato</option>
            {Object.entries(TIPO_LABEL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS_EMPLEO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={salarioMin}
            onChange={(e) => setSalarioMin(e.target.value)}
            placeholder="Salario mínimo"
            className="w-36 rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={salarioMax}
            onChange={(e) => setSalarioMax(e.target.value)}
            placeholder="Salario máximo"
            className="w-36 rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          />
        </div>

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
