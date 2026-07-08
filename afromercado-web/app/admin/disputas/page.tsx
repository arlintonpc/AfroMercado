'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  disputasAdmin,
  resolverDisputaAdmin,
  marcarDisputaTransferida,
  type Disputa,
  type EstadoDisputa,
  type ModuloOrigenDisputa,
  type MotivoDisputa,
} from '@/lib/api/disputas'
import { formatearPrecio } from '@/lib/formatearPrecio'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

const VENTANA_RESPUESTA_HORAS = 48
const ESTADOS_RESOLVIBLES: EstadoDisputa[] = ['ABIERTA', 'RESPONDIDA_COMERCIO']

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

const ESTADO_LABEL: Record<EstadoDisputa, string> = {
  ABIERTA: 'Abierta',
  RESPONDIDA_COMERCIO: 'Respondida por el comercio',
  RESUELTA_RECHAZADA: 'Rechazada',
  RESUELTA_REEMBOLSO_TOTAL: 'Reembolso total',
  RESUELTA_REEMBOLSO_PARCIAL: 'Reembolso parcial',
  CERRADA_SIN_RESPUESTA: 'Cerrada sin respuesta',
}

const ESTADO_COLOR: Record<EstadoDisputa, string> = {
  ABIERTA: 'bg-[#F39C12]/15 text-[#B7730A]',
  RESPONDIDA_COMERCIO: 'bg-blue-100 text-blue-700',
  RESUELTA_RECHAZADA: 'bg-red-100 text-red-700',
  RESUELTA_REEMBOLSO_TOTAL: 'bg-[#52B788]/15 text-[#2D6A4F]',
  RESUELTA_REEMBOLSO_PARCIAL: 'bg-[#52B788]/15 text-[#2D6A4F]',
  CERRADA_SIN_RESPUESTA: 'bg-gray-100 text-gray-600',
}

const FILTROS_ESTADO: { id: EstadoDisputa | 'TODOS'; etiqueta: string }[] = [
  { id: 'TODOS', etiqueta: 'Todos' },
  { id: 'ABIERTA', etiqueta: 'Abiertas' },
  { id: 'RESPONDIDA_COMERCIO', etiqueta: 'Respondidas' },
  { id: 'RESUELTA_REEMBOLSO_TOTAL', etiqueta: 'Reembolso total' },
  { id: 'RESUELTA_REEMBOLSO_PARCIAL', etiqueta: 'Reembolso parcial' },
  { id: 'RESUELTA_RECHAZADA', etiqueta: 'Rechazadas' },
  { id: 'CERRADA_SIN_RESPUESTA', etiqueta: 'Cerradas sin respuesta' },
]

const FILTROS_MODULO: { id: ModuloOrigenDisputa | 'TODOS'; etiqueta: string }[] = [
  { id: 'TODOS', etiqueta: 'Todos los módulos' },
  { id: 'PEDIDO', etiqueta: 'Pedido' },
  { id: 'EXPRESS', etiqueta: 'Express' },
  { id: 'HOTEL', etiqueta: 'Hotel' },
  { id: 'TOUR', etiqueta: 'Tour' },
  { id: 'TRANSPORTE', etiqueta: 'Transporte' },
]

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function horasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function comercioNoRespondioVencido(disputa: Disputa): boolean {
  return disputa.estado === 'ABIERTA' && horasDesde(disputa.createdAt) >= VENTANA_RESPUESTA_HORAS
}

// ── Galería de evidencia ────────────────────────────────────────

