'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'
import { BadgeEstado, infoEstado } from '@/components/checkout/estadoPedido'
import {
  desenvolver,
  nombreComercio,
  type PedidoDetalle,
  type SubPedido,
} from '@/components/checkout/tiposPedido'
import { puedeCalificarTienda, crearReviewTienda } from '@/lib/api/reviewsTienda'

function lineasDePedido(pedido: PedidoDetalle): SubPedido[] {
  if (pedido.subPedidos && pedido.subPedidos.length > 0) return pedido.subPedidos
  // Fallback: si el backend devuelve items planos, los tratamos como un grupo.
  if (pedido.items && pedido.items.length > 0) {
    return [{ comercio: 'Tu pedido', items: pedido.items }]
  }
  return []
}

export default function PaginaPedido({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()

  const [pedido, setPedido] = useState<PedidoDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [cambioEstado, setCambioEstado] = useState(false)

  // Calificación de tienda
  const [puedeCalificar, setPuedeCalificar] = useState<boolean>(false)
  const [yaCalifico, setYaCalifico] = useState<boolean>(false)
  const [modalCalificar, setModalCalificar] = useState(false)
  const [calificacion, setCalificacion] = useState(0)
  const [hoverEstrella, setHoverEstrella] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviandoReview, setEnviandoReview] = useState(false)
  const [errorReview, setErrorReview] = useState<string | null>(null)
  const [graciasCalificacion, setGraciasCalificacion] = useState(false)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace(`/ingresar?redirect=/pedido/${id}`)
    }
  }, [cargandoAuth, autenticado, router, id])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const raw = await apiFetch<unknown>(`/pedidos/${id}`)
        if (cancelado) return
        setPedido(desenvolver<PedidoDetalle>(raw))
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No pudimos cargar el pedido.')
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [id, autenticado, cargandoAuth])

  // Polling: refresca el estado del pedido cada 30 s mientras no sea terminal.
  useEffect(() => {
    if (!pedido || !autenticado) return
    const ESTADOS_TERMINALES = ['ENTREGADO', 'CANCELADO', 'EXPIRADO', 'PAGO_FALLIDO']
    if (ESTADOS_TERMINALES.includes(pedido.estado)) return

    const interval = setInterval(async () => {
      try {
        const raw = await apiFetch<unknown>(`/pedidos/${id}`)
        const actualizado = desenvolver<PedidoDetalle>(raw)
        setPedido((prev) => {
          if (!prev) return actualizado
          if (prev.estado !== actualizado.estado) {
            setCambioEstado(true)
            setTimeout(() => setCambioEstado(false), 5000)
          }
          return actualizado
        })
      } catch {
        // silencioso — no interrumpir la UX por un fallo de polling
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [pedido?.estado, id, autenticado])

  // Verifica si puede calificar cuando el pedido está ENTREGADO
  useEffect(() => {
    if (!pedido || pedido.estado !== 'ENTREGADO') return
    let vivo = true
    puedeCalificarTienda(Number(pedido.id)).then((res) => {
      if (!vivo) return
      setPuedeCalificar(res.puede)
      setYaCalifico(res.yaCalifico)
    }).catch(() => { /* silencioso */ })
    return () => { vivo = false }
  }, [pedido])

  if (cargandoAuth || !autenticado || cargando) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10">
          <div className="skeleton h-10 w-40 rounded mb-4" />
          <div className="skeleton h-56 w-full rounded-2xl" />
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center">
          <EmptyState
            titulo="No pudimos cargar tu pedido"
            descripcion={error ?? 'Este pedido no existe o no está disponible.'}
          />
          <Link href="/" className="mt-2">
            <Button variant="secondary">Volver al inicio</Button>
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  async function handleEnviarReview() {
    if (calificacion === 0) { setErrorReview('Selecciona al menos una estrella'); return }
    setEnviandoReview(true)
    setErrorReview(null)
    try {
      await crearReviewTienda({
        pedidoId: Number(pedido!.id),
        calificacion,
        comentario: comentario.trim() || undefined,
      })
      setModalCalificar(false)
      setGraciasCalificacion(true)
      setPuedeCalificar(false)
      setYaCalifico(true)
    } catch (e) {
      setErrorReview(e instanceof Error ? e.message : 'No se pudo enviar la calificación.')
    } finally {
      setEnviandoReview(false)
    }
  }

  async function handleCancelar() {
    if (!window.confirm('¿Seguro que quieres cancelar este pedido? Esta acción no se puede deshacer.')) return
    setCancelando(true)
    try {
      await apiFetch(`/pedidos/${id}/cancelar`, { method: 'POST' })
      setCancelado(true)
      setPedido((p) => p ? { ...p, estado: 'CANCELADO' as typeof p.estado } : p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar el pedido.')
    } finally {
      setCancelando(false)
    }
  }

  const info = infoEstado(pedido.estado)
  const grupos = lineasDePedido(pedido)
  const total = pedido.total ?? pedido.subtotal ?? 0
  const direccion = pedido.direccionTexto ?? pedido.direccion
  const esPendiente =
    pedido.estado === 'PENDIENTE_PAGO' || pedido.estado === 'PENDIENTE'
  const esEntregado = pedido.estado === 'ENTREGADO'
  const esExpirado = pedido.estado === 'EXPIRADO'
  const esPagoFallido = pedido.estado === 'PAGO_FALLIDO'

  // Primer productoId disponible para enlace de re-compra
  const primerProductoId = (() => {
    const grupos_ = lineasDePedido(pedido)
    for (const g of grupos_) {
      for (const it of g.items ?? []) {
        const pid = it.productoId ?? it.producto?.id
        if (pid) return pid
      }
    }
    return null
  })()

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-6 pb-10">
        {/* Banner: cambio de estado detectado por polling */}
        {cambioEstado && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-xl border border-[#52B788]/30 bg-[#52B788]/10 px-4 py-3 text-sm font-medium text-[#2D6A4F]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            El estado de tu pedido ha cambiado.
          </div>
        )}

        {/* Encabezado de estado */}
        <div className="rounded-2xl bg-white border border-[#1A1A1A]/5 p-6 text-center">
          <div className="flex justify-center mb-3">
            <span
              className={`flex items-center justify-center w-14 h-14 rounded-full ${
                info.variante === 'verde'
                  ? 'bg-[#2D6A4F] text-white'
                  : info.variante === 'naranja'
                    ? 'bg-[#E67E22] text-white'
                    : info.variante === 'dorado'
                      ? 'bg-[#D4A017] text-white'
                      : 'bg-[#1A1A1A]/10 text-[#1A1A1A]/60'
              }`}
            >
              {info.variante === 'verde' ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : info.variante === 'naranja' ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
                </svg>
              )}
            </span>
          </div>

          <h1
            className="text-2xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            {info.titulo}
          </h1>
          <p className="text-sm text-[#1A1A1A]/60 mt-2 max-w-md mx-auto">
            {info.mensaje}
          </p>

          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-sm text-[#1A1A1A]/50">Pedido {pedido.codigo ?? `PED-${String(pedido.id)}`}</span>
            <BadgeEstado estado={pedido.estado} />
          </div>

          {esPendiente && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-5">
              <Link href={`/pedido/${pedido.id}/pago`} className="inline-block">
                <Button>Realizar el pago</Button>
              </Link>
              <button
                onClick={handleCancelar}
                disabled={cancelando || cancelado}
                className="px-5 py-2 rounded-xl text-sm font-medium border border-[#1A1A1A]/20 text-[#1A1A1A]/60 hover:border-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
              >
                {cancelando ? 'Cancelando…' : cancelado ? 'Pedido cancelado' : 'Cancelar pedido'}
              </button>
            </div>
          )}

          {esEntregado && (
            <div className="mt-5">
              {graciasCalificacion ? (
                <p className="text-sm font-semibold text-[#2D6A4F]">¡Gracias por tu calificación!</p>
              ) : yaCalifico ? (
                <p className="text-xs text-[#1A1A1A]/40 font-medium">Ya calificaste esta tienda ✓</p>
              ) : puedeCalificar ? (
                <button
                  type="button"
                  onClick={() => setModalCalificar(true)}
                  className="rounded-xl bg-[#D4A017] hover:bg-[#b88a14] text-white text-sm font-semibold px-5 py-2 transition-colors"
                >
                  Calificar tienda
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* Items por comercio */}
        {grupos.length > 0 && (
          <section className="mt-5 rounded-2xl bg-white border border-[#1A1A1A]/5 p-5">
            <h2 className="font-bold text-[#1A1A1A] mb-4">Tu pedido</h2>
            <div className="flex flex-col gap-5">
              {grupos.map((grupo, gi) => (
                <div key={grupo.id ?? gi}>
                  <p className="text-sm font-semibold text-[#2D6A4F] mb-2">
                    {nombreComercio(grupo)}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {(grupo.items ?? []).map((it, ii) => {
                      const nombre = it.nombre ?? it.producto?.nombre ?? 'Producto'
                      const cant = it.cantidad ?? 1
                      const sub =
                        it.subtotal ??
                        (it.precioUnitario ?? 0) * cant
                      return (
                        <li
                          key={it.id ?? it.productoId ?? ii}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <span className="text-[#1A1A1A]/70">
                            {cant}× {nombre}
                          </span>
                          <span className="text-[#1A1A1A] whitespace-nowrap">
                            {formatearPrecio(sub)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="h-px bg-[#1A1A1A]/10 my-4" />
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-[#1A1A1A]">Total</span>
              <span className="text-xl font-bold text-[#2D6A4F]">
                {formatearPrecio(total)}
              </span>
            </div>
          </section>
        )}

        {/* Dirección */}
        {direccion && (
          <section className="mt-5 rounded-2xl bg-white border border-[#1A1A1A]/5 p-5">
            <h2 className="font-bold text-[#1A1A1A] mb-2">Dirección de entrega</h2>
            <p className="text-sm text-[#1A1A1A]/70 leading-relaxed">{direccion}</p>
            {pedido.notas && (
              <p className="text-sm text-[#1A1A1A]/50 mt-2">
                <span className="font-medium">Notas:</span> {pedido.notas}
              </p>
            )}
          </section>
        )}

        {/* Banner EXPIRADO / PAGO_FALLIDO */}
        {(esExpirado || esPagoFallido) && (
          <section className="mt-5 rounded-2xl bg-[#C0392B]/5 border border-[#C0392B]/20 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-[#C0392B]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#C0392B] mb-1">
                  {esExpirado ? 'Pedido expirado' : 'Pago fallido'}
                </p>
                <p className="text-sm text-[#1A1A1A]/65 leading-relaxed">
                  {esExpirado
                    ? 'Tu pedido expiró porque el pago no fue confirmado a tiempo. Puedes volver a comprar los productos.'
                    : 'Hubo un problema con tu pago. Verifica el comprobante o intenta de nuevo.'}
                </p>
                <div className="mt-3">
                  <Link
                    href={primerProductoId ? `/producto/${primerProductoId}` : '/buscar'}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A1A1A] hover:bg-[#1A1A1A]/80 text-white text-sm font-semibold px-4 py-2 transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Volver a comprar
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Qué sigue */}
        <section className="mt-5 rounded-2xl bg-[#52B788]/8 border border-[#52B788]/20 p-5">
          <h2 className="font-bold text-[#2D6A4F] mb-1">¿Qué sigue?</h2>
          <p className="text-sm text-[#1A1A1A]/70">
            {esPendiente
              ? 'Realiza el pago para que los productores empiecen a preparar tu pedido. Tienes el tiempo indicado en la pantalla de pago.'
              : pedido.estado === 'VERIFICANDO_PAGO'
                ? 'Estamos verificando tu pago. Te avisaremos en cuanto esté confirmado (máximo 2 horas) y los productores comenzarán a preparar tu pedido.'
                : 'Los productores prepararán tu pedido artesanalmente y coordinarán el envío contigo. Te mantendremos al tanto.'}
          </p>
        </section>

        {/* Navegación */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/mis-pedidos">
            <Button variant="secondary" className="w-full">Mis pedidos</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="w-full">Seguir explorando</Button>
          </Link>
        </div>
      </main>

      <Footer />

      {/* Modal calificar tienda */}
      {modalCalificar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[#1A1A1A]">Calificar tienda</h3>
              <button
                onClick={() => { setModalCalificar(false); setErrorReview(null) }}
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
              <span className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCalificacion(i)}
                    onMouseEnter={() => setHoverEstrella(i)}
                    onMouseLeave={() => setHoverEstrella(0)}
                    className="focus:outline-none"
                    aria-label={`${i} estrella${i > 1 ? 's' : ''}`}
                  >
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill={i <= (hoverEstrella || calificacion) ? '#D4A017' : 'none'}
                      stroke="#D4A017"
                      strokeWidth="1.5"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </span>
            </div>

            <textarea
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 mb-3"
              rows={3}
              placeholder="Cuéntanos sobre tu experiencia (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
            />

            {errorReview && (
              <p className="text-xs text-[#C0392B] mb-3">{errorReview}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setModalCalificar(false); setErrorReview(null) }}
                className="flex-1 rounded-xl border border-[#1A1A1A]/12 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEnviarReview}
                disabled={enviandoReview || calificacion === 0}
                className="flex-1 rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviandoReview ? 'Enviando…' : 'Enviar calificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
