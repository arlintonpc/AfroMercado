'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  obtenerPedidoAdmin,
  obtenerComprobanteObjectUrl,
  type AdminPedidoDetalle,
  type EstadoPedido,
} from '@/components/admin/api'

// ── Helpers ───────────────────────────────────────────────────

const LABEL_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  PENDIENTE_PAGO:   'Pendiente de pago',
  VERIFICANDO_PAGO: 'Verificando pago',
  PAGO_FALLIDO:     'Pago fallido',
  CONFIRMADO:       'Confirmado',
  CANCELADO:        'Cancelado',
  EXPIRADO:         'Expirado',
  ENTREGADO:        'Entregado',
}

const COLOR_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  PENDIENTE_PAGO:   'bg-[#D4A017]/15 text-[#9B7300]',
  VERIFICANDO_PAGO: 'bg-blue-100 text-blue-700',
  PAGO_FALLIDO:     'bg-red-100 text-red-600',
  CONFIRMADO:       'bg-[#D4A017]/15 text-[#9B7300]',
  CANCELADO:        'bg-red-100 text-red-600',
  EXPIRADO:         'bg-red-100 text-red-600',
  ENTREGADO:        'bg-[#52B788]/15 text-[#2D6A4F]',
}

const LABEL_ESTADO_SUBPEDIDO: Record<string, string> = {
  CONFIRMADO:     'Confirmado',
  EN_PREPARACION: 'En preparación',
  LISTO:          'Listo',
  EN_CAMINO:      'En camino',
  ENTREGADO:      'Entregado',
  CANCELADO:      'Cancelado',
}

const COLOR_ESTADO_SUBPEDIDO: Record<string, string> = {
  CONFIRMADO:     'bg-[#D4A017]/15 text-[#9B7300]',
  EN_PREPARACION: 'bg-orange-100 text-orange-700',
  LISTO:          'bg-purple-100 text-purple-700',
  EN_CAMINO:      'bg-blue-100 text-blue-700',
  ENTREGADO:      'bg-[#52B788]/15 text-[#2D6A4F]',
  CANCELADO:      'bg-red-100 text-red-600',
}

const LABEL_METODO_PAGO: Record<string, string> = {
  NEQUI:         'Nequi',
  DAVIPLATA:     'Daviplata',
  TRANSFERENCIA: 'Transferencia bancaria',
  EFECTIVO:      'Efectivo',
}

const LABEL_ESTADO_PAGO: Record<string, string> = {
  PENDIENTE:    'Pendiente',
  VERIFICANDO:  'Verificando',
  CONFIRMADO:   'Confirmado',
  FALLIDO:      'Fallido',
  REEMBOLSADO:  'Reembolsado',
}

