'use client'

import { useEffect, useState } from 'react'
import {
  disputasComercio,
  responderDisputaComercio,
  type Disputa,
  type EstadoDisputa,
  type ModuloOrigenDisputa,
  type MotivoDisputa,
} from '@/lib/api/disputas'
import { formatearPrecio } from '@/lib/formatearPrecio'

const VENTANA_RESPUESTA_HORAS = 48

const MODULO_LABEL: Record<ModuloOrigenDisputa, string> = {
  PEDIDO: 'Pedido de tienda',
  EXPRESS: 'Pedido Express',
  HOTEL: 'Reserva de hotel',
  TOUR: 'Reserva de tour',
  TRANSPORTE: 'Reserva de transporte',
}

const MOTIVO_LABEL: Record<MotivoDisputa, string> = {
  PRODUCTO_NO_LLEGO: 'El producto no llegó',
  PRODUCTO_DEFECTUOSO_O_DANADO: 'Llegó defectuoso o dañado',
  PRODUCTO_INCOMPLETO: 'Llegó incompleto',
  PRODUCTO_DIFERENTE_AL_PEDIDO: 'Es diferente a lo pedido',
  CALIDAD_NO_CONFORME: 'Calidad no conforme',
  SERVICIO_NO_PRESTADO: 'Servicio no prestado',
  COBRO_INCORRECTO: 'Cobro incorrecto',
  OTRO: 'Otro motivo',
}

const ESTADO_INFO: Record<EstadoDisputa, { label: string; color: string }> = {
  ABIERTA: { label: 'Esperando tu respuesta', color: 'bg-amber-100 text-amber-700' },
  RESPONDIDA_COMERCIO: { label: 'Respondida, en revisión', color: 'bg-blue-100 text-blue-700' },
  RESUELTA_RECHAZADA: { label: 'Rechazada', color: 'bg-red-100 text-red-600' },
  RESUELTA_REEMBOLSO_TOTAL: { label: 'Reembolso total aprobado', color: 'bg-green-100 text-green-700' },
  RESUELTA_REEMBOLSO_PARCIAL: { label: 'Reembolso parcial aprobado', color: 'bg-green-100 text-green-700' },
  CERRADA_SIN_RESPUESTA: { label: 'Cerrada sin respuesta', color: 'bg-gray-100 text-gray-600' },
}

function fechaLegible(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Cuenta regresiva de las 48h desde createdAt. Recalcula en cliente sin depender del backend. */
function TiempoRestante({ createdAt }: { createdAt: string }) {
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const limite = new Date(createdAt).getTime() + VENTANA_RESPUESTA_HORAS * 3600_000
  const restanteMs = limite - ahora

  if (restanteMs <= 0) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
        Tiempo de respuesta vencido
      </span>
    )
  }

  const horas = Math.floor(restanteMs / 3600_000)
  const minutos = Math.floor((restanteMs % 3600_000) / 60_000)

  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#D4A017]/15 text-[#9B7300]">
      Quedan {horas}h {minutos}min para responder
    </span>
  )
}

