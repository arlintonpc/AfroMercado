'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'
import { BadgeEstado } from '@/components/checkout/estadoPedido'
import { desenvolver, nombreComercio, type PedidoDetalle } from '@/components/checkout/tiposPedido'
import { puedeCalificarTienda, crearReviewTienda } from '@/lib/api/reviewsTienda'
import { puedeCalificarProducto, crearReviewProducto } from '@/lib/api/reviewsProducto'

// ── Utilidades ────────────────────────────────────────────────

function fechaLegible(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function contarItems(p: PedidoDetalle): number {
  if (p.subPedidos?.length) {
    return p.subPedidos.reduce(
      (acc, sp) => acc + (sp.items?.reduce((a, it) => a + (it.cantidad ?? 0), 0) ?? 0),
      0,
    )
  }
  return p.items?.reduce((a, it) => a + (it.cantidad ?? 0), 0) ?? 0
}

// ── Barra de progreso ─────────────────────────────────────────

const PASOS = [
  { label: 'Pago' },
  { label: 'Verificación' },
  { label: 'Preparación' },
  { label: 'Listo' },
  { label: 'Entregado' },
]

function pasoActual(pedido: PedidoDetalle): number {
  const { estado, subPedidos = [] } = pedido
  if (estado === 'PENDIENTE_PAGO') return 0
  if (estado === 'VERIFICANDO_PAGO') return 1
  if (estado === 'ENTREGADO') return 4
  if (estado === 'CONFIRMADO') {
    const todosListo =
      subPedidos.length > 0 &&
      subPedidos.every((sp) => sp.estado === 'LISTO' || sp.estado === 'ENTREGADO')
    return todosListo ? 3 : 2
  }
  return -1
}

function BarraProgreso({ pedido }: { pedido: PedidoDetalle }) {
  const actual = pasoActual(pedido)
  if (actual < 0) return null
  return (
    <div className="flex items-start mt-4">
      {PASOS.map((paso, i) => {
        const hecho = i < actual
        const activo = i === actual
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                hecho ? 'bg-[#2D6A4F] text-white'
                  : activo ? 'bg-[#D4A017] text-white ring-2 ring-[#D4A017]/30'
                  : 'bg-[#1A1A1A]/10 text-[#1A1A1A]/30'
              }`}>
                {hecho
                  ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : i + 1
                }
              </div>
              <span className={`text-[10px] mt-1 whitespace-nowrap leading-tight text-center ${
                activo ? 'text-[#D4A017] font-semibold' : hecho ? 'text-[#2D6A4F]' : 'text-[#1A1A1A]/30'
              }`}>
                {paso.label}
              </span>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 rounded ${i < actual ? 'bg-[#2D6A4F]' : 'bg-[#1A1A1A]/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Estrellas interactivas ────────────────────────────────────

function EstrellasInteractivas({
  valor,
  onChange,
}: {
  valor: number
  onChange: (v: number) => void
}) {
  const [hover, setHover] = useState(0)
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none"
          aria-label={`${i} estrella${i > 1 ? 's' : ''}`}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill={i <= (hover || valor) ? '#D4A017' : 'none'}
            stroke="#D4A017"
            strokeWidth="1.5"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </span>
  )
}

// ── Modal de calificación ─────────────────────────────────────

interface ModalCalificarProps {
  pedidoId: number
  onCerrar: () => void
  onExito: (pedidoId: number) => void
}

function ModalCalificarTienda({ pedidoId, onCerrar, onExito }: ModalCalificarProps) {
  const [calificacion, setCalificacion] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEnviar() {
    if (calificacion === 0) { setError('Selecciona una calificación'); return }
    setEnviando(true)
    setError(null)
    try {
      await crearReviewTienda({
        pedidoId,
        calificacion,
        comentario: comentario.trim() || undefined,
      })
      onExito(pedidoId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la reseña')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1A1A1A]">Calificar tienda</h3>
          <button
            onClick={onCerrar}
            className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors"
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-[#1A1A1A]/55 mb-4">¿Cómo fue tu experiencia con esta tienda?</p>

        <div className="flex justify-center mb-4">
          <EstrellasInteractivas valor={calificacion} onChange={setCalificacion} />
        </div>

        <textarea
          className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 mb-3"
          rows={3}
          placeholder="Cuéntanos sobre tu experiencia (opcional)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={500}
        />

        {error && (
          <p className="text-xs text-[#C0392B] mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 rounded-xl border border-[#1A1A1A]/12 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || calificacion === 0}
            className="flex-1 rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? 'Enviando…' : 'Enviar reseña'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de calificación de productos ───────────────────────

function ModalCalificarProducto({
  pedido,
  onCerrar,
  onExito,
}: {
  pedido: PedidoDetalle
  onCerrar: () => void
  onExito: () => void
}) {
  type EstadoProducto = { calificacion: number; comentario: string; puede: boolean | null; yaCalifico: boolean }

  const productos = (() => {
    const mapa = new Map<number, string>()
    for (const sp of pedido.subPedidos ?? []) {
      for (const it of sp.items ?? []) {
        if (it.productoId) {
          mapa.set(Number(it.productoId), it.producto?.nombre ?? it.nombre ?? `Producto ${it.productoId}`)
        }
      }
    }
    return Array.from(mapa.entries()).map(([id, nombre]) => ({ id, nombre }))
  })()

  const [estados, setEstados] = useState<Record<number, EstadoProducto>>(() =>
    Object.fromEntries(productos.map((p) => [p.id, { calificacion: 0, comentario: '', puede: null, yaCalifico: false }]))
  )
  const [verificando, setVerificando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (productos.length === 0) { setVerificando(false); return }
    let cancelado = false
    Promise.allSettled(productos.map((p) => puedeCalificarProducto(p.id))).then((resultados) => {
      if (cancelado) return
      setEstados((prev) => {
        const next = { ...prev }
        productos.forEach((p, i) => {
          const r = resultados[i]
          if (r.status === 'fulfilled') next[p.id] = { ...next[p.id], puede: r.value.puede, yaCalifico: r.value.yaCalifico }
          else next[p.id] = { ...next[p.id], puede: false }
        })
        return next
      })
      setVerificando(false)
    })
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleEnviar() {
    const paraEnviar = productos.filter((p) => estados[p.id]?.calificacion > 0 && estados[p.id]?.puede && !estados[p.id]?.yaCalifico)
    if (paraEnviar.length === 0) { onCerrar(); return }
    setEnviando(true)
    setError(null)
    try {
      await Promise.all(
        paraEnviar.map((p) =>
          crearReviewProducto({
            productoId: p.id,
            calificacion: estados[p.id].calificacion,
            comentario: estados[p.id].comentario.trim() || undefined,
          })
        )
      )
      onExito()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron enviar las reseñas.')
    } finally {
      setEnviando(false)
    }
  }

  const hayParaCalificar = productos.some((p) => estados[p.id]?.puede && !estados[p.id]?.yaCalifico)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1A1A1A]">Calificar productos</h3>
            <button onClick={onCerrar} className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors" aria-label="Cerrar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {verificando ? (
            <div className="flex flex-col gap-3">
              {productos.map((p) => (
                <div key={p.id} className="h-20 bg-[#1A1A1A]/6 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {productos.map((p) => {
                const est = estados[p.id]
                return (
                  <div key={p.id} className="border border-[#1A1A1A]/8 rounded-xl p-4">
                    <p className="font-semibold text-[#1A1A1A] text-sm mb-2">{p.nombre}</p>
                    {est?.yaCalifico ? (
                      <p className="text-xs text-[#1A1A1A]/40">Ya calificaste este producto ✓</p>
                    ) : est?.puede === false ? (
                      <p className="text-xs text-[#1A1A1A]/30">No disponible</p>
                    ) : (
                      <>
                        <div className="flex justify-center mb-2">
                          <EstrellasInteractivas
                            valor={est?.calificacion ?? 0}
                            onChange={(v) => setEstados((prev) => ({ ...prev, [p.id]: { ...prev[p.id], calificacion: v } }))}
                          />
                        </div>
                        {(est?.calificacion ?? 0) > 0 && (
                          <textarea
                            rows={2}
                            placeholder="Comentario opcional"
                            value={est?.comentario ?? ''}
                            onChange={(e) => setEstados((prev) => ({ ...prev, [p.id]: { ...prev[p.id], comentario: e.target.value } }))}
                            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                          />
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {error && <p className="text-xs text-[#C0392B] mt-3">{error}</p>}

          <div className="flex gap-2 mt-5">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 rounded-xl border border-[#1A1A1A]/12 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors"
            >
              Cancelar
            </button>
            {!verificando && hayParaCalificar && (
              <button
                type="button"
                onClick={handleEnviar}
                disabled={enviando || productos.every((p) => (estados[p.id]?.calificacion ?? 0) === 0)}
                className="flex-1 rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando ? 'Enviando…' : 'Enviar reseñas'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de pedido ─────────────────────────────────────────

const ESTADOS_ACTIVOS = new Set(['PENDIENTE_PAGO', 'VERIFICANDO_PAGO', 'CONFIRMADO'])
const ESTADOS_INACTIVOS = new Set(['ENTREGADO', 'CANCELADO', 'EXPIRADO', 'PAGO_FALLIDO'])

interface TarjetaPedidoProps {
  pedido: PedidoDetalle
  puedeCalificar?: boolean
  yaCalifico?: boolean
  onCalificar?: (pedidoId: number) => void
  onCalificarProductos?: (pedidoId: number | string) => void
}

function TarjetaPedido({ pedido, puedeCalificar, yaCalifico, onCalificar, onCalificarProductos }: TarjetaPedidoProps) {
  const total = pedido.total ?? pedido.subtotal ?? 0
  const n = contarItems(pedido)
  const fecha = fechaLegible(pedido.creadoEn)
  const productores = (pedido.subPedidos ?? [])
    .map(g => nombreComercio(g))
    .filter(Boolean)
    .join(', ')

  const esPendiente = pedido.estado === 'PENDIENTE_PAGO'
  const esEntregado = pedido.estado === 'ENTREGADO'
  const esExpiradoOFallido = pedido.estado === 'EXPIRADO' || pedido.estado === 'PAGO_FALLIDO'
  const inactivo = ESTADOS_INACTIVOS.has(pedido.estado)

  // Primer productoId disponible para enlace de re-compra
  const primerProductoId = (() => {
    for (const sp of pedido.subPedidos ?? []) {
      for (const it of sp.items ?? []) {
        const pid = it.productoId ?? it.producto?.id
        if (pid) return pid
      }
    }
    return null
  })()

  return (
    <div className={`bg-white rounded-2xl border p-5 transition-shadow hover:shadow-md ${
      inactivo ? 'border-[#1A1A1A]/5 opacity-65' : 'border-[#1A1A1A]/8'
    }`}>
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-[#1A1A1A]/40 font-semibold uppercase tracking-wide">
            {pedido.codigo ?? `PED-${String(pedido.id)}`}
          </p>
          {fecha && <p className="text-sm text-[#1A1A1A]/55 mt-0.5">{fecha}</p>}
        </div>
        <BadgeEstado estado={pedido.estado} />
      </div>

      {/* Barra de progreso */}
      {!['CANCELADO', 'EXPIRADO', 'PAGO_FALLIDO'].includes(pedido.estado) && (
        <BarraProgreso pedido={pedido} />
      )}

      {/* Productos y productor */}
      {(n > 0 || productores) && (
        <p className="text-sm text-[#1A1A1A]/60 mt-3">
          {n > 0 ? `${n} ${n === 1 ? 'producto' : 'productos'}` : ''}
          {productores ? ` · ${productores}` : ''}
        </p>
      )}

      {pedido.direccionTexto && (
        <p className="text-xs text-[#1A1A1A]/35 mt-1 truncate">📍 {pedido.direccionTexto}</p>
      )}

      {/* Pie */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1A1A1A]/5 gap-2 flex-wrap">
        <span className="text-lg font-bold text-[#2D6A4F]">{formatearPrecio(total)}</span>
        <div className="flex items-center gap-2">
          {esExpiradoOFallido && (
            <Link
              href={primerProductoId ? `/producto/${primerProductoId}` : '/buscar'}
              className="rounded-xl border border-[#1A1A1A]/20 hover:border-[#1A1A1A]/40 text-[#1A1A1A]/60 hover:text-[#1A1A1A] text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              Volver a comprar
            </Link>
          )}
          {esEntregado && yaCalifico && (
            <span className="text-xs text-[#1A1A1A]/40 font-medium">Ya calificaste</span>
          )}
          {esEntregado && puedeCalificar && onCalificar && (
            <button
              type="button"
              onClick={() => onCalificar(Number(pedido.id))}
              className="rounded-xl bg-[#D4A017] hover:bg-[#b88a14] text-white text-sm font-semibold px-3 py-1.5 transition-colors"
            >
              Calificar tienda
            </button>
          )}
          {esEntregado && onCalificarProductos && (
            <button
              type="button"
              onClick={() => onCalificarProductos(Number(pedido.id))}
              className="rounded-xl bg-[#52B788]/20 hover:bg-[#52B788]/35 border border-[#52B788]/40 text-[#2D6A4F] text-sm font-semibold px-3 py-1.5 transition-colors"
            >
              Calificar productos
            </button>
          )}
          <Link href={`/pedido/${pedido.id}`}>
            <Button variant={esPendiente ? 'primary' : 'secondary'} size="sm">
              {esPendiente ? 'Pagar ahora' : 'Ver detalles'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function TarjetaSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
      <Skeleton className="h-3 w-28 mb-2" />
      <Skeleton className="h-4 w-20 mb-4" />
      <Skeleton className="h-3 w-52 mb-1" />
      <Skeleton className="h-3 w-36" />
      <div className="flex justify-between mt-4 pt-4 border-t border-[#1A1A1A]/5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function PaginaMisPedidos() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [pedidos, setPedidos] = useState<PedidoDetalle[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [puedeCalificar, setPuedeCalificar] = useState<Record<number, boolean>>({})
  const [yaCalifico, setYaCalifico] = useState<Record<number, boolean>>({})
  const [pedidoACalificar, setPedidoACalificar] = useState<number | null>(null)
  const [pedidoACalificarProductos, setPedidoACalificarProductos] = useState<number | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/mis-pedidos')
    }
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const raw = await apiFetch<unknown>('/pedidos')
        if (cancelado) return
        const data = desenvolver<PedidoDetalle[]>(raw)
        const lista = Array.isArray(data) ? data : []
        setPedidos(lista)

        const entregados = lista.filter(p => p.estado === 'ENTREGADO')
        if (entregados.length > 0) {
          const resultados = await Promise.allSettled(
            entregados.map(p => puedeCalificarTienda(Number(p.id)))
          )
          if (cancelado) return
          const nuevoPuede: Record<number, boolean> = {}
          const nuevoYa: Record<number, boolean> = {}
          entregados.forEach((p, i) => {
            const r = resultados[i]
            if (r.status === 'fulfilled') {
              const pedidoId = Number(p.id)
              nuevoPuede[pedidoId] = r.value.puede
              nuevoYa[pedidoId] = r.value.yaCalifico
            }
          })
          setPuedeCalificar(nuevoPuede)
          setYaCalifico(nuevoYa)
        }
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No pudimos cargar tus pedidos.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [autenticado, cargandoAuth])

  function handleExitoCalificacion(pedidoId: number) {
    setPuedeCalificar(prev => ({ ...prev, [pedidoId]: false }))
    setYaCalifico(prev => ({ ...prev, [pedidoId]: true }))
    setPedidoACalificar(null)
  }

  const enCurso = pedidos.filter(p => ESTADOS_ACTIVOS.has(p.estado))
  const historial = pedidos.filter(p => ESTADOS_INACTIVOS.has(p.estado))

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        <h1
          className="text-3xl text-[#1A1A1A] mb-1"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Mis pedidos
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-7">
          Haz seguimiento a tus compras en tiempo real.
        </p>

        {error && (
          <div className="rounded-xl border border-[#C0392B]/20 bg-[#C0392B]/5 px-4 py-3 text-sm text-[#C0392B] mb-6">
            {error}
          </div>
        )}

        {cargando || cargandoAuth ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <TarjetaSkeleton key={i} />)}
          </div>
        ) : pedidos.length === 0 ? (
          <EmptyState
            titulo="Aún no has hecho ningún pedido"
            descripcion="Cuando realices tu primera compra, podrás hacer seguimiento aquí."
          >
            <Link href="/" className="mt-2">
              <Button>Explorar productos</Button>
            </Link>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-8">
            {enCurso.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[#1A1A1A]/45 uppercase tracking-widest mb-3">
                  En curso
                </h2>
                <div className="flex flex-col gap-4">
                  {enCurso.map(p => <TarjetaPedido key={String(p.id)} pedido={p} />)}
                </div>
              </section>
            )}

            {historial.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[#1A1A1A]/45 uppercase tracking-widest mb-3">
                  Historial
                </h2>
                <div className="flex flex-col gap-4">
                  {historial.map(p => (
                    <TarjetaPedido
                      key={String(p.id)}
                      pedido={p}
                      puedeCalificar={puedeCalificar[Number(p.id)]}
                      yaCalifico={yaCalifico[Number(p.id)]}
                      onCalificar={setPedidoACalificar}
                      onCalificarProductos={(id) => setPedidoACalificarProductos(Number(id))}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />

      {pedidoACalificar !== null && (
        <ModalCalificarTienda
          pedidoId={pedidoACalificar}
          onCerrar={() => setPedidoACalificar(null)}
          onExito={handleExitoCalificacion}
        />
      )}

      {pedidoACalificarProductos !== null && (() => {
        const pedidoTarget = pedidos.find((p) => Number(p.id) === pedidoACalificarProductos)
        return pedidoTarget ? (
          <ModalCalificarProducto
            pedido={pedidoTarget}
            onCerrar={() => setPedidoACalificarProductos(null)}
            onExito={() => setPedidoACalificarProductos(null)}
          />
        ) : null
      })()}
    </div>
  )
}