function GaleriaEvidencia({ titulo, urls }: { titulo: string; urls: string[] }) {
  if (!urls || urls.length === 0) return null
  return (
    <div className="mt-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">{titulo}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- evidencia externa (Cloudinary), no un asset local optimizable */}
            <img src={url} alt={`${titulo} ${i + 1}`} className="h-16 w-16 rounded-lg border border-[#1A1A1A]/10 object-cover" />
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Modal de reembolso parcial ───────────────────────────────────

function ModalReembolsoParcial({
  disputa,
  onConfirmar,
  onCerrar,
}: {
  disputa: Disputa
  onConfirmar: (monto: number) => void
  onCerrar: () => void
}) {
  const bruto = Number(disputa.montoOriginal)
  const [monto, setMonto] = useState(
    disputa.montoReembolsoSolicitado != null ? String(Number(disputa.montoReembolsoSolicitado)) : ''
  )
  const valor = parseFloat(monto)
  const esValido = Number.isFinite(valor) && valor > 0 && valor <= bruto

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#1A1A1A]">Aprobar reembolso parcial</h2>
        <p className="mt-1 text-sm text-[#1A1A1A]/55">Monto original de la compra: {formatearPrecio(bruto)}</p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[#1A1A1A]/70">Monto a reembolsar</label>
          <input
            type="number"
            min={1}
            max={bruto}
            step={100}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
            placeholder="Ej: 15000"
          />
          {!esValido && monto !== '' && (
            <p className="mt-1 text-xs text-[#C0392B]">El monto debe ser mayor a 0 y no superar {formatearPrecio(bruto)}.</p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]">
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(valor)}
            disabled={!esValido}
            className="rounded-lg bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235540] disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de disputa ────────────────────────────────────────────

function TarjetaDisputaAdmin({
  disputa,
  procesando,
  onResolver,
  onMarcarTransferido,
}: {
  disputa: Disputa
  procesando: boolean
  onResolver: (disputa: Disputa, accion: 'RECHAZAR' | 'APROBAR_TOTAL' | 'APROBAR_PARCIAL', montoReembolsoAprobado?: number) => void
  onMarcarTransferido: (disputa: Disputa) => void
}) {
  const [mostrarModalParcial, setMostrarModalParcial] = useState(false)
  const esResolvible = ESTADOS_RESOLVIBLES.includes(disputa.estado)
  const vencidaSinRespuesta = comercioNoRespondioVencido(disputa)
  const montoAprobado = disputa.montoReembolsoAprobado != null ? Number(disputa.montoReembolsoAprobado) : null
  const esReembolsoAprobado = disputa.estado === 'RESUELTA_REEMBOLSO_TOTAL' || disputa.estado === 'RESUELTA_REEMBOLSO_PARCIAL'
  const necesitaTransferencia = esReembolsoAprobado && !disputa.reembolsoTransferidoAt

  return (
    <div className={`rounded-2xl border p-5 ${
      esResolvible ? 'border-[#D4A017]/25 bg-[#D4A017]/8' : 'border-[#1A1A1A]/8 bg-white'
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[#1A1A1A]">
            {MODULO_LABEL[disputa.moduloOrigen] ?? disputa.moduloOrigen} · #{disputa.referenciaId}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1A1A1A]/45">
            {disputa.comercio?.nombre ?? 'Comercio'} · comprador {disputa.comprador?.nombre ?? '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1A1A1A]/45">Reportado {fechaCorta(disputa.createdAt)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ESTADO_COLOR[disputa.estado]}`}>
          {ESTADO_LABEL[disputa.estado]}
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-[#1A1A1A]/8 bg-white px-3 py-2">
        <p className="text-sm font-semibold text-[#1A1A1A]">{MOTIVO_LABEL[disputa.motivo] ?? disputa.motivo}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-[#1A1A1A]/70">{disputa.descripcion}</p>
        <GaleriaEvidencia titulo="Evidencia del comprador" urls={disputa.evidenciaUrls} />
        <p className="mt-2 text-xs font-medium text-[#1A1A1A]/55">
          Monto original: {formatearPrecio(Number(disputa.montoOriginal))}
          {disputa.montoReembolsoSolicitado != null && (
            <> · Reembolso solicitado: {formatearPrecio(Number(disputa.montoReembolsoSolicitado))}</>
          )}
        </p>
      </div>

      {vencidaSinRespuesta ? (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          Comercio no respondió (ya pasaron {VENTANA_RESPUESTA_HORAS}h desde el reporte)
        </div>
      ) : disputa.respuestaComercio ? (
        <div className="mt-3 rounded-lg border border-[#1A1A1A]/8 bg-white px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">Respuesta del comercio</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#1A1A1A]/70">{disputa.respuestaComercio}</p>
          <GaleriaEvidencia titulo="Evidencia del comercio" urls={disputa.respuestaComercioUrls} />
        </div>
      ) : null}

      {disputa.resolucion && (
        <div className="mt-3 rounded-lg border border-[#1A1A1A]/8 bg-white px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">Resolución</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#1A1A1A]/70">{disputa.resolucion}</p>
          {montoAprobado != null && (
            <p className="mt-1 text-sm font-bold text-[#2D6A4F]">Aprobado: {formatearPrecio(montoAprobado)}</p>
          )}
        </div>
      )}

      {necesitaTransferencia && (
        <div className="mt-3 rounded-lg border border-[#D4A017]/30 bg-[#D4A017]/10 px-3 py-2.5 text-xs text-[#9B7300]">
          <p className="leading-relaxed">
            Este monto se descuenta de la próxima liquidación del comercio. La devolución al comprador es manual — transfiere
            por fuera de la plataforma y márcala aquí como transferida.
          </p>
          <button
            onClick={() => onMarcarTransferido(disputa)}
            disabled={procesando}
            className="mt-2 rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50"
          >
            Marcar reembolso como transferido
          </button>
        </div>
      )}

      {esResolvible && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onResolver(disputa, 'RECHAZAR')}
            disabled={procesando}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Rechazar
          </button>
          <button
            onClick={() => onResolver(disputa, 'APROBAR_TOTAL')}
            disabled={procesando}
            className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50"
          >
            Aprobar reembolso total
          </button>
          <button
            onClick={() => setMostrarModalParcial(true)}
            disabled={procesando}
            className="rounded-lg border border-[#2D6A4F]/30 bg-[#52B788]/8 px-3 py-1.5 text-xs font-bold text-[#2D6A4F] hover:bg-[#52B788]/15 disabled:opacity-50"
          >
            Aprobar reembolso parcial
          </button>
        </div>
      )}

      {mostrarModalParcial && (
        <ModalReembolsoParcial
          disputa={disputa}
          onCerrar={() => setMostrarModalParcial(false)}
          onConfirmar={(monto) => {
            setMostrarModalParcial(false)
            onResolver(disputa, 'APROBAR_PARCIAL', monto)
          }}
        />
      )}
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────

export default function AdminDisputasPage() {
  const [disputas, setDisputas] = useState<Disputa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoDisputa | 'TODOS'>('TODOS')
  const [filtroModulo, setFiltroModulo] = useState<ModuloOrigenDisputa | 'TODOS'>('TODOS')
  const [confirmacionPendiente, setConfirmacionPendiente] = useState<{
    disputa: Disputa
    accion: 'RECHAZAR' | 'APROBAR_TOTAL'
  } | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)
    disputasAdmin({
      estado: filtroEstado === 'TODOS' ? undefined : filtroEstado,
      moduloOrigen: filtroModulo === 'TODOS' ? undefined : filtroModulo,
    })
      .then(setDisputas)
      .catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar los reclamos.'))
      .finally(() => setCargando(false))
  }, [filtroEstado, filtroModulo])

  useEffect(() => { cargar() }, [cargar])

  function handleResolver(disputa: Disputa, accion: 'RECHAZAR' | 'APROBAR_TOTAL' | 'APROBAR_PARCIAL', montoReembolsoAprobado?: number) {
    if (accion === 'RECHAZAR' || accion === 'APROBAR_TOTAL') {
      setConfirmacionPendiente({ disputa, accion })
      return
    }
    void ejecutarResolver(disputa, accion, montoReembolsoAprobado)
  }

  async function ejecutarResolver(disputa: Disputa, accion: 'RECHAZAR' | 'APROBAR_TOTAL' | 'APROBAR_PARCIAL', montoReembolsoAprobado?: number) {
    setProcesandoId(disputa.id)
    try {
      const actualizada = await resolverDisputaAdmin(disputa.id, { accion, montoReembolsoAprobado })
      setDisputas((prev) => prev.map((d) => (d.id === actualizada.id ? actualizada : d)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo resolver el reclamo.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function confirmarResolver() {
    if (!confirmacionPendiente) return
    const { disputa, accion } = confirmacionPendiente
    setConfirmacionPendiente(null)
    await ejecutarResolver(disputa, accion)
  }

  async function handleMarcarTransferido(disputa: Disputa) {
    setProcesandoId(disputa.id)
    try {
      const actualizada = await marcarDisputaTransferida(disputa.id)
      setDisputas((prev) => prev.map((d) => (d.id === actualizada.id ? actualizada : d)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo marcar como transferido.')
    } finally {
      setProcesandoId(null)
    }
  }

  const pendientes = disputas.filter((d) => ESTADOS_RESOLVIBLES.includes(d.estado)).length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#1A1A1A]">Reclamos y disputas</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">
        Mediación entre comprador y comercio sobre compras ya entregadas o completadas.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTROS_ESTADO.map(({ id, etiqueta }) => (
          <button
            key={id}
            onClick={() => setFiltroEstado(id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              filtroEstado === id
                ? 'bg-[#2D6A4F] text-white'
                : 'border border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/65 hover:bg-[#F8F5F0]'
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FILTROS_MODULO.map(({ id, etiqueta }) => (
          <button
            key={id}
            onClick={() => setFiltroModulo(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              filtroModulo === id
                ? 'bg-[#D4A017] text-[#1A1A1A]'
                : 'border border-[#1A1A1A]/10 bg-[#F8F5F0] text-[#1A1A1A]/55 hover:bg-white'
            }`}
          >
            {etiqueta}
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
        ) : disputas.length === 0 ? (
          <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
            No hay reclamos con estos filtros.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {disputas.map((d) => (
              <TarjetaDisputaAdmin
                key={d.id}
                disputa={d}
                procesando={procesandoId === d.id}
                onResolver={handleResolver}
                onMarcarTransferido={handleMarcarTransferido}
              />
            ))}
          </div>
        )}
      </div>

      {confirmacionPendiente && (
        <ModalConfirmacion
          titulo={confirmacionPendiente.accion === 'RECHAZAR' ? 'Rechazar reclamo' : 'Aprobar reembolso'}
          mensaje={
            confirmacionPendiente.accion === 'RECHAZAR'
              ? '¿Rechazar este reclamo?'
              : '¿Aprobar el reembolso total de este reclamo?'
          }
          onCancelar={() => setConfirmacionPendiente(null)}
          onConfirmar={() => void confirmarResolver()}
          confirmando={procesandoId === confirmacionPendiente.disputa.id}
          destructivo={confirmacionPendiente.accion === 'RECHAZAR'}
        />
      )}
    </div>
  )
}
