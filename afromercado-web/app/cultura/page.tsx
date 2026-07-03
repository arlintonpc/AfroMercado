'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { listarAgenda, precioDesde, type EventoCultural } from '@/lib/api/cultura'
import { DEPARTAMENTOS } from '@/lib/data/colombia'

function rangoFechas(inicio: string, fin?: string | null): string {
  const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const i = new Date(inicio).toLocaleDateString('es-CO', opt)
  if (!fin) return i
  const f = new Date(fin).toLocaleDateString('es-CO', opt)
  return i === f ? i : `${i} – ${f}`
}

function TarjetaEvento({ ev }: { ev: EventoCultural }) {
  const desde = precioDesde(ev)
  return (
    <Link
      href={`/cultura/${ev.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white transition hover:border-[#2D6A4F]/40 hover:shadow-sm"
    >
      <div className="relative flex h-32 items-center justify-center bg-[#2D6A4F] text-white">
        {ev.portadaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.portadaUrl} alt={ev.titulo} className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl" aria-hidden="true">🎭</span>
        )}
        {ev.patrimonio && (
          <span className="absolute right-2 top-2 rounded-full bg-[#D4A017] px-2 py-1 text-[10px] font-semibold text-[#412402]">
            ★ {ev.patrimonioNota || 'Patrimonio'}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs font-medium text-[#2D6A4F]">
          📅 {rangoFechas(ev.fechaInicio, ev.fechaFin)}
        </span>
        <h3 className="font-serif text-lg leading-tight text-[#1B4332]">{ev.titulo}</h3>
        <span className="text-sm text-[#1A1A1A]/60">
          {ev.municipio}, {ev.departamento}
        </span>
        <div className="mt-2 flex items-center justify-between">
          {ev.categoria && (
            <span className="rounded-full bg-[#EAF3DE] px-2 py-1 text-[11px] text-[#3B6D11]">{ev.categoria}</span>
          )}
          <span className="ml-auto text-sm font-semibold text-[#1B4332]">
            {desde == null ? 'Entrada libre' : desde === 0 ? 'Gratis' : `Desde $${desde.toLocaleString('es-CO')}`}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function CulturaPage() {
  const [eventos, setEventos] = useState<EventoCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [departamento, setDepartamento] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setEventos(await listarAgenda({ departamento: departamento || undefined }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar la agenda cultural.')
    } finally {
      setCargando(false)
    }
  }, [departamento])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wide text-[#2D6A4F]">🎭 CULTURA</p>
        <h1 className="font-serif text-3xl leading-tight text-[#1B4332]">La agenda viva del territorio</h1>
        <p className="mt-2 max-w-2xl text-[#1A1A1A]/65">
          Fiestas, música y tradición de cada región. Descubre, vive y reserva tu experiencia.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="text-sm text-[#1A1A1A]/70" htmlFor="filtro-depto">
          Departamento
        </label>
        <select
          id="filtro-depto"
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
          className="rounded-full border border-[#1A1A1A]/15 bg-white px-4 py-2 text-sm outline-none focus:border-[#2D6A4F]"
        >
          <option value="">Todo Colombia</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {cargando ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-[#1A1A1A]/5" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/5 p-6 text-center">
          <p className="text-[#C0392B]">{error}</p>
          <button onClick={cargar} className="mt-3 rounded-full bg-[#1B4332] px-5 py-2 text-sm text-white">
            Reintentar
          </button>
        </div>
      ) : eventos.length === 0 ? (
        <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-10 text-center">
          <p className="text-4xl" aria-hidden="true">🗓️</p>
          <p className="mt-3 font-serif text-xl text-[#1B4332]">Aún no hay eventos publicados</p>
          <p className="mt-1 text-[#1A1A1A]/60">
            Pronto se llenará de fiestas y tradición{departamento ? ` en ${departamento}` : ''}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map((ev) => (
            <TarjetaEvento key={ev.id} ev={ev} />
          ))}
        </div>
      )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
