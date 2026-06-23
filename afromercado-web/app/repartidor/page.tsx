'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  misEntregas,
  entregasDisponibles,
  historialEntregas,
  tomarEntrega,
  actualizarEstadoEntrega,
  subirFotoEntrega,
  type EntregaDetalle,
} from '@/lib/api/repartidor'
import { formatearPrecio } from '@/lib/formatearPrecio'

// ── Utilidades ────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  ASIGNADA: 'Asignada',
  RECOGIDA: 'Recogida',
  EN_CAMINO: 'En camino',
  ENTREGADA: 'Entregada',
  FALLIDA: 'Fallida',
}

const ESTADO_BADGE: Record<string, string> = {
  ASIGNADA: 'bg-amber-50 text-amber-700',
  RECOGIDA: 'bg-blue-50 text-blue-700',
  EN_CAMINO: 'bg-purple-50 text-purple-700',
  ENTREGADA: 'bg-[#52B788]/15 text-[#2D6A4F]',
  FALLIDA: 'bg-red-50 text-red-600',
}

const SIGUIENTE_ESTADO: Record<string, string | null> = {
  ASIGNADA: 'RECOGIDA',
  RECOGIDA: 'EN_CAMINO',
  EN_CAMINO: 'ENTREGADA',
  ENTREGADA: null,
  FALLIDA: null,
}

const SIGUIENTE_LABEL: Record<string, string> = {
  RECOGIDA: 'Marcar recogido',
  EN_CAMINO: 'En camino',
  ENTREGADA: 'Marcar entregado',
}