const COLOR_ESTADO_PAGO: Record<string, string> = {
  PENDIENTE:   'bg-[#D4A017]/15 text-[#9B7300]',
  VERIFICANDO: 'bg-blue-100 text-blue-700',
  CONFIRMADO:  'bg-[#52B788]/15 text-[#2D6A4F]',
  FALLIDO:     'bg-red-100 text-red-600',
  REEMBOLSADO: 'bg-purple-100 text-purple-700',
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Componente comprobante ────────────────────────────────────

function Comprobante({ pagoId }: { pagoId: number }) {
  const [url,      setUrl]      = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState(false)

  async function cargar() {
    setCargando(true)
    setError(false)
    try {
      const u = await obtenerComprobanteObjectUrl(String(pagoId))
      setUrl(u)
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }

  // Revocar object URL al desmontar
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  if (url) {
    return (
      <div className="mt-2">
        <img src={url} alt="Comprobante de pago" className="max-h-64 rounded-xl border border-[#1A1A1A]/10 object-contain" />
        <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-[#2D6A4F] hover:underline">
          Abrir en nueva pestaña
        </a>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={cargar}
      disabled={cargando}
      className="mt-1 text-xs font-semibold text-[#2D6A4F] hover:underline disabled:opacity-50"
    >
      {cargando ? 'Cargando comprobante…' : error ? 'Error al cargar — reintentar' : 'Ver comprobante'}
    </button>
  )
}

// ── Sección card ──────────────────────────────────────────────

function Card({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
      {titulo && (
        <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
          <h2 className="text-sm font-bold text-[#1A1A1A]">{titulo}</h2>
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#1A1A1A]/50 mb-0.5">{label}</p>
      <div className="text-sm text-[#1A1A1A]">{children}</div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function AdminPedidoDetallePage() {
  const params = useParams()
  const id = Number(params?.id)

  const [pedido,   setPedido]   = useState<AdminPedidoDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      setCargando(true)
      setError(null)
      try {
        const data = await obtenerPedidoAdmin(id)
        setPedido(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar el pedido.')
      } finally {
        setCargando(false)
      }
    })()
  }, [id])

  // ── Cargando ──
  if (cargando) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-64 bg-[#1A1A1A]/8 rounded-xl animate-pulse" />
        <div className="h-40 bg-[#1A1A1A]/5 rounded-2xl animate-pulse" />
        <div className="h-64 bg-[#1A1A1A]/5 rounded-2xl animate-pulse" />
      </div>
    )
  }

  // ── Error ──
  if (error || !pedido) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/admin/pedidos" className="text-sm text-[#2D6A4F] hover:underline">
          ← Volver a pedidos
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error ?? 'Pedido no encontrado.'}
        </div>
      </div>
    )
  }

  const estadoPedido = pedido.estado as EstadoPedido

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div>
        <Link href="/admin/pedidos" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">
          ← Volver a pedidos
        </Link>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <h1
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            {pedido.codigo ?? `Pedido #${pedido.id}`}
          </h1>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${COLOR_ESTADO_PEDIDO[estadoPedido]}`}>
            {LABEL_ESTADO_PEDIDO[estadoPedido]}
          </span>
        </div>
        <p className="text-xs text-[#1A1A1A]/40 mt-1">
          Creado el {formatearFecha(pedido.createdAt)}
        </p>
      </div>

      {/* Datos del comprador y dirección */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card titulo="Comprador">
          <div className="flex flex-col gap-3">
            <Campo label="Nombre">{pedido.comprador.nombre}</Campo>
            <Campo label="Email">
              <a href={`mailto:${pedido.comprador.email}`} className="text-[#2D6A4F] hover:underline">
                {pedido.comprador.email}
              </a>
            </Campo>
            {pedido.comprador.telefono && (
              <Campo label="Teléfono">
                <a href={`tel:${pedido.comprador.telefono}`} className="text-[#2D6A4F] hover:underline">
                  {pedido.comprador.telefono}
                </a>
              </Campo>
            )}
          </div>
        </Card>

        <Card titulo="Dirección de entrega">
          <p className="text-sm text-[#1A1A1A]">{pedido.direccionTexto}</p>
          {pedido.notas && (
            <p className="mt-2 text-xs text-[#1A1A1A]/50 italic">Nota: {pedido.notas}</p>
          )}
        </Card>
      </div>

      {/* SubPedidos */}
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-[#1A1A1A]">
          SubPedidos ({pedido.subPedidos.length})
        </h2>

        {pedido.subPedidos.map((sp) => (
          <Card key={sp.id}>
            {/* Cabecera del subpedido */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">{sp.comercio.nombre}</p>
                <p className="text-xs text-[#1A1A1A]/50">{sp.comercio.municipio}</p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${COLOR_ESTADO_SUBPEDIDO[sp.estado] ?? 'bg-[#1A1A1A]/10 text-[#1A1A1A]/50'}`}>
                {LABEL_ESTADO_SUBPEDIDO[sp.estado] ?? sp.estado}
              </span>
            </div>

            {/* Items */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1A1A1A]/5 text-xs text-[#1A1A1A]/50">
                    <th className="pb-2 text-left font-semibold">Producto</th>
                    <th className="pb-2 text-center font-semibold">Cant.</th>
                    <th className="pb-2 text-right font-semibold">Precio unit.</th>
                    <th className="pb-2 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sp.items.map((item) => (
                    <tr key={item.id} className="border-b border-[#1A1A1A]/4 last:border-0">
                      <td className="py-2 pr-2 text-[#1A1A1A] font-medium">{item.producto.nombre}</td>
                      <td className="py-2 text-center text-[#1A1A1A]/70">{item.cantidad}</td>
                      <td className="py-2 text-right text-[#1A1A1A]/70 whitespace-nowrap">{formatearPrecio(item.precioUnitario)}</td>
                      <td className="py-2 text-right font-semibold text-[#1A1A1A] whitespace-nowrap">{formatearPrecio(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales del subpedido */}
            <div className="border-t border-[#1A1A1A]/5 pt-3 flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#1A1A1A]/50">Subtotal comercio</span>
                <span className="font-semibold">{formatearPrecio(sp.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#1A1A1A]/50">
                  Comisión AfroMercado
                  {sp.tasaComisionAplicada != null && (
                    <span className="ml-1 text-[#1A1A1A]/40">
                      ({(sp.tasaComisionAplicada * 100).toFixed(1)}%)
                    </span>
                  )}
                </span>
                <span className="font-semibold text-red-500">-{formatearPrecio(sp.comision)}</span>
              </div>
              <div className="flex justify-between font-semibold text-[#2D6A4F]">
                <span>Neto al comerciante</span>
                <span>{formatearPrecio(sp.neto)}</span>
              </div>
            </div>

            {/* Entrega si existe */}
            {sp.entrega && (
              <div className="mt-3 border-t border-[#1A1A1A]/5 pt-3 text-xs text-[#1A1A1A]/60">
                <p className="font-semibold text-[#1A1A1A]/70 mb-1">Entrega</p>
                <p>Estado: <span className="font-semibold text-[#1A1A1A]">{sp.entrega.estado}</span></p>
                <p className="mt-0.5">Dirección: {sp.entrega.direccion}</p>
                {sp.entrega.notas && <p className="mt-0.5 italic">Nota: {sp.entrega.notas}</p>}
              </div>
            )}

            {sp.notas && (
              <p className="mt-2 text-xs text-[#1A1A1A]/50 italic border-t border-[#1A1A1A]/5 pt-2">
                Nota del comercio: {sp.notas}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Pagos */}
      <Card titulo="Pagos">
        {pedido.pagos.length === 0 ? (
          <p className="text-sm text-[#1A1A1A]/40">No hay pagos registrados.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {pedido.pagos.map((pago) => (
              <div key={pago.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {LABEL_METODO_PAGO[pago.metodo] ?? pago.metodo}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${COLOR_ESTADO_PAGO[pago.estado] ?? 'bg-[#1A1A1A]/10 text-[#1A1A1A]/50'}`}>
                    {LABEL_ESTADO_PAGO[pago.estado] ?? pago.estado}
                  </span>
                  <span className="text-sm font-semibold text-[#2D6A4F] ml-auto">
                    {formatearPrecio(pago.monto)}
                  </span>
                </div>
                <div className="text-xs text-[#1A1A1A]/50 flex flex-col gap-0.5">
                  <span>Registrado: {formatearFecha(pago.createdAt)}</span>
                  {pago.verificadoAt && (
                    <span>Verificado: {formatearFecha(pago.verificadoAt)}</span>
                  )}
                  {pago.referencia && <span>Referencia: {pago.referencia}</span>}
                  {pago.notas && <span>Notas: {pago.notas}</span>}
                </div>
                {pago.comprobanteUrl && <Comprobante pagoId={pago.id} />}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Resumen financiero del pedido */}
      <Card titulo="Resumen del pedido">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#1A1A1A]/60">Subtotal productos</span>
            <span>{formatearPrecio(pedido.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#1A1A1A]/60">Costo de envío</span>
            <span>{formatearPrecio(pedido.costoEnvio)}</span>
          </div>
          {pedido.cuponDescuento != null && pedido.cuponDescuento > 0 && (
            <div className="flex justify-between text-[#2D6A4F]">
              <span>
                Descuento cupón
                {pedido.cupon && (
                  <code className="ml-1 text-xs bg-[#2D6A4F]/10 px-1.5 py-0.5 rounded font-bold">
                    {pedido.cupon.codigo}
                  </code>
                )}
              </span>
              <span>-{formatearPrecio(pedido.cuponDescuento)}</span>
            </div>
          )}
          <div className="flex justify-between text-[#1A1A1A]/60 text-xs">
            <span>Comisión total AfroMercado</span>
            <span>{formatearPrecio(pedido.comisionTotal)}</span>
          </div>
          <div className="border-t border-[#1A1A1A]/8 mt-1 pt-2 flex justify-between font-bold text-base">
            <span>Total pagado</span>
            <span className="text-[#2D6A4F]">{formatearPrecio(pedido.total)}</span>
          </div>
        </div>
      </Card>

      {/* Botón volver */}
      <div>
        <Link
          href="/admin/pedidos"
          className="inline-flex items-center gap-2 border border-[#1A1A1A]/10 hover:border-[#2D6A4F]/30 text-sm font-semibold text-[#1A1A1A]/60 hover:text-[#2D6A4F] px-4 py-2 rounded-xl transition-colors"
        >
          ← Volver a pedidos
        </Link>
      </div>
    </div>
  )
}
