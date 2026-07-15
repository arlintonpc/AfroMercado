'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { misPedidosExpress, type PedidoExpress } from '@/lib/api/express'
import { crearReviewExpress, subirFotoReviewExpress } from '@/lib/api/review'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { obtenerToken } from '@/lib/api/client'
import ModalReportarProblema from '@/components/disputas/ModalReportarProblema'
import EstrellaRating from '@/components/ui/EstrellaRating'
import { Toast, useToast } from '@/components/ui/Toast'

const ESTADO_INFO: Record<string, { label: string; color: string; paso: number }> = {
  PENDIENTE:      { label: 'Pendiente de confirmacion', color: 'bg-amber-100 text-amber-700',   paso: 0 },
  ACEPTADO:       { label: 'Confirmado',                color: 'bg-blue-100 text-blue-700',     paso: 1 },
  EN_PREPARACION: { label: 'Preparando tu pedido',      color: 'bg-blue-100 text-blue-700',     paso: 2 },
  LISTO:          { label: 'Listo para recoger',        color: 'bg-green-100 text-green-700',   paso: 3 },
  EN_CAMINO:      { label: 'En camino',                 color: 'bg-green-100 text-green-700',   paso: 4 },
  ENTREGADO:      { label: 'Entregado',                 color: 'bg-green-100 text-green-700',   paso: 5 },
  CANCELADO:      { label: 'Cancelado',                 color: 'bg-red-100 text-red-600',       paso: -1 },
  RECHAZADO:      { label: 'Rechazado',                 color: 'bg-red-100 text-red-600',       paso: -1 },
}

const PASOS = ['Enviado', 'Aceptado', 'Preparando', 'Listo', 'En camino', 'Entregado']