function estaActiva(estado: string): boolean {
  return estado !== 'ENTREGADA' && estado !== 'FALLIDA'
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Badge de estado ───────────────────────────────────────────

function BadgeEstado({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        ESTADO_BADGE[estado] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  )
}

// ── Tarjeta de entrega ────────────────────────────────────────

function TarjetaEntrega({
  entrega,
  onAvanzar,
  onFallida,
  onTomar,
  onSubirFoto,
  subiendoFotoId,
  cargandoAccion,
}: {
  entrega: EntregaDetalle
  onAvanzar?: (id: number, estado: string) => Promise<void>
  onFallida?: (id: number) => Promise<void>
  onTomar?: (id: number) => Promise<void>
  onSubirFoto?: (id: number, file: File) => void
  subiendoFotoId?: number | null
  cargandoAccion: number | null
}) {
  const { subPedido } = entrega
  const { pedido, comercio, items } = subPedido
  const activa = estaActiva(entrega.estado)
  const siguiente = SIGUIENTE_ESTADO[entrega.estado]
  const ocupado = cargandoAccion === entrega.id

  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 flex flex-col gap-4">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[#1A1A1A]/40 font-medium">
            Pedido #{pedido.id} · {fechaCorta(entrega.createdAt)}
          </p>
          <p className="mt-0.5 text-base font-semibold text-[#1A1A1A] truncate">
            {comercio.nombre}
          </p>
        </div>
        <BadgeEstado estado={entrega.estado} />
      </div>

      {/* Dirección */}
      <div className="flex gap-2 items-start text-sm text-[#1A1A1A]/70">
        <svg
          className="mt-0.5 shrink-0 text-[#2D6A4F]"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5z"
            fill="currentColor"
          />
        </svg>
        <span>{pedido.direccionTexto}</span>
      </div>

      {/* Comprador */}
      <div className="flex gap-2 items-center text-sm text-[#1A1A1A]/60">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          {pedido.comprador.nombre}
          {pedido.comprador.telefono && (
            <span className="ml-1 text-[#2D6A4F] font-medium">
              · {pedido.comprador.telefono}
            </span>
          )}
        </span>
      </div>

      {/* Productos */}
      <div className="rounded-xl bg-[#F8F5F0] px-4 py-3">
        <p className="text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide mb-2">
          Productos
        </p>
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between text-sm text-[#1A1A1A]">
              <span>{item.producto.nombre}</span>
              <span className="font-medium text-[#1A1A1A]/60">×{item.cantidad}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Notas */}
      {entrega.notas && (
        <p className="text-sm text-[#1A1A1A]/55 italic">Nota: {entrega.notas}</p>
      )}

      {/* Pago al repartidor */}
      {typeof entrega.pagoRepartidor === 'number' && entrega.pagoRepartidor > 0 && (
        <p className="text-sm font-semibold text-[#2D6A4F]">
          💵 Pago por esta entrega: {formatearPrecio(entrega.pagoRepartidor)}
        </p>
      )}

      {/* Foto de prueba de entrega (en el paso "En camino") */}
      {onSubirFoto && entrega.estado === 'EN_CAMINO' && (
        <div className="rounded-xl border border-dashed border-[#1A1A1A]/15 p-3">
          {entrega.fotoEntrega ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entrega.fotoEntrega} alt="Prueba de entrega" className="h-16 w-16 rounded-lg object-cover" />
              <span className="text-sm font-medium text-[#2D6A4F]">✓ Foto adjunta</span>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col gap-1">
              <span className="text-sm font-semibold text-[#1A1A1A]">📷 Foto de entrega (recomendado)</span>
              <span className="text-xs text-[#1A1A1A]/50">Tómale una foto al pedido entregado antes de marcarlo.</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={subiendoFotoId === entrega.id}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubirFoto(entrega.id, f) }}
              />
              <span className="mt-1 inline-flex w-fit rounded-lg border border-[#2D6A4F]/30 bg-[#52B788]/8 px-3 py-1.5 text-sm font-semibold text-[#2D6A4F]">
                {subiendoFotoId === entrega.id ? 'Subiendo…' : 'Adjuntar foto'}
              </span>
            </label>
          )}
        </div>
      )}

      {/* Acciones */}
      {onTomar && (
        <button
          onClick={() => onTomar(entrega.id)}
          disabled={ocupado}
          className="w-full rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold py-2.5 text-sm transition-colors disabled:opacity-50"
        >
          {ocupado ? 'Tomando...' : 'Tomar entrega'}
        </button>
      )}

      {activa && onAvanzar && siguiente && (
        <div className="flex gap-2">
          <button
            onClick={() => onAvanzar(entrega.id, siguiente)}
            disabled={ocupado}
            className="flex-1 rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {ocupado ? 'Actualizando...' : SIGUIENTE_LABEL[siguiente] ?? siguiente}
          </button>
          {onFallida && (
            <button
              onClick={() => onFallida(entrega.id)}
              disabled={ocupado}
              className="rounded-xl border border-red-200 bg-red-50 text-red-600 font-semibold px-4 py-2.5 text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              Fallida
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────

export default function PanelRepartidorPage() {
  const router = useRouter()
  const { usuario, cargando: cargandoAuth } = useAuth()

  const [tab, setTab] = useState<'mis' | 'disponibles' | 'historial'>('mis')
  const [misEntregasList, setMisEntregasList] = useState<EntregaDetalle[]>([])
  const [disponiblesList, setDisponiblesList] = useState<EntregaDetalle[]>([])
  const [historialList, setHistorialList] = useState<EntregaDetalle[]>([])
  const [municipioBase, setMunicipioBase] = useState<string | null>(null)
  const [verTodasZonas, setVerTodasZonas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cargandoAccion, setCargandoAccion] = useState<number | null>(null)
  const [subiendoFotoId, setSubiendoFotoId] = useState<number | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Auth guard — la protección de rol la hace el layout; aquí solo redirigimos
  // si no hay sesión en absoluto (usuario === null tras cargar).
  useEffect(() => {
    if (cargandoAuth) return
    if (!usuario) {
      router.replace('/ingresar')
    }
  }, [usuario, cargandoAuth, router])

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [mis, disp, hist] = await Promise.all([
        misEntregas(),
        entregasDisponibles(verTodasZonas),
        historialEntregas(),
      ])
      // misEntregas devuelve todas; filtramos activas vs historial
      setMisEntregasList(mis.filter((e) => estaActiva(e.estado)))
      setDisponiblesList(disp.items)
      setMunicipioBase(disp.municipioBase)
      setHistorialList(hist)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar las entregas.')
    } finally {
      setCargando(false)
    }
  }, [verTodasZonas])

  useEffect(() => {
    if (!usuario || usuario.rol !== 'REPARTIDOR') return
    cargarDatos()
  }, [usuario, cargarDatos])

  function mostrarExito(msg: string) {
    setMensajeExito(msg)
    setTimeout(() => setMensajeExito(null), 3000)
  }

  async function handleAvanzar(id: number, estado: string) {
    setCargandoAccion(id)
    try {
      const actualizada = await actualizarEstadoEntrega(id, estado)
      if (!estaActiva(actualizada.estado)) {
        // Pasó a estado terminal: conservar pago/foto y mover al historial
        const previo = misEntregasList.find((e) => e.id === id)
        const conExtras = {
          ...actualizada,
          pagoRepartidor: previo?.pagoRepartidor,
          fotoEntrega: previo?.fotoEntrega,
        }
        setMisEntregasList((prev) => prev.filter((e) => e.id !== id))
        setHistorialList((prev) => [conExtras, ...prev])
      } else {
        setMisEntregasList((prev) =>
          prev.map((e) => (e.id === id ? actualizada : e))
        )
      }
      mostrarExito(`Entrega actualizada a "${ESTADO_LABEL[estado] ?? estado}"`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.')
    } finally {
      setCargandoAccion(null)
    }
  }

  async function handleFallida(id: number) {
    setCargandoAccion(id)
    try {
      const actualizada = await actualizarEstadoEntrega(id, 'FALLIDA')
      setMisEntregasList((prev) => prev.filter((e) => e.id !== id))
      setHistorialList((prev) => [actualizada, ...prev])
      mostrarExito('Entrega marcada como fallida')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar como fallida.')
    } finally {
      setCargandoAccion(null)
    }
  }

  async function handleTomar(id: number) {
    setCargandoAccion(id)
    try {
      const nueva = await tomarEntrega(id)
      setDisponiblesList((prev) => prev.filter((e) => e.id !== id))
      setMisEntregasList((prev) => [nueva, ...prev])
      setTab('mis')
      mostrarExito('Entrega tomada correctamente')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo tomar la entrega.')
    } finally {
      setCargandoAccion(null)
    }
  }

  async function handleSubirFoto(id: number, file: File) {
    setSubiendoFotoId(id)
    try {
      const url = await subirFotoEntrega(id, file)
      setMisEntregasList((prev) => prev.map((e) => (e.id === id ? { ...e, fotoEntrega: url } : e)))
      mostrarExito('Foto de entrega adjunta')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la foto.')
    } finally {
      setSubiendoFotoId(null)
    }
  }

  if (cargandoAuth || !usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F0]">
        <p className="text-base text-[#1A1A1A]/55">Cargando...</p>
      </div>
    )
  }

  const entregasActivas = misEntregasList

  return (
    <div className="flex flex-col gap-5">
      {/* Saludo */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl text-[#2D6A4F] leading-tight"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Panel de entregas
          </h1>
          <p className="text-sm text-[#1A1A1A]/55">
            Hola, {usuario.nombre.split(' ')[0]}
          </p>
        </div>
        {entregasActivas.length > 0 && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2D6A4F] text-sm font-bold text-white">
            {entregasActivas.length}
          </span>
        )}
      </div>
        {/* Mensaje de éxito */}
        {mensajeExito && (
          <div
            role="status"
            className="rounded-xl border border-[#52B788]/30 bg-[#52B788]/10 px-4 py-3 text-sm font-medium text-[#2D6A4F]"
          >
            {mensajeExito}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 shrink-0"
              aria-label="Cerrar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 6 6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl border border-[#1A1A1A]/8 bg-white p-1 gap-1">
          <button
            onClick={() => setTab('mis')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === 'mis'
                ? 'bg-[#2D6A4F] text-white'
                : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
            }`}
          >
            Mis entregas
            {entregasActivas.length > 0 && (
              <span
                className={`ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  tab === 'mis' ? 'bg-white/25 text-white' : 'bg-[#2D6A4F]/15 text-[#2D6A4F]'
                }`}
              >
                {entregasActivas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('disponibles')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === 'disponibles'
                ? 'bg-[#2D6A4F] text-white'
                : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
            }`}
          >
            Disponibles
            {disponiblesList.length > 0 && (
              <span
                className={`ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  tab === 'disponibles'
                    ? 'bg-white/25 text-white'
                    : 'bg-[#D4A017]/15 text-[#D4A017]'
                }`}
              >
                {disponiblesList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === 'historial'
                ? 'bg-[#2D6A4F] text-white'
                : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
            }`}
          >
            Historial
          </button>
        </div>

        {/* Barra de zona (solo en Disponibles) */}
        {tab === 'disponibles' && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1A1A1A]/8 bg-white px-4 py-2.5 text-sm">
            <span className="text-[#1A1A1A]/60">
              {verTodasZonas
                ? '📍 Mostrando todas las zonas'
                : municipioBase
                ? <>📍 Tu zona: <span className="font-semibold text-[#2D6A4F]">{municipioBase}</span></>
                : '📍 Todas las zonas'}
            </span>
            {municipioBase && (
              <button
                onClick={() => setVerTodasZonas((v) => !v)}
                className="shrink-0 font-semibold text-[#2D6A4F] hover:underline"
              >
                {verTodasZonas ? 'Ver solo mi zona' : 'Ver todas las zonas'}
              </button>
            )}
          </div>
        )}

        {/* Contenido */}
        {cargando ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl bg-white border border-[#1A1A1A]/8"
              />
            ))}
          </div>
        ) : tab === 'historial' ? (
          (() => {
            const totalEntregadas = historialList.filter((e) => e.estado === 'ENTREGADA').length
            const totalFallidas = historialList.filter((e) => e.estado === 'FALLIDA').length
            const totalGanado = historialList
              .filter((e) => e.estado === 'ENTREGADA')
              .reduce((s, e) => s + (e.pagoRepartidor ?? 0), 0)
            return historialList.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1A1A1A]/8 bg-white py-14 text-center">
                <svg
                  className="mb-3 text-[#1A1A1A]/20"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-base font-semibold text-[#1A1A1A]/40">Sin historial aún</p>
                <p className="mt-1 text-sm text-[#1A1A1A]/30">
                  Aquí aparecerán tus entregas completadas y fallidas.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-[#52B788]/25 bg-[#52B788]/8 px-3 py-4 text-center">
                    <p className="text-2xl font-bold text-[#2D6A4F]">{totalEntregadas}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#2D6A4F]/70 uppercase tracking-wide">
                      Entregadas
                    </p>
                  </div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{totalFallidas}</p>
                    <p className="mt-0.5 text-xs font-semibold text-red-400 uppercase tracking-wide">
                      Fallidas
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/8 px-3 py-4 text-center">
                    <p className="text-lg font-bold text-[#9B7300] leading-tight">{formatearPrecio(totalGanado)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#9B7300]/70 uppercase tracking-wide">
                      Ganado
                    </p>
                  </div>
                </div>

                {/* Lista de entregas pasadas */}
                <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1A1A1A]/8">
                    <p className="text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide">
                      {historialList.length} entrega{historialList.length !== 1 ? 's' : ''} en total
                    </p>
                  </div>
                  <ul className="divide-y divide-[#1A1A1A]/5">
                    {historialList.map((e) => (
                      <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                        {e.fotoEntrega && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.fotoEntrega}
                            alt="Prueba de entrega"
                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs text-[#1A1A1A]/40 font-medium">
                              Pedido #{e.subPedido.pedido.id} · {fechaCorta(e.createdAt)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-[#1A1A1A] truncate">
                            {e.subPedido.comercio.nombre}
                          </p>
                          <p className="text-xs text-[#1A1A1A]/55 truncate mt-0.5">
                            {e.subPedido.pedido.direccionTexto}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <BadgeEstado estado={e.estado} />
                          {e.estado === 'ENTREGADA' && typeof e.pagoRepartidor === 'number' && e.pagoRepartidor > 0 && (
                            <span className="text-xs font-semibold text-[#2D6A4F]">{formatearPrecio(e.pagoRepartidor)}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })()
        ) : tab === 'mis' ? (
          misEntregasList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1A1A1A]/8 bg-white py-14 text-center">
              <svg
                className="mb-3 text-[#1A1A1A]/20"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 17l-5-5 5-5M15 7l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-base font-semibold text-[#1A1A1A]/40">Sin entregas asignadas</p>
              <p className="mt-1 text-sm text-[#1A1A1A]/30">
                Revisa las entregas disponibles para tomar una.
              </p>
              <button
                onClick={() => setTab('disponibles')}
                className="mt-4 rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold px-5 py-2.5 text-sm transition-colors"
              >
                Ver disponibles
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {misEntregasList.map((e) => (
                <TarjetaEntrega
                  key={e.id}
                  entrega={e}
                  onAvanzar={handleAvanzar}
                  onFallida={handleFallida}
                  onSubirFoto={handleSubirFoto}
                  subiendoFotoId={subiendoFotoId}
                  cargandoAccion={cargandoAccion}
                />
              ))}
            </div>
          )
        ) : disponiblesList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1A1A1A]/8 bg-white py-14 text-center">
            <svg
              className="mb-3 text-[#1A1A1A]/20"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-base font-semibold text-[#1A1A1A]/40">
              No hay entregas disponibles
            </p>
            <p className="mt-1 text-sm text-[#1A1A1A]/30">Vuelve a revisar más tarde.</p>
            <button
              onClick={cargarDatos}
              className="mt-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A]/70 font-semibold px-5 py-2.5 text-sm hover:border-[#2D6A4F]/30 transition-colors"
            >
              Actualizar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {disponiblesList.map((e) => (
              <TarjetaEntrega
                key={e.id}
                entrega={e}
                onTomar={handleTomar}
                cargandoAccion={cargandoAccion}
              />
            ))}
          </div>
        )}

        {/* Botón recargar (solo cuando hay datos) */}
        {!cargando && (misEntregasList.length > 0 || disponiblesList.length > 0) && (
          <button
            onClick={cargarDatos}
            className="w-full rounded-xl border border-[#1A1A1A]/10 bg-white py-2.5 text-sm font-medium text-[#1A1A1A]/50 hover:border-[#2D6A4F]/25 hover:text-[#2D6A4F] transition-colors"
          >
            Actualizar entregas
          </button>
        )}
    </div>
  )
}
