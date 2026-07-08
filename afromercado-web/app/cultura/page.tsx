'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { listarAgenda, misFavoritosCultura, precioDesde, type EventoCultural } from '@/lib/api/cultura'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import { CATEGORIAS_CULTURA } from '@/lib/data/culturaCategorias'
import { useAuth } from '@/context/AuthContext'
import TarjetaEventoCultural from '@/components/cultura/TarjetaEventoCultural'
import {
  CulturaCard,
  CulturaHero,
  CulturaPageContainer,
  CulturaQuickLink,
  CulturaShell,
  CulturaSkeletonGrid,
  CulturaStateCard,
  CulturaStat,
  CulturaToolbar,
} from '@/components/cultura/CulturaUI'

const MapaCultura = dynamic(() => import('@/components/cultura/MapaCultura'), { ssr: false })

type FiltroFecha = 'hoy' | 'finde' | 'mes' | null
type Vista = 'grid' | 'mapa'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function fmtISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function calcularRangoFecha(tipo: FiltroFecha): { fechaDesde?: string; fechaHasta?: string } {
  if (!tipo) return {}
  const hoy = new Date()
  if (tipo === 'hoy') {
    const hoyStr = fmtISO(hoy)
    return { fechaDesde: hoyStr, fechaHasta: hoyStr }
  }
  if (tipo === 'mes') {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    return { fechaDesde: fmtISO(inicio), fechaHasta: fmtISO(fin) }
  }
  // finde: sábado y domingo próximos (si hoy ya es fin de semana, usa el actual)
  const dia = hoy.getDay() // 0 domingo … 6 sábado
  let sabado: Date
  if (dia === 6) sabado = hoy
  else if (dia === 0) sabado = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  else sabado = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + (6 - dia))
  const domingo = new Date(sabado.getFullYear(), sabado.getMonth(), sabado.getDate() + 1)
  return { fechaDesde: dia === 0 ? fmtISO(hoy) : fmtISO(sabado), fechaHasta: fmtISO(domingo) }
}

