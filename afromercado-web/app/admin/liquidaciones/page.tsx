'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoLiq = 'COMERCIANTE' | 'REPARTIDOR'
type EstadoLiq = 'PENDIENTE' | 'PAGADA' | 'CANCELADA'

interface LiqBeneficiario {
  id: number
  nombre: string
  email: string
}

interface Liquidacion {
  id: number
  tipo: TipoLiq
  estado: EstadoLiq
  monto: string | number
  periodoDesde: string
  periodoHasta: string
  cuentaDestino?: string | null
  notas?: string | null
  pagadoAt?: string | null
  createdAt: string
  beneficiario: LiqBeneficiario
}

interface ResumenItem {
  usuario: { id: number; nombre: string; email: string }
  tipo: TipoLiq
  pendiente: number
}

interface Pagina {
  items: Liquidacion[]
  total: number
  paginas: number
  pagina: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fecha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function badgeEstado(estado: EstadoLiq) {
  if (estado === 'PAGADA') {
    return 'bg-[#52B788]/15 text-[#2D6A4F] border-[#52B788]/30'
  }
  if (estado === 'CANCELADA') {
    return 'bg-red-50 text-red-600 border-red-200'
  }
  return 'bg-[#D4A017]/15 text-[#9B7300] border-[#D4A017]/30'
}

// ─── Modal crear liquidación ───────────────────────────────────────────────────

interface ModalCrearProps {
  resumen: ResumenItem[]
  onCreada: () => void
  onCerrar: () => void
}

function ModalCrear({ resumen, onCreada, onCerrar }: ModalCrearProps) {
  const [beneficiarioId, setBeneficiarioId] = useState<string>('')
  const [tipo, setTipo] = useState<TipoLiq>('COMERCIANTE')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [notas, setNotas] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const opcionesTipo = resumen.filter((r) => r.tipo === tipo)

  async function crear() {
    if (!beneficiarioId || !desde || !hasta) {
      setError('Completa beneficiario, fecha de inicio y fin.')
      return
    }
    setCargando(true)
    setError(null)
    try {
      await apiFetch('/liquidaciones/admin/liquidaciones', {
        method: 'POST',
        body: {
          tipo,
          beneficiarioId: Number(beneficiarioId),
          periodoDesde: desde,
          periodoHasta: hasta,
          cuentaDestino: cuenta || undefined,
          notas: notas || undefined,
        },
      })
      onCreada()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Nueva liquidación</h2>

        <div className="flex gap-2 mb-4">
          {(['COMERCIANTE', 'REPARTIDOR'] as TipoLiq[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTipo(t); setBeneficiarioId('') }}
              className={[
                'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                tipo === t
                  ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white'
                  : 'border-[#1A1A1A]/15 text-[#1A1A1A]/60 hover:bg-[#F8F5F0]',
              ].join(' ')}
            >
              {t === 'COMERCIANTE' ? 'Comerciante' : 'Repartidor'}
            </button>
          ))}
        </div>

        <label className="mb-3 block text-sm font-medium text-[#1A1A1A]">
          Beneficiario
          <select
            value={beneficiarioId}
            onChange={(e) => setBeneficiarioId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
          >
            <option value="">Selecciona…</option>
            {opcionesTipo.map((r) => (
              <option key={r.usuario.id} value={r.usuario.id}>
                {r.usuario.nombre} — saldo {formatearPrecio(r.pendiente)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3 mb-3">
          <label className="flex-1 text-sm font-medium text-[#1A1A1A]">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1 text-sm font-medium text-[#1A1A1A]">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mb-3 block text-sm font-medium text-[#1A1A1A]">
          Cuenta destino (opcional)
          <input
            value={cuenta}
            onChange={(e) => setCuenta(e.target.value)}
            placeholder="Nequi, Bancolombia, etc."
            className="mt-1 w-full rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
          />
        </label>

        <label className="mb-4 block text-sm font-medium text-[#1A1A1A]">
          Notas (opcional)
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
          />
        </label>

        {error && (
          <p className="mb-3 text-sm text-[#C0392B]">{error}</p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onCerrar} disabled={cargando}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" className="flex-1" onClick={crear} loading={cargando} disabled={cargando}>
            Crear
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function AdminLiquidacionesPage() {
  const [resumen, setResumen] = useState<ResumenItem[]>([])
  const [pagina, setPagina] = useState<Pagina | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [filtroEstado, setFiltroEstado] = useState<EstadoLiq | ''>('')
  const [filtroTipo, setFiltroTipo] = useState<TipoLiq | ''>('')
  const [cargandoResumen, setCargandoResumen] = useState(true)
  const [cargandoTabla, setCargandoTabla] = useState(true)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [liquidacionACancelar, setLiquidacionACancelar] = useState<number | null>(null)

  const cargarResumen = useCallback(async () => {
    setCargandoResumen(true)
    try {
      const resp = await apiFetch<{ ok: boolean; data: ResumenItem[] }>(
        '/liquidaciones/admin/liquidaciones/resumen',
      )
      setResumen(resp.data ?? [])
    } catch {
      // silencioso
    } finally {
      setCargandoResumen(false)
    }
  }, [])

  const cargarTabla = useCallback(async () => {
    setCargandoTabla(true)
    const params = new URLSearchParams()
    params.set('pagina', String(paginaActual))
    if (filtroEstado) params.set('estado', filtroEstado)
    if (filtroTipo)   params.set('tipo',   filtroTipo)
    try {
      const resp = await apiFetch<{ ok: boolean; data: Pagina }>(
        `/liquidaciones/admin/liquidaciones?${params.toString()}`,
      )
      setPagina(resp.data)
    } catch {
      // silencioso
    } finally {
      setCargandoTabla(false)
    }
  }, [paginaActual, filtroEstado, filtroTipo])

  useEffect(() => { void cargarResumen() }, [cargarResumen])
  useEffect(() => { void cargarTabla() }, [cargarTabla])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  async function marcarPagada(id: number) {
    const comprobante = window.prompt('URL del comprobante de pago (opcional):')
    if (comprobante === null) return
    setProcesandoId(id)
    try {
      await apiFetch(`/liquidaciones/admin/liquidaciones/${id}/pagar`, {
        method: 'PATCH',
        body: { comprobante: comprobante?.trim() || undefined },
      })
      setAviso({ tipo: 'exito', texto: 'Liquidación marcada como pagada.' })
      await Promise.all([cargarResumen(), cargarTabla()])
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo actualizar.',
      })
    } finally {
      setProcesandoId(null)
    }
  }

  function cancelarLiquidacion(id: number) {
    setLiquidacionACancelar(id)
  }

  async function confirmarCancelarLiquidacion() {
    if (liquidacionACancelar == null) return
    const id = liquidacionACancelar
    setProcesandoId(id)
    try {
      await apiFetch(`/liquidaciones/admin/liquidaciones/${id}/cancelar`, {
        method: 'PATCH',
      })
      setAviso({ tipo: 'exito', texto: 'Liquidación cancelada; el saldo fue liberado.' })
      await Promise.all([cargarResumen(), cargarTabla()])
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo cancelar.',
      })
    } finally {
      setProcesandoId(null)
      setLiquidacionACancelar(null)
    }
  }

  const totalPendiente = resumen.reduce((s, r) => s + r.pendiente, 0)

  return (
    <div className="flex flex-col gap-8">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Liquidaciones
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Pagos pendientes a comerciantes y repartidores.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setMostrarModal(true)}>
          + Nueva liquidación
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

      {/* Resumen de saldos pendientes */}
      <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Saldos pendientes</h2>
          {!cargandoResumen && (
            <span className="text-sm font-bold text-[#D4A017]">
              Total: {formatearPrecio(totalPendiente)}
            </span>
          )}
        </div>
        {cargandoResumen ? (
          <div className="p-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#1A1A1A]/5 p-4">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : resumen.length === 0 ? (
          <EmptyState titulo="No hay saldos pendientes" descripcion="Todos los pagos están al día." />
        ) : (
          <div className="p-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resumen.map((r) => (
              <div
                key={`${r.tipo}-${r.usuario.id}`}
                className="rounded-xl border border-[#1A1A1A]/5 p-4"
              >
                <p className="text-sm font-medium text-[#1A1A1A]">{r.usuario.nombre}</p>
                <p className="text-xs text-[#1A1A1A]/50 mb-2">{r.tipo}</p>
                <p className="text-lg font-bold text-[#2D6A4F]">{formatearPrecio(r.pendiente)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value as EstadoLiq | ''); setPaginaActual(1) }}
          className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADA">Pagada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value as TipoLiq | ''); setPaginaActual(1) }}
          className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="COMERCIANTE">Comerciante</option>
          <option value="REPARTIDOR">Repartidor</option>
        </select>
      </div>

      {/* Tabla */}
      <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm">
        {cargandoTabla ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !pagina || pagina.items.length === 0 ? (
          <EmptyState titulo="Sin liquidaciones" descripcion="Crea la primera desde el botón de arriba." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Beneficiario</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Periodo</th>
                  <th className="px-4 py-3 font-semibold">Monto</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagina.items.map((liq) => (
                  <tr
                    key={liq.id}
                    className="border-b border-[#1A1A1A]/5 last:border-0 hover:bg-[#F8F5F0]/60"
                  >
                    <td className="px-4 py-4 font-medium text-[#1A1A1A]">#{liq.id}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#1A1A1A]">{liq.beneficiario.nombre}</div>
                      <div className="text-xs text-[#1A1A1A]/50">{liq.beneficiario.email}</div>
                    </td>
                    <td className="px-4 py-4 text-[#1A1A1A]/70">{liq.tipo}</td>
                    <td className="px-4 py-4 text-xs text-[#1A1A1A]/60">
                      {fecha(liq.periodoDesde)} – {fecha(liq.periodoHasta)}
                    </td>
                    <td className="px-4 py-4 font-semibold text-[#2D6A4F]">
                      {formatearPrecio(Number(liq.monto))}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={[
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                          badgeEstado(liq.estado),
                        ].join(' ')}
                      >
                        {liq.estado}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {liq.estado === 'PENDIENTE' && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => cancelarLiquidacion(liq.id)}
                            disabled={procesandoId !== null}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => marcarPagada(liq.id)}
                            loading={procesandoId === liq.id}
                            disabled={procesandoId !== null}
                          >
                            Marcar pagada
                          </Button>
                        </div>
                      )}
                      {liq.estado === 'PAGADA' && liq.pagadoAt && (
                        <span className="text-xs text-[#1A1A1A]/40">{fecha(liq.pagadoAt)}</span>
                      )}
                      {liq.estado === 'CANCELADA' && (
                        <span className="text-xs text-red-500">Cancelada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {pagina && pagina.paginas > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-[#1A1A1A]/5 px-5 py-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={paginaActual === 1}
              onClick={() => setPaginaActual((p) => p - 1)}
            >
              ← Anterior
            </Button>
            <span className="text-sm text-[#1A1A1A]/60">
              {paginaActual} / {pagina.paginas}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={paginaActual === pagina.paginas}
              onClick={() => setPaginaActual((p) => p + 1)}
            >
              Siguiente →
            </Button>
          </div>
        )}
      </section>

      {/* Modal */}
      {mostrarModal && (
        <ModalCrear
          resumen={resumen}
          onCreada={() => {
            setMostrarModal(false)
            setAviso({ tipo: 'exito', texto: 'Liquidación creada correctamente.' })
            void Promise.all([cargarResumen(), cargarTabla()])
          }}
          onCerrar={() => setMostrarModal(false)}
        />
      )}

      {liquidacionACancelar != null && (
        <ModalConfirmacion
          titulo="Cancelar liquidación"
          mensaje="¿Cancelar esta liquidación pendiente? El saldo volverá a estar disponible."
          onCancelar={() => setLiquidacionACancelar(null)}
          onConfirmar={() => void confirmarCancelarLiquidacion()}
          confirmando={procesandoId === liquidacionACancelar}
        />
      )}
    </div>
  )
}
