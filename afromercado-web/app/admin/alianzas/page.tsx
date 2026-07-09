'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  adminListarAlianzas,
  adminAprobarAlianza,
  adminRechazarAlianza,
  adminDespublicarAlianza,
  type AlianzaComercial,
  type EstadoAlianza,
  type ModuloAlianza,
} from '@/lib/api/alianza'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

const ESTADO_LABEL: Record<EstadoAlianza, string> = {
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  PUBLICADA: 'Publicada',
  RECHAZADA: 'Rechazada',
  DESPUBLICADA: 'Despublicada',
}

const ESTADO_COLOR: Record<EstadoAlianza, string> = {
  PENDIENTE_APROBACION: 'bg-[#F39C12]/15 text-[#B7730A]',
  PUBLICADA: 'bg-[#52B788]/15 text-[#2D6A4F]',
  RECHAZADA: 'bg-red-100 text-red-700',
  DESPUBLICADA: 'bg-gray-100 text-gray-600',
}

const MODULO_LABEL: Record<ModuloAlianza, string> = {
  PEDIDO: 'Pedido',
  EXPRESS: 'Express',
  HOTEL: 'Hotel',
  TOUR: 'Tour',
  TRANSPORTE: 'Transporte',
}

const FILTROS_ESTADO: { id: EstadoAlianza | 'TODOS'; etiqueta: string }[] = [
  { id: 'TODOS', etiqueta: 'Todas' },
  { id: 'PENDIENTE_APROBACION', etiqueta: 'Pendientes' },
  { id: 'PUBLICADA', etiqueta: 'Publicadas' },
  { id: 'RECHAZADA', etiqueta: 'Rechazadas' },
  { id: 'DESPUBLICADA', etiqueta: 'Despublicadas' },
]

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatearDescuento(tipoDescuento: string, valorDescuento: string | number): string {
  const valor = Number(valorDescuento)
  return tipoDescuento === 'PORCENTAJE' ? `${valor}%` : `$${valor.toLocaleString('es-CO')}`
}

// ── Modal de motivo de rechazo ──────────────────────────────────