function EvidenciaGaleria({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- evidencia externa (Cloudinary), no un asset local optimizable */}
          <img src={url} alt={`Evidencia ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border border-[#1A1A1A]/10" />
        </a>
      ))}
    </div>
  )
}

function TarjetaDisputaComercio({ disputa, onRespondida }: { disputa: Disputa; onRespondida: (d: Disputa) => void }) {
  const info = ESTADO_INFO[disputa.estado] ?? { label: disputa.estado, color: 'bg-gray-100 text-gray-600' }
  const esAbierta = disputa.estado === 'ABIERTA'
  const tieneResolucion = disputa.estado.startsWith('RESUELTA_')
  const montoAprobado = disputa.montoReembolsoAprobado != null ? Number(disputa.montoReembolsoAprobado) : null

  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviarRespuesta() {
    if (!respuesta.trim()) { setError('Escribe tu respuesta antes de enviarla.'); return }
    setEnviando(true)
    setError(null)
    try {
      const actualizada = await responderDisputaComercio(disputa.id, { respuesta: respuesta.trim() })
      onRespondida(actualizada)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la respuesta.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/40">
            {MODULO_LABEL[disputa.moduloOrigen] ?? disputa.moduloOrigen} · #{disputa.referenciaId}
          </p>
          <p className="mt-0.5 text-sm text-[#1A1A1A]/55">
            {disputa.comprador?.nombre ?? 'Comprador'} · {fechaLegible(disputa.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${info.color}`}>{info.label}</span>
          {esAbierta && <TiempoRestante createdAt={disputa.createdAt} />}
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold text-[#1A1A1A]">{MOTIVO_LABEL[disputa.motivo] ?? disputa.motivo}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[#1A1A1A]/65">{disputa.descripcion}</p>
      <EvidenciaGaleria urls={disputa.evidenciaUrls} />

      {disputa.montoReembolsoSolicitado != null && (
        <p className="mt-2 text-sm font-medium text-[#1A1A1A]/70">
          Reembolso solicitado por el comprador: {formatearPrecio(Number(disputa.montoReembolsoSolicitado))}
        </p>
      )}

      {esAbierta ? (
        <div className="mt-4 border-t border-[#1A1A1A]/8 pt-4">
          <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]/70">Tu respuesta</label>
          <textarea
            rows={3}
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder="Explica tu versión de lo ocurrido"
            className="w-full resize-none rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          />
          {error && <p className="mt-2 text-xs text-[#C0392B]">{error}</p>}
          <button
            type="button"
            onClick={enviarRespuesta}
            disabled={enviando}
            className="mt-3 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#245a42] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Enviar respuesta'}
          </button>
        </div>
      ) : (
        <>
          {disputa.respuestaComercio && (
            <div className="mt-4 rounded-xl border border-[#1A1A1A]/8 bg-[#F8F5F0] px-3 py-2.5">
              <p className="mb-1 text-xs font-semibold text-[#1A1A1A]/50">Tu respuesta</p>
              <p className="whitespace-pre-wrap text-sm text-[#1A1A1A]/70">{disputa.respuestaComercio}</p>
            </div>
          )}
          {tieneResolucion && (
            <div className={`mt-3 rounded-xl border px-3 py-2.5 ${
              disputa.estado === 'RESUELTA_RECHAZADA' ? 'border-red-100 bg-red-50' : 'border-[#52B788]/25 bg-[#52B788]/10'
            }`}>
              <p className={`mb-1 text-xs font-semibold ${disputa.estado === 'RESUELTA_RECHAZADA' ? 'text-red-700' : 'text-[#2D6A4F]'}`}>
                Resolución del administrador
              </p>
              {disputa.resolucion && <p className="mb-1 whitespace-pre-wrap text-sm text-[#1A1A1A]/70">{disputa.resolucion}</p>}
              {montoAprobado != null && (
                <p className="text-sm font-bold text-[#2D6A4F]">
                  Reembolso aprobado: {formatearPrecio(montoAprobado)}
                  {disputa.montoDescuentoComercio != null && (
                    <span className="ml-1 font-normal text-[#1A1A1A]/55">
                      (se descuentan {formatearPrecio(Number(disputa.montoDescuentoComercio))} de tu próxima liquidación)
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ComercianteDisputasPage() {
  const [disputas, setDisputas] = useState<Disputa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    disputasComercio()
      .then((data) => { if (!cancelado) setDisputas(data) })
      .catch((e) => { if (!cancelado) setError(e instanceof Error ? e.message : 'No pudimos cargar los reclamos.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  function handleRespondida(actualizada: Disputa) {
    setDisputas((prev) => prev.map((d) => (d.id === actualizada.id ? actualizada : d)))
  }

  const abiertas = disputas.filter((d) => d.estado === 'ABIERTA')
  const resto = disputas.filter((d) => d.estado !== 'ABIERTA')

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A]">Reclamos de tu tienda</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">
        Tienes {VENTANA_RESPUESTA_HORAS} horas para responder cada reclamo abierto antes de que se cierre automáticamente.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-[#C0392B]/20 bg-[#C0392B]/5 px-4 py-3 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="mt-6 flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />
          ))}
        </div>
      ) : disputas.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[#1A1A1A]/8 bg-white p-8 text-center">
          <p className="text-sm text-[#1A1A1A]/55">No tienes reclamos registrados por ahora.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {abiertas.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#1A1A1A]/45">
                Pendientes de respuesta ({abiertas.length})
              </h2>
              <div className="flex flex-col gap-4">
                {abiertas.map((d) => <TarjetaDisputaComercio key={d.id} disputa={d} onRespondida={handleRespondida} />)}
              </div>
            </section>
          )}
          {resto.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#1A1A1A]/45">Historial</h2>
              <div className="flex flex-col gap-4">
                {resto.map((d) => <TarjetaDisputaComercio key={d.id} disputa={d} onRespondida={handleRespondida} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
