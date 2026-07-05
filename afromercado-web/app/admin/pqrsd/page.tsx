'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  pqrsdAdmin,
  responderPqrsdAdmin,
  cerrarPqrsdAdmin,
  type Pqrsd,
  type EstadoPqrsd,
  type TipoPqrsd,
} from '@/lib/api/pqrsd'

const TIPO_LABEL: Record<TipoPqrsd, string> = {
  PETICION: 'Petición',
  QUEJA: 'Queja',
  RECLAMO: 'Reclamo',
  SUGERENCIA: 'Sugerencia',
  DENUNCIA: 'Denuncia',
}

const ESTADO_LABEL: Record<EstadoPqrsd, string> = {
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En proceso',
  RESPONDIDO: 'Respondido',
  CERRADO: 'Cerrado',
}

const ESTADO_COLOR: Record<EstadoPqrsd, string> = {
  ABIERTO: 'bg-[#F39C12]/15 text-[#B7730A]',
  EN_PROCESO: 'bg-blue-100 text-blue-700',
  RESPONDIDO: 'bg-[#52B788]/15 text-[#2D6A4F]',
  CERRADO: 'bg-gray-100 text-gray-600',
}

const FILTROS_ESTADO: { id: EstadoPqrsd | 'TODOS'; etiqueta: string }[] = [
  { id: 'TODOS', etiqueta: 'Todos' },
  { id: 'ABIERTO', etiqueta: 'Abiertos' },
  { id: 'RESPONDIDO', etiqueta: 'Respondidos' },
  { id: 'CERRADO', etiqueta: 'Cerrados' },
]

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function TarjetaPqrsd({
  ticket,
  procesando,
  onResponder,
  onCerrar,
}: {
  ticket: Pqrsd
  procesando: boolean
  onResponder: (t: Pqrsd, respuesta: string) => void
  onCerrar: (t: Pqrsd) => void
}) {
  const [respuesta, setRespuesta] = useState('')

  return (
    <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[#1A1A1A]">{TIPO_LABEL[ticket.tipo]} · {ticket.asunto}</p>
          <p className="mt-0.5 text-[11px] text-[#1A1A1A]/45">
            {ticket.nombreContacto} · {ticket.emailContacto}{ticket.telefonoContacto ? ` · ${ticket.telefonoContacto}` : ''}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1A1A1A]/45">{fechaCorta(ticket.createdAt)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ESTADO_COLOR[ticket.estado]}`}>
          {ESTADO_LABEL[ticket.estado]}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-lg border border-[#1A1A1A]/8 bg-[#F8F5F0] px-3 py-2 text-sm text-[#1A1A1A]/75">
        {ticket.mensaje}
      </p>

      {ticket.respuesta && (
        <div className="mt-3 rounded-lg border border-[#52B788]/25 bg-[#52B788]/8 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#2D6A4F]/70">Nuestra respuesta</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#1A1A1A]/75">{ticket.respuesta}</p>
        </div>
      )}

      {ticket.estado !== 'CERRADO' && (
        <div className="mt-3 flex flex-col gap-2">
          {ticket.estado !== 'RESPONDIDO' && (
            <>
              <textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                rows={2}
                placeholder="Escribe una respuesta"
                className="w-full resize-none rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
              />
              <button
                onClick={() => onResponder(ticket, respuesta)}
                disabled={procesando || !respuesta.trim()}
                className="self-start rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50"
              >
                Responder
              </button>
            </>
          )}
          <button
            onClick={() => onCerrar(ticket)}
            disabled={procesando}
            className="self-start rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-bold text-[#1A1A1A]/60 hover:bg-[#F8F5F0] disabled:opacity-50"
          >
            Cerrar ticket
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminPqrsdPage() {
  const [tickets, setTickets] = useState<Pqrsd[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoPqrsd | 'TODOS'>('TODOS')

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)
    pqrsdAdmin({ estado: filtroEstado === 'TODOS' ? undefined : filtroEstado })
      .then(setTickets)
      .catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar los tickets.'))
      .finally(() => setCargando(false))
  }, [filtroEstado])

  useEffect(() => { cargar() }, [cargar])

  async function handleResponder(ticket: Pqrsd, respuesta: string) {
    setProcesandoId(ticket.id)
    try {
      const actualizado = await responderPqrsdAdmin(ticket.id, respuesta)
      setTickets((prev) => prev.map((t) => (t.id === actualizado.id ? actualizado : t)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo responder.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleCerrar(ticket: Pqrsd) {
    setProcesandoId(ticket.id)
    try {
      const actualizado = await cerrarPqrsdAdmin(ticket.id)
      setTickets((prev) => prev.map((t) => (t.id === actualizado.id ? actualizado : t)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo cerrar el ticket.')
    } finally {
      setProcesandoId(null)
    }
  }

  const pendientes = tickets.filter((t) => t.estado === 'ABIERTO' || t.estado === 'EN_PROCESO').length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#1A1A1A]">PQRSD</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">
        Peticiones, quejas, reclamos, sugerencias y denuncias dirigidas a la plataforma.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTROS_ESTADO.map(({ id, etiqueta }) => (
          <button
            key={id}
            onClick={() => setFiltroEstado(id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              filtroEstado === id ? 'bg-[#2D6A4F] text-white' : 'border border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/65 hover:bg-[#F8F5F0]'
            }`}
          >
            {etiqueta}
            {id === 'TODOS' && pendientes > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 text-xs font-bold ${filtroEstado === id ? 'bg-white/20 text-white' : 'bg-[#F39C12]/20 text-[#B7730A]'}`}>
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
            <p className="font-medium">{error}</p>
            <button onClick={cargar} className="mt-2 font-semibold underline">Reintentar</button>
          </div>
        ) : cargando ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
            No hay tickets con estos filtros.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {tickets.map((t) => (
              <TarjetaPqrsd
                key={t.id}
                ticket={t}
                procesando={procesandoId === t.id}
                onResponder={handleResponder}
                onCerrar={handleCerrar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