function BarraProgreso({ estado }: { estado: string }) {
  const info = ESTADO_INFO[estado]
  if (!info || info.paso < 0) return null
  return (
    <div className="mt-3">
      <div className="flex justify-between mb-1">
        {PASOS.map((p, i) => (
          <div key={p} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
            <div className={`w-4 h-4 rounded-full border-2 transition-all ${
              i <= info.paso ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'
            }`} />
            <span className={`text-[9px] text-center leading-tight ${i <= info.paso ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
              {p}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1 bg-gray-200 rounded-full mt-0.5">
        <div
          className="absolute h-1 bg-green-600 rounded-full transition-all duration-700"
          style={{ width: `${(info.paso / (PASOS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  )
}

function ModalReview({
  pedidoId,
  restaurante,
  onGuardado,
  onCerrar,
}: {
  pedidoId: number
  restaurante: string
  onGuardado: () => void
  onCerrar: () => void
}) {
  const [estrellas, setEstrellas] = useState(0)
  const [comentario, setComentario] = useState('')
  const [fotoUrls, setFotoUrls] = useState<string[]>([])
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function agregarFotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setSubiendoFoto(true)
    try {
      const restantes = 6 - fotoUrls.length
      const subidas = await Promise.all(
        Array.from(files).slice(0, restantes).map(f => subirFotoReviewExpress(f))
      )
      setFotoUrls(prev => [...prev, ...subidas])
    } catch (e: any) {
      setError(e.message ?? 'No se pudo subir la foto')
    } finally {
      setSubiendoFoto(false)
    }
  }

  async function enviar() {
    if (estrellas === 0) { setError('Elige una calificación'); return }
    setEnviando(true)
    try {
      await crearReviewExpress(pedidoId, estrellas, comentario.trim() || undefined, fotoUrls)
      onGuardado()
    } catch (e: any) {
      setError(e.message ?? 'Error al enviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}
    >
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#1A1A1A] text-lg">Califica tu pedido</h2>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xl">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{restaurante}</p>

        <div className="flex justify-center mb-4">
          <EstrellaRating valor={estrellas} onChange={setEstrellas} tamaño="lg" />
        </div>

        <textarea
          rows={3}
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          placeholder="Cuéntanos tu experiencia (opcional)"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none"
        />

        <div className="mt-3">
          <label className="text-xs text-gray-500 block mb-1.5">Fotos (opcional)</label>
          <div className="flex flex-wrap gap-2">
            {fotoUrls.map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto ya subida a Cloudinary */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setFotoUrls(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]"
                >×</button>
              </div>
            ))}
            {fotoUrls.length < 6 && (
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 cursor-pointer flex-shrink-0">
                {subiendoFoto ? (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                )}
                <input type="file" accept="image/*" multiple className="hidden" disabled={subiendoFoto}
                  onChange={e => { agregarFotos(e.target.files); e.target.value = '' }} />
              </label>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <button
          onClick={enviar}
          disabled={enviando || estrellas === 0}
          className="mt-4 w-full bg-[#1B4332] text-white rounded-2xl py-3 font-bold text-sm disabled:opacity-40"
        >
          {enviando ? 'Enviando...' : 'Publicar reseña'}
        </button>
      </div>
    </div>
  )
}

function TarjetaPedido({
  pedido,
  onActualizar,
}: {
  pedido: PedidoExpress
  onActualizar: () => void
}) {
  const info = ESTADO_INFO[pedido.estado] ?? { label: pedido.estado, color: 'bg-gray-100 text-gray-600', paso: -1 }
  const activo = !['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(pedido.estado)
  const [expandido, setExpandido] = useState(activo)
  const [mostrarReview, setMostrarReview] = useState(false)
  const [mostrarReporte, setMostrarReporte] = useState(false)
  const yaResenado = !!(pedido as any).review

  const modalidadLabel =
    pedido.modalidad === 'DOMICILIO' ? 'Domicilio' :
    pedido.modalidad === 'MESA' ? 'Mesa' : 'Recoger'

  return (
    <>
      <div className={`bg-white rounded-2xl shadow-sm border-l-4 transition-all ${
        activo ? 'border-green-500' : 'border-gray-200'
      }`}>
        {/* Cabecera siempre visible */}
        <button
          className="w-full text-left p-4"
          onClick={() => setExpandido(v => !v)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-[#1A1A1A] truncate">
                {pedido.configExpress?.comercio.nombre ?? `Pedido #${pedido.id}`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(pedido.creadoAt).toLocaleDateString('es-CO', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${info.color}`}>
                {info.label}
              </span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className={`text-gray-400 transition-transform ${expandido ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
          </div>

          {/* Resumen compacto cuando cerrado */}
          {!expandido && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-500">
                {pedido.items.length} producto{pedido.items.length !== 1 ? 's' : ''}
              </span>
              <span className="font-bold text-[#1A1A1A]">{formatearPrecio(Number(pedido.total))}</span>
            </div>
          )}
        </button>

        {/* Detalle expandido */}
        {expandido && (
          <div className="px-4 pb-4 space-y-3">
            {/* Barra de progreso */}
            {activo && (
              <>
                <BarraProgreso estado={pedido.estado} />
                {(pedido.tiempoAjustadoMin ?? pedido.tiempoEstimadoMin) > 0 && (
                  <p className="text-xs text-gray-500 -mt-1">
                    ⏱ Tiempo estimado: ~{pedido.tiempoAjustadoMin ?? pedido.tiempoEstimadoMin} min
                    {' '}(llega ~{new Date(new Date(pedido.creadoAt).getTime() + (pedido.tiempoAjustadoMin ?? pedido.tiempoEstimadoMin) * 60_000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})
                  </p>
                )}
              </>
            )}

            {/* Modalidad + dirección */}
            {pedido.direccionTexto && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Entrega en: {pedido.direccionTexto}
              </p>
            )}

            {/* Pedido programado */}
            {pedido.fechaProgramada && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                🕐 Programado para {new Date(pedido.fechaProgramada).toLocaleString('es-CO', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}

            {/* Items con complementos */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-50">
                {pedido.items.map(item => {
                  const extras: Array<{ nombre: string; precio: number }> =
                    Array.isArray(item.complementos)
                      ? (item.complementos as Array<{ nombre: string; precio: number }>)
                      : []
                  return (
                    <div key={item.id} className="px-3 py-2.5">
                      <div className="flex justify-between items-baseline gap-2">
                        <p className="text-sm font-medium text-gray-800">
                          {item.cantidad}x {item.producto?.nombre ?? `Producto #${item.productoId}`}
                        </p>
                        <span className="text-sm text-gray-700 flex-shrink-0">
                          {formatearPrecio(Number(item.subtotal))}
                        </span>
                      </div>
                      {extras.length > 0 && (
                        <div className="mt-1 space-y-0.5 pl-3">
                          {extras.map((c, ci) => (
                            <div key={ci} className="flex justify-between text-xs text-gray-400">
                              <span>+ {c.nombre}</span>
                              {Number(c.precio) > 0 && (
                                <span>+{formatearPrecio(Number(c.precio))}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-between text-sm font-bold text-[#1B4332]">
                <span>Total</span>
                <span>{formatearPrecio(Number(pedido.total))}</span>
              </div>
            </div>

            {/* Metodo y modalidad */}
            <p className="text-xs text-gray-400 text-right">
              {modalidadLabel} &middot; {pedido.metodoPago === 'EFECTIVO' ? 'Efectivo' : pedido.metodoPago}
            </p>

            {/* Nota del cliente */}
            {pedido.notaCliente && (
              <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
                Nota: {pedido.notaCliente}
              </p>
            )}

            {/* Acciones post-entrega */}
            {pedido.estado === 'ENTREGADO' && (
              <div className="flex gap-2 pt-1">
                {!yaResenado && (
                  <button
                    onClick={() => setMostrarReview(true)}
                    className="flex-1 text-center text-xs font-semibold text-[#1B4332] border border-[#2D6A4F] rounded-xl py-2 hover:bg-[#2D6A4F]/5 transition-colors"
                  >
                    Calificar pedido
                  </button>
                )}
                {yaResenado && (
                  <p className="flex-1 text-center text-xs text-green-600 font-medium py-2">
                    Ya calificaste este pedido
                  </p>
                )}
                {pedido.configExpress && (
                  <Link
                    href={`/express/${pedido.comercioId ?? ''}?reorder=${pedido.id}`}
                    className="flex-1 text-center text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
                  >
                    Pedir de nuevo
                  </Link>
                )}
                <button
                  onClick={() => setMostrarReporte(true)}
                  className="flex-1 text-center text-xs font-semibold text-[#C0392B] border border-[#C0392B]/30 rounded-xl py-2 hover:bg-[#C0392B]/5 transition-colors"
                >
                  Reportar un problema
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {mostrarReview && (
        <ModalReview
          pedidoId={pedido.id}
          restaurante={pedido.configExpress?.comercio.nombre ?? 'Restaurante'}
          onGuardado={() => { setMostrarReview(false); onActualizar() }}
          onCerrar={() => setMostrarReview(false)}
        />
      )}

      {mostrarReporte && (
        <ModalReportarProblema
          moduloOrigen="EXPRESS"
          referenciaId={pedido.id}
          onCerrar={() => setMostrarReporte(false)}
          onExito={() => setMostrarReporte(false)}
        />
      )}
    </>
  )
}

export default function MisPedidosExpressPage() {
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoExpress[]>([])
  const [cargando, setCargando] = useState(true)
  const sseRef = useRef<EventSource | null>(null)
  const { mostrar: mostrarToast, toastProps } = useToast(3500)

  async function cargar() {
    const data = await misPedidosExpress()
    setPedidos(data)
    setCargando(false)
  }

  useEffect(() => {
    if (cargandoAuth) return
    if (!autenticado) { router.push('/ingresar'); return }
    cargar()
  }, [autenticado, cargandoAuth, router])

  useEffect(() => {
    if (!autenticado) return
    const token = obtenerToken()
    if (!token) return
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
    const es = new EventSource(`${API}/notificaciones/stream?token=${encodeURIComponent(token)}`)
    sseRef.current = es
    es.addEventListener('notificacion', (e) => {
      try {
        const notif = JSON.parse((e as MessageEvent).data)
        if (notif?.tipo?.startsWith('EXPRESS_') || notif?.url?.includes('mis-pedidos')) {
          cargar()
          if (notif?.titulo || notif?.mensaje) mostrarToast(notif.titulo || notif.mensaje)
        }
      } catch {}
    })
    return () => { es.close(); sseRef.current = null }
  }, [autenticado])

  const activos = pedidos.filter(p => !['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(p.estado))
  const anteriores = pedidos.filter(p => ['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(p.estado))

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/express" className="text-[#2D6A4F] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A] text-lg">Mis pedidos Express</h1>
          {activos.length > 0 && (
            <span className="ml-auto bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {activos.length} activo{activos.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-10">
        {pedidos.length === 0 ? (
          <div className="text-center py-16 text-[#999]">
            <p className="text-4xl mb-3">🛵</p>
            <p className="font-medium">Aun no tienes pedidos Express</p>
            <Link href="/express" className="mt-4 inline-block text-[#2D6A4F] underline text-sm">
              Ver restaurantes
            </Link>
          </div>
        ) : (
          <>
            {activos.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">En curso</h2>
                <div className="space-y-3">
                  {activos.map(p => <TarjetaPedido key={p.id} pedido={p} onActualizar={cargar} />)}
                </div>
              </section>
            )}
            {anteriores.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Anteriores</h2>
                <div className="space-y-3">
                  {anteriores.map(p => <TarjetaPedido key={p.id} pedido={p} onActualizar={cargar} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Toast {...toastProps} />
    </div>
  )
}