function ModalMotivoRechazo({
  onConfirmar,
  onCerrar,
  procesando,
}: {
  onConfirmar: (motivo: string) => void
  onCerrar: () => void
  procesando: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const esValido = motivo.trim().length > 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#1A1A1A]">Rechazar alianza</h2>
        <p className="mt-1 text-sm text-[#1A1A1A]/55">Indica el motivo del rechazo (obligatorio).</p>

        <div className="mt-4">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
            placeholder="Ej: la región indicada no coincide con la de los comercios socios"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCerrar}
            disabled={procesando}
            className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(motivo.trim())}
            disabled={!esValido || procesando}
            className="rounded-lg bg-[#C0392B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a5301f] disabled:opacity-50"
          >
            {procesando ? 'Procesando…' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Tarjeta de alianza ───────────────────────────────────────────

function TarjetaAlianzaAdmin({
  alianza,
  procesando,
  onAprobar,
  onRechazar,
  onDespublicar,
}: {
  alianza: AlianzaComercial
  procesando: boolean
  onAprobar: (alianza: AlianzaComercial) => void
  onRechazar: (alianza: AlianzaComercial) => void
  onDespublicar: (alianza: AlianzaComercial) => void
}) {
  const region = [alianza.municipio, alianza.departamento].filter(Boolean).join(', ') || 'Sin región indicada'
  const sociosAceptados = alianza.socios.filter((s) => s.aceptado).length

  return (
    <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[#1A1A1A]">{alianza.nombre}</p>
          <p className="mt-0.5 text-[11px] text-[#1A1A1A]/45">
            Código <span className="font-mono font-semibold text-[#1A1A1A]/70">{alianza.codigoCompartido}</span> · {region}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1A1A1A]/45">
            Creada {fechaCorta(alianza.createdAt)} · Vigencia {fechaCorta(alianza.inicio)} – {fechaCorta(alianza.fin)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ESTADO_COLOR[alianza.estado]}`}>
          {ESTADO_LABEL[alianza.estado]}
        </span>
      </div>

      {alianza.descripcion && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-[#1A1A1A]/70">{alianza.descripcion}</p>
      )}

      {alianza.motivoRechazo && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="font-bold">Motivo del rechazo: </span>
          {alianza.motivoRechazo}
        </div>
      )}

      <div className="mt-3 rounded-lg border border-[#1A1A1A]/8 bg-[#F8F5F0] px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">
          Comercios socios ({sociosAceptados}/{alianza.socios.length} aceptaron)
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {alianza.socios.map((socio) => (
            <div key={socio.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-[#1A1A1A]/80">
                {socio.comercio.nombre}
                <span className="ml-1.5 text-xs text-[#1A1A1A]/45">
                  ({MODULO_LABEL[socio.modulo] ?? socio.modulo}
                  {socio.comercio.municipio ? ` · ${socio.comercio.municipio}` : ''})
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#2D6A4F]">
                  {formatearDescuento(socio.tipoDescuento, socio.valorDescuento)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    socio.aceptado ? 'bg-[#52B788]/15 text-[#2D6A4F]' : 'bg-[#F39C12]/15 text-[#B7730A]'
                  }`}
                >
                  {socio.aceptado ? 'Aceptó' : 'Invitado'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {alianza.estado === 'PENDIENTE_APROBACION' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onRechazar(alianza)}
            disabled={procesando}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Rechazar
          </button>
          <button
            onClick={() => onAprobar(alianza)}
            disabled={procesando || sociosAceptados < 2}
            title={sociosAceptados < 2 ? 'Necesita al menos 2 socios aceptados para poder publicarse' : undefined}
            className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50"
          >
            Aprobar y publicar
          </button>
        </div>
      )}

      {alianza.estado === 'PUBLICADA' && (
        <div className="mt-3">
          <button
            onClick={() => onDespublicar(alianza)}
            disabled={procesando}
            className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#1A1A1A]/70 hover:bg-[#F8F5F0] disabled:opacity-50"
          >
            Despublicar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────

export default function AdminAlianzasPage() {
  const [alianzas, setAlianzas] = useState<AlianzaComercial[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoAlianza | 'TODOS'>('TODOS')

  const [confirmacionPendiente, setConfirmacionPendiente] = useState<{
    alianza: AlianzaComercial
    accion: 'APROBAR' | 'DESPUBLICAR'
  } | null>(null)
  const [rechazoPendiente, setRechazoPendiente] = useState<AlianzaComercial | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)
    adminListarAlianzas(filtroEstado === 'TODOS' ? undefined : filtroEstado)
      .then(setAlianzas)
      .catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar las alianzas.'))
      .finally(() => setCargando(false))
  }, [filtroEstado])

  useEffect(() => { cargar() }, [cargar])

  async function confirmarAprobarODespublicar() {
    if (!confirmacionPendiente) return
    const { alianza, accion } = confirmacionPendiente
    setConfirmacionPendiente(null)
    setProcesandoId(alianza.id)
    try {
      const actualizada =
        accion === 'APROBAR' ? await adminAprobarAlianza(alianza.id) : await adminDespublicarAlianza(alianza.id)
      setAlianzas((prev) => prev.map((a) => (a.id === actualizada.id ? actualizada : a)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo completar la acción.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function confirmarRechazo(motivo: string) {
    if (!rechazoPendiente) return
    const alianza = rechazoPendiente
    setProcesandoId(alianza.id)
    try {
      const actualizada = await adminRechazarAlianza(alianza.id, motivo)
      setAlianzas((prev) => prev.map((a) => (a.id === actualizada.id ? actualizada : a)))
      setRechazoPendiente(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo rechazar la alianza.')
    } finally {
      setProcesandoId(null)
    }
  }

  const pendientes = alianzas.filter((a) => a.estado === 'PENDIENTE_APROBACION').length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#1A1A1A]">Alianzas comerciales</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">
        Cupones de descuento compartidos entre comercios de distintos módulos. Aprueba, rechaza o despublica.
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
        ) : alianzas.length === 0 ? (
          <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
            No hay alianzas con estos filtros.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {alianzas.map((a) => (
              <TarjetaAlianzaAdmin
                key={a.id}
                alianza={a}
                procesando={procesandoId === a.id}
                onAprobar={(alianza) => setConfirmacionPendiente({ alianza, accion: 'APROBAR' })}
                onRechazar={(alianza) => setRechazoPendiente(alianza)}
                onDespublicar={(alianza) => setConfirmacionPendiente({ alianza, accion: 'DESPUBLICAR' })}
              />
            ))}
          </div>
        )}
      </div>

      {confirmacionPendiente && (
        <ModalConfirmacion
          titulo={confirmacionPendiente.accion === 'APROBAR' ? 'Aprobar y publicar alianza' : 'Despublicar alianza'}
          mensaje={
            confirmacionPendiente.accion === 'APROBAR'
              ? `¿Aprobar y publicar "${confirmacionPendiente.alianza.nombre}"? El código quedará activo para checkout.`
              : `¿Despublicar "${confirmacionPendiente.alianza.nombre}"? El código dejará de aplicar descuentos.`
          }
          onCancelar={() => setConfirmacionPendiente(null)}
          onConfirmar={() => void confirmarAprobarODespublicar()}
          confirmando={procesandoId === confirmacionPendiente.alianza.id}
          destructivo={confirmacionPendiente.accion === 'DESPUBLICAR'}
          textoConfirmar={confirmacionPendiente.accion === 'APROBAR' ? 'Aprobar y publicar' : 'Despublicar'}
        />
      )}

      {rechazoPendiente && (
        <ModalMotivoRechazo
          onCerrar={() => setRechazoPendiente(null)}
          onConfirmar={(motivo) => void confirmarRechazo(motivo)}
          procesando={procesandoId === rechazoPendiente.id}
        />
      )}
    </div>
  )
}
