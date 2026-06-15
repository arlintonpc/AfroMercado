'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { ComprobanteModal } from '@/components/admin/ComprobanteModal'
import {
  obtenerEstadisticas,
  obtenerPagosPendientes,
  verificarPago,
  type AdminEstadisticas,
  type PagoPendiente,
} from '@/components/admin/api'
import WhatsAppPanel from '@/components/admin/WhatsAppPanel'
import EmailPanel from '@/components/admin/EmailPanel'

// ——————————————————————————————————————————————————————————————
// Utilidades
// ——————————————————————————————————————————————————————————————

function formatearFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Aviso {
  tipo: 'exito' | 'error'
  texto: string
}

// ——————————————————————————————————————————————————————————————
// Metric card
// ——————————————————————————————————————————————————————————————

interface MetricCardProps {
  etiqueta: string
  valor: string
  destacado?: boolean
}

function MetricCard({ etiqueta, valor, destacado = false }: MetricCardProps) {
  return (
    <div
      className={[
        'rounded-2xl border bg-white p-5 shadow-sm transition-colors',
        destacado
          ? 'border-[#D4A017] bg-[#D4A017]/5'
          : 'border-[#1A1A1A]/5',
      ].join(' ')}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/50">
        {etiqueta}
      </p>
      <p
        className={[
          'mt-2 text-3xl font-bold leading-none',
          destacado ? 'text-[#D4A017]' : 'text-[#2D6A4F]',
        ].join(' ')}
      >
        {valor}
      </p>
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 shadow-sm">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-20" />
    </div>
  )
}

// ——————————————————————————————————————————————————————————————
// Fila de pago
// ——————————————————————————————————————————————————————————————

interface FilaPagoProps {
  pago: PagoPendiente
  procesando: boolean
  onVerComprobante: (pago: PagoPendiente) => void
  onAprobar: (pago: PagoPendiente) => void
  onRechazar: (pago: PagoPendiente) => void
}

function FilaPago({
  pago,
  procesando,
  onVerComprobante,
  onAprobar,
  onRechazar,
}: FilaPagoProps) {
  const { comprador } = pago.pedido
  return (
    <tr className="border-b border-[#1A1A1A]/5 last:border-0 hover:bg-[#F8F5F0]/60">
      <td className="px-4 py-4 align-top">
        <span className="font-semibold text-[#1A1A1A]">
          #{pago.pedido.id}
        </span>
        <div className="mt-1 text-xs text-[#1A1A1A]/50">
          {formatearFecha(pago.createdAt)}
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="font-medium text-[#1A1A1A]">{comprador.nombre}</div>
        {comprador.telefono && (
          <div className="text-sm text-[#1A1A1A]/60">{comprador.telefono}</div>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <Badge variant="gris">{pago.metodo}</Badge>
      </td>
      <td className="px-4 py-4 align-top font-semibold text-[#2D6A4F]">
        {formatearPrecio(pago.monto)}
      </td>
      <td className="px-4 py-4 align-top text-sm text-[#1A1A1A]/70">
        {pago.referencia || <span className="text-[#1A1A1A]/30">—</span>}
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onVerComprobante(pago)}
            disabled={procesando}
          >
            Ver comprobante
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onAprobar(pago)}
            loading={procesando}
            disabled={procesando}
          >
            Aprobar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onRechazar(pago)}
            disabled={procesando}
          >
            Rechazar
          </Button>
        </div>
      </td>
    </tr>
  )
}

function FilasPagoSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="border-b border-[#1A1A1A]/5 last:border-0">
          {Array.from({ length: 6 }).map((__, j) => (
            <td key={j} className="px-4 py-4">
              <Skeleton className="h-5 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ——————————————————————————————————————————————————————————————
// Página
// ——————————————————————————————————————————————————————————————

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminEstadisticas | null>(null)
  const [pagos, setPagos] = useState<PagoPendiente[]>([])
  const [cargandoStats, setCargandoStats] = useState(true)
  const [cargandoPagos, setCargandoPagos] = useState(true)
  const [errorStats, setErrorStats] = useState<string | null>(null)
  const [errorPagos, setErrorPagos] = useState<string | null>(null)

  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [comprobante, setComprobante] = useState<PagoPendiente | null>(null)

  const cargarStats = useCallback(async () => {
    setCargandoStats(true)
    setErrorStats(null)
    try {
      setStats(await obtenerEstadisticas())
    } catch (err) {
      setErrorStats(
        err instanceof Error ? err.message : 'No se pudieron cargar las estadísticas.',
      )
    } finally {
      setCargandoStats(false)
    }
  }, [])

  const cargarPagos = useCallback(async () => {
    setCargandoPagos(true)
    setErrorPagos(null)
    try {
      setPagos(await obtenerPagosPendientes())
    } catch (err) {
      setErrorPagos(
        err instanceof Error ? err.message : 'No se pudieron cargar los pagos.',
      )
    } finally {
      setCargandoPagos(false)
    }
  }, [])

  useEffect(() => {
    cargarStats()
    cargarPagos()
  }, [cargarStats, cargarPagos])

  // Oculta el aviso automáticamente tras unos segundos.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  async function ejecutarVerificacion(
    pago: PagoPendiente,
    accion: 'APROBAR' | 'RECHAZAR',
    notas?: string,
  ) {
    setProcesandoId(pago.id)
    setAviso(null)
    try {
      await verificarPago(pago.id, accion, notas)
      setAviso({
        tipo: 'exito',
        texto:
          accion === 'APROBAR'
            ? `Pago del pedido #${pago.pedido.id} aprobado.`
            : `Pago del pedido #${pago.pedido.id} rechazado.`,
      })
      // Refrescamos lista y estadísticas tras la acción.
      await Promise.all([cargarPagos(), cargarStats()])
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto:
          err instanceof Error
            ? err.message
            : 'No se pudo procesar la verificación.',
      })
    } finally {
      setProcesandoId(null)
    }
  }

  function manejarAprobar(pago: PagoPendiente) {
    const ok = window.confirm(
      `¿Aprobar el pago de ${formatearPrecio(pago.monto)} del pedido #${pago.pedido.id}?`,
    )
    if (!ok) return
    void ejecutarVerificacion(pago, 'APROBAR')
  }

  function manejarRechazar(pago: PagoPendiente) {
    const notas = window.prompt(
      `Vas a rechazar el pago del pedido #${pago.pedido.id}.\nMotivo (opcional):`,
      '',
    )
    // prompt devuelve null si el usuario cancela.
    if (notas === null) return
    void ejecutarVerificacion(pago, 'RECHAZAR', notas.trim() || undefined)
  }

  const sinPagos = !cargandoPagos && !errorPagos && pagos.length === 0

  // Tarjetas derivadas de stats (orden fijo).
  const tarjetas = stats
    ? [
        { etiqueta: 'Pedidos totales', valor: String(stats.totalPedidos) },
        {
          etiqueta: 'Pendientes de pago',
          valor: String(stats.pedidosPendientesPago),
        },
        {
          etiqueta: 'Pagos por verificar',
          valor: String(stats.pagosPorVerificar),
          destacado: stats.pagosPorVerificar > 0,
        },
        { etiqueta: 'Comercios', valor: String(stats.totalComercios) },
        { etiqueta: 'Productos', valor: String(stats.totalProductos) },
        {
          etiqueta: 'Ventas confirmadas',
          valor: formatearPrecio(stats.ventasConfirmadas),
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-8">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Resumen
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Métricas generales y pagos pendientes de verificación.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            cargarStats()
            cargarPagos()
          }}
          disabled={cargandoStats || cargandoPagos}
        >
          Actualizar
        </Button>
      </div>

      {/* Aviso */}
      {aviso && (
        <div
          role="status"
          className={[
            'rounded-xl border px-4 py-3 text-sm font-medium',
            aviso.tipo === 'exito'
              ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]'
              : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
          ].join(' ')}
        >
          {aviso.texto}
        </div>
      )}

      {/* Métricas */}
      <section>
        {errorStats ? (
          <div className="rounded-xl border border-[#C0392B]/30 bg-[#C0392B]/5 px-4 py-4 text-sm text-[#C0392B]">
            <p className="font-medium">{errorStats}</p>
            <button
              type="button"
              onClick={cargarStats}
              className="mt-2 font-semibold underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {cargandoStats || !stats
              ? Array.from({ length: 6 }).map((_, i) => (
                  <MetricCardSkeleton key={i} />
                ))
              : tarjetas.map((t) => (
                  <MetricCard
                    key={t.etiqueta}
                    etiqueta={t.etiqueta}
                    valor={t.valor}
                    destacado={t.destacado}
                  />
                ))}
          </div>
        )}
      </section>

      {/* Pagos por verificar */}
      <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">
            Pagos por verificar
          </h2>
          {!cargandoPagos && !errorPagos && pagos.length > 0 && (
            <Badge variant="dorado">{pagos.length}</Badge>
          )}
        </div>

        {errorPagos ? (
          <div className="px-5 py-6 text-sm text-[#C0392B]">
            <p className="font-medium">{errorPagos}</p>
            <button
              type="button"
              onClick={cargarPagos}
              className="mt-2 font-semibold underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        ) : sinPagos ? (
          <EmptyState
            titulo="No hay pagos por verificar 🎉"
            descripcion="Cuando un comprador suba un comprobante, aparecerá aquí para que lo revises."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                  <th className="px-4 py-3 font-semibold">Pedido</th>
                  <th className="px-4 py-3 font-semibold">Comprador</th>
                  <th className="px-4 py-3 font-semibold">Método</th>
                  <th className="px-4 py-3 font-semibold">Monto</th>
                  <th className="px-4 py-3 font-semibold">Referencia</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargandoPagos ? (
                  <FilasPagoSkeleton />
                ) : (
                  pagos.map((pago) => (
                    <FilaPago
                      key={pago.id}
                      pago={pago}
                      procesando={procesandoId === pago.id}
                      onVerComprobante={setComprobante}
                      onAprobar={manejarAprobar}
                      onRechazar={manejarRechazar}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal del comprobante */}
      {comprobante && (
        <ComprobanteModal
          pagoId={comprobante.id}
          titulo={`Pedido #${comprobante.pedido.id}`}
          onCerrar={() => setComprobante(null)}
        />
      )}

      {/* Canales de notificación */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Canales de notificación</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WhatsAppPanel />
          <EmailPanel />
        </div>
      </section>
    </div>
  )
}