export default function CulturaPage() {
  const { autenticado } = useAuth()
  const [eventos, setEventos] = useState<EventoCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [categoria, setCategoria] = useState('')
  const [soloPatrimonio, setSoloPatrimonio] = useState(false)
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>(null)
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 400)
  const [vista, setVista] = useState<Vista>('grid')
  const [favoritosIds, setFavoritosIds] = useState<Set<number>>(new Set())

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { fechaDesde, fechaHasta } = calcularRangoFecha(filtroFecha)
      setEventos(
        await listarAgenda({
          departamento: departamento || undefined,
          municipio: municipio || undefined,
          categoria: categoria || undefined,
          search: busquedaDebounced || undefined,
          patrimonio: soloPatrimonio || undefined,
          fechaDesde,
          fechaHasta,
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar la agenda cultural.')
    } finally {
      setCargando(false)
    }
  }, [departamento, municipio, categoria, soloPatrimonio, filtroFecha, busquedaDebounced])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (!autenticado) { setFavoritosIds(new Set()); return }
    misFavoritosCultura()
      .then((favs) => setFavoritosIds(new Set(favs.map((f) => f.id))))
      .catch(() => {})
  }, [autenticado])

  function manejarCambioDepartamento(valor: string) {
    setDepartamento(valor)
    setMunicipio('')
  }

  function manejarFavoritoCambio(eventoId: number, esFavorito: boolean) {
    setFavoritosIds((prev) => {
      const next = new Set(prev)
      if (esFavorito) next.add(eventoId)
      else next.delete(eventoId)
      return next
    })
  }

  const municipiosDisponibles = useMemo(() => (departamento ? municipiosDe(departamento) : []), [departamento])

  const estadisticas = useMemo(() => {
    const total = eventos.length
    const gratis = eventos.filter((ev) => precioDesde(ev) === 0 || ev.gratuito).length
    const patrimonio = eventos.filter((ev) => ev.patrimonio).length
    const departamentos = new Set(eventos.map((ev) => ev.departamento)).size
    return { total, gratis, patrimonio, departamentos }
  }, [eventos])

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Link href="/cultura/galeria" className="rounded-full border border-[#2D6A4F]/18 bg-[#EAF3DE] px-4 py-2 text-sm font-semibold text-[#1B4332] transition hover:bg-[#dff0cb]">
        Ver galería
      </Link>
      <Link href="/cultura/comparte" className="rounded-full bg-[#D4A017] px-4 py-2 text-sm font-semibold text-[#1A1A1A] transition hover:bg-[#c59616]">
        Compartir historia
      </Link>
    </div>
  )

  const chipsFecha: { tipo: Exclude<FiltroFecha, null>; label: string }[] = [
    { tipo: 'hoy', label: 'Hoy' },
    { tipo: 'finde', label: 'Este fin de semana' },
    { tipo: 'mes', label: 'Este mes' },
  ]

  return (
    <CulturaShell>
      <CulturaPageContainer className="space-y-6">
        <CulturaHero
          eyebrow="Agenda cultural"
          title="La agenda viva del territorio"
          description="Fiestas, música, danza y memoria comunitaria en un solo lugar. Descubre experiencias culturales con identidad propia y reserva desde la misma pantalla."
          actions={actions}
          badge={
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              <CulturaStat label="Eventos" value={String(estadisticas.total)} accent="green" />
              <CulturaStat label="Gratis" value={String(estadisticas.gratis)} accent="gold" />
            </div>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CulturaQuickLink href="/cultura/mis-reservas" label="Mis reservas" description="Consulta tus códigos, estados y próximos pasos." />
          <CulturaQuickLink href="/cultura/favoritos" label="Mis favoritos" description="Los eventos que guardaste con el corazón." />
          <CulturaQuickLink href="/cultura/galeria" label="Galería cultural" description="Fotos, videos e historias compartidas por la comunidad." />
          <CulturaQuickLink href="/cultura/comparte" label="Comparte tu Territorio" description="Publica una historia o sitio que merezca verse." />
          <CulturaQuickLink href="/comerciante/cultura" label="Soy comerciante" description="Publica eventos y vende entradas con identidad propia." />
        </div>

        <CulturaToolbar>
          <div className="flex flex-1 flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#1A1A1A]/60" htmlFor="filtro-depto">
                Departamento
              </label>
              <select
                id="filtro-depto"
                value={departamento}
                onChange={(e) => manejarCambioDepartamento(e.target.value)}
                className="min-w-[200px] rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
              >
                <option value="">Todo Colombia</option>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#1A1A1A]/60" htmlFor="filtro-municipio">
                Municipio
              </label>
              <select
                id="filtro-municipio"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                disabled={!departamento}
                className="min-w-[180px] rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Todos</option>
                {municipiosDisponibles.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#1A1A1A]/60" htmlFor="filtro-categoria">
                Categoría
              </label>
              <select
                id="filtro-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="min-w-[170px] rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
              >
                <option value="">Todas</option>
                {CATEGORIAS_CULTURA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-1 min-w-[200px] flex-col gap-1">
              <label className="text-xs font-semibold text-[#1A1A1A]/60" htmlFor="filtro-busqueda">
                Buscar
              </label>
              <input
                id="filtro-busqueda"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Título del evento…"
                className="w-full rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
              />
            </div>
          </div>
        </CulturaToolbar>

        <CulturaToolbar>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSoloPatrimonio((v) => !v)}
              aria-pressed={soloPatrimonio}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                soloPatrimonio
                  ? 'border-[#D4A017]/40 bg-[#FAEEDA] text-[#6B4E0D]'
                  : 'border-[#1A1A1A]/12 bg-white text-[#1A1A1A]/70 hover:bg-[#F8F5F0]'
              }`}
            >
              🏛️ Solo patrimonio
            </button>

            <span className="mx-1 hidden h-6 w-px bg-[#1A1A1A]/10 sm:inline-block" aria-hidden="true" />

            {chipsFecha.map((chip) => (
              <button
                key={chip.tipo}
                type="button"
                onClick={() => setFiltroFecha((prev) => (prev === chip.tipo ? null : chip.tipo))}
                aria-pressed={filtroFecha === chip.tipo}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  filtroFecha === chip.tipo
                    ? 'border-[#2D6A4F]/40 bg-[#EAF3DE] text-[#1B4332]'
                    : 'border-[#1A1A1A]/12 bg-white text-[#1A1A1A]/70 hover:bg-[#F8F5F0]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden gap-2 sm:flex">
              <CulturaStat label="Departamentos" value={String(estadisticas.departamentos)} />
              <CulturaStat label="Patrimonio" value={String(estadisticas.patrimonio)} accent="gold" />
            </div>
            <div className="inline-flex rounded-full border border-[#1A1A1A]/12 bg-white p-1">
              <button
                type="button"
                onClick={() => setVista('grid')}
                aria-pressed={vista === 'grid'}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  vista === 'grid' ? 'bg-[#1B4332] text-white' : 'text-[#1A1A1A]/60 hover:bg-[#F8F5F0]'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setVista('mapa')}
                aria-pressed={vista === 'mapa'}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  vista === 'mapa' ? 'bg-[#1B4332] text-white' : 'text-[#1A1A1A]/60 hover:bg-[#F8F5F0]'
                }`}
              >
                Mapa
              </button>
            </div>
          </div>
        </CulturaToolbar>

        {cargando ? (
          <CulturaSkeletonGrid />
        ) : error ? (
          <CulturaStateCard
            tone="error"
            icon="⚠️"
            title="No pudimos cargar la agenda"
            description={error}
            action={
              <button onClick={cargar} className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]">
                Reintentar
              </button>
            }
          />
        ) : eventos.length === 0 ? (
          <CulturaStateCard
            icon="🗓️"
            title="Todavía no hay eventos publicados"
            description={`Pronto se llenará de fiestas, música y tradición${departamento ? ` en ${departamento}` : ''}.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/cultura/galeria" className="rounded-full border border-[#1A1A1A]/10 px-5 py-2 text-sm font-semibold text-[#1A1A1A]/65 transition hover:bg-white">
                  Explorar galería
                </Link>
                <Link href="/cultura/comparte" className="rounded-full bg-[#1B4332] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#245a42]">
                  Compartir historia
                </Link>
              </div>
            }
          />
        ) : vista === 'mapa' ? (
          <CulturaCard className="p-3">
            <MapaCultura eventos={eventos} />
          </CulturaCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {eventos.map((ev) => (
              <TarjetaEventoCultural
                key={ev.id}
                ev={ev}
                esFavorito={favoritosIds.has(ev.id)}
                onFavoritoChange={manejarFavoritoCambio}
              />
            ))}
          </div>
        )}
      </CulturaPageContainer>
    </CulturaShell>
  )
}
