'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import BotonExportar from '@/components/reportes/BotonExportar'

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Resumen {
  ventas: number; subtotal: number; comision: number; neto: number
  conCupon: number; ticketPromedio: number
}

interface ItemVenta {
  id: number; cantidad: number; precioUnitario: number; subtotal: number
  producto: { nombre: string; fotoUrl?: string | null }
}

interface SubPedido {
  id: number; subtotal: number; comision: number; neto: number
  items: ItemVenta[]
  pedido: {
    id: number; codigo?: string; estado: string; createdAt: string
    cuponId?: number | null; direccionTexto?: string | null
    comprador?: { nombre: string; telefono?: string | null; email: string }
  }
}

interface VentasData { subPedidos: SubPedido[]; total: number; paginas: number; pagina: number }

const ESTADO_BADGE: Record<string, string> = {
  CONFIRMADO:        'bg-[#52B788]/15 text-[#2D6A4F]',
  ENTREGADO:         'bg-[#2D6A4F]/20 text-[#1a4530]',
  PENDIENTE_PAGO:    'bg-[#D4A017]/15 text-[#9B7300]',
  VERIFICANDO_PAGO:  'bg-[#D4A017]/15 text-[#9B7300]',
  EN_PREPARACION:    'bg-blue-50 text-blue-700',
  LISTO:             'bg-indigo-50 text-indigo-700',
  EN_CAMINO:         'bg-purple-50 text-purple-700',
  CANCELADO:         'bg-red-50 text-red-600',
}
const ESTADO_LABEL: Record<string, string> = {
  CONFIRMADO: 'Confirmado', ENTREGADO: 'Entregado', PENDIENTE_PAGO: 'Pendiente',
  VERIFICANDO_PAGO: 'Verificando', EN_PREPARACION: 'Preparando',
  LISTO: 'Listo', EN_CAMINO: 'En camino', CANCELADO: 'Cancelado',
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Componente interno (usa useSearchParams → requiere Suspense) ─────────────
function Contenido() {
  const params = useSearchParams()
  const hoy    = new Date()
  const ini    = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const desde  = params.get('desde') ?? ini
  const hasta  = params.get('hasta') ?? hoy.toISOString().slice(0, 10)
  const cupon  = params.get('cupon') ?? ''

  const [resumen, setResumen]   = useState<Resumen | null>(null)
  const [ventas, setVentas]     = useState<VentasData | null>(null)
  const [pagina, setPagina]     = useState(1)
  const [cargando, setCargando] = useState(true)
  const [expandido, setExpandido] = useState<number | null>(null)

  const cargar = useCallback(async (pag = 1) => {
    setCargando(true)
    try {
      const qs = new URLSearchParams({ desde, hasta, pagina: String(pag), porPagina: '20' })
      if (cupon) qs.set('cupon', cupon)
      const [r, v] = await Promise.all([
        apiFetch<{ ok: boolean; data: Resumen }>(`/reportes/comercio/resumen?desde=${desde}&hasta=${hasta}${cupon ? `&cupon=${cupon}` : ''}`),
        apiFetch<{ ok: boolean; data: VentasData }>(`/reportes/comercio/ventas?${qs}`),
      ])
      setResumen(r?.data ?? null)
      setVentas(v?.data ?? null)
      setPagina(pag)
    } catch { /**/ } finally { setCargando(false) }
  }, [desde, hasta, cupon])

  useEffect(() => { cargar(1) }, [cargar])

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div>
        <Link href="/comerciante/dashboard" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">← Panel</Link>
        <h1 className="text-3xl text-[#1A1A1A] mt-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Reporte de ventas
        </h1>
        <p className="text-sm text-[#1A1A1A]/50 mt-0.5">Tus ventas confirmadas con filtros de fecha y exportación a Excel.</p>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FiltroFechas />
          <div className="ml-auto flex items-center gap-3">
            <select
              value={cupon}
              onChange={(e) => {
                const sp = new URLSearchParams(params.toString())
                if (e.target.value) sp.set('cupon', e.target.value)
                else sp.delete('cupon')
                window.history.replaceState(null, '', `?${sp}`)
                cargar(1)
              }}
              className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
            >
              <option value="">Todas las ventas</option>
              <option value="con">Solo con cupón</option>
              <option value="sin">Sin cupón</option>
            </select>
            <BotonExportar
              endpoint="/reportes/comercio/exportar"
              params={{ desde, hasta, cupon: cupon || undefined }}
              nombreBase="ventas"
            />
          </div>
        </div>
      </div>

      {/* KPI cards */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Ventas',      valor: resumen.ventas,        moneda: false },
            { label: 'Subtotal',    valor: resumen.subtotal,      moneda: true  },
            { label: 'Comisión',    valor: resumen.comision,      moneda: true  },
            { label: 'Tus ingresos',valor: resumen.neto,          moneda: true, verde: true },
            { label: 'Con cupón',   valor: resumen.conCupon,      moneda: false },
            { label: 'Ticket prom.',valor: resumen.ticketPromedio,moneda: true  },
          ].map((k) => (
            <div key={k.label} className={`rounded-2xl border px-4 py-3 ${k.verde ? 'bg-[#52B788]/10 border-[#52B788]/30' : 'bg-white border-[#1A1A1A]/8'}`}>
              <p className="text-xs text-[#1A1A1A]/50 font-medium">{k.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${k.verde ? 'text-[#2D6A4F]' : 'text-[#1A1A1A]'}`}>
                {k.moneda ? formatearPrecio(k.valor) : k.valor.toLocaleString('es-CO')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#1A1A1A]/60">
            {cargando ? 'Cargando…' : `${ventas?.total ?? 0} venta${ventas?.total !== 1 ? 's' : ''}`}
          </p>
          {(ventas?.total ?? 0) > 20 && (
            <p className="text-xs text-[#1A1A1A]/40">
              Mostrando {(pagina - 1) * 20 + 1}–{Math.min(pagina * 20, ventas!.total)} de {ventas!.total}
            </p>
          )}
        </div>

        {cargando ? (
          <div className="flex flex-col divide-y divide-[#1A1A1A]/5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse w-24"/>
                <div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse flex-1"/>
              </div>
            ))}
          </div>
        ) : !ventas?.subPedidos.length ? (
          <div className="px-5 py-16 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-base font-semibold text-[#1A1A1A]/50">Sin ventas en este periodo</p>
            <p className="text-sm text-[#1A1A1A]/30 mt-1">Prueba cambiando el rango de fechas.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]/5">
            {ventas.subPedidos.map((sp) => (
              <div key={sp.id} className="hover:bg-[#F8F5F0]/40 transition-colors">
                {/* Fila resumen */}
                <button
                  className="w-full px-5 py-3.5 flex flex-wrap items-center gap-4 text-left"
                  onClick={() => setExpandido(expandido === sp.id ? null : sp.id)}
                >
                  <div className="min-w-[120px]">
                    <p className="text-xs text-[#1A1A1A]/40">{fmtFecha(sp.pedido.createdAt)}</p>
                    <p className="text-sm font-mono font-semibold mt-0.5">{sp.pedido.codigo ?? `PED-${sp.pedido.id}`}</p>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{sp.pedido.comprador?.nombre}</p>
                    <p className="text-xs text-[#1A1A1A]/40">{sp.pedido.comprador?.telefono ?? sp.pedido.comprador?.email}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${ESTADO_BADGE[sp.pedido.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ESTADO_LABEL[sp.pedido.estado] ?? sp.pedido.estado}
                    </span>
                    {sp.pedido.cuponId && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">🎟 Cupón</span>
                    )}
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="text-xs text-[#1A1A1A]/40">{formatearPrecio(Number(sp.subtotal))}</p>
                    <p className="text-base font-bold text-[#2D6A4F]">{formatearPrecio(Number(sp.neto))}</p>
                  </div>
                  <svg
                    className={`flex-shrink-0 text-[#1A1A1A]/30 transition-transform ${expandido === sp.id ? 'rotate-180' : ''}`}
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {/* Detalle expandido */}
                {expandido === sp.id && (
                  <div className="px-5 pb-4 bg-[#F8F5F0]/60 border-t border-[#1A1A1A]/5">
                    <p className="text-xs font-semibold text-[#1A1A1A]/40 uppercase tracking-wide pt-3 mb-2">Productos</p>
                    <div className="flex flex-col gap-1.5">
                      {sp.items.map((it) => (
                        <div key={it.id} className="flex items-center gap-3 text-sm">
                          <span className="text-[#1A1A1A]/60 flex-1">{it.producto.nombre}</span>
                          <span className="text-[#1A1A1A]/40 text-xs">×{it.cantidad}</span>
                          <span className="text-xs text-[#1A1A1A]/50">{formatearPrecio(Number(it.precioUnitario))}/u</span>
                          <span className="font-semibold min-w-[80px] text-right">{formatearPrecio(Number(it.subtotal))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#1A1A1A]/5 grid grid-cols-3 gap-3 text-xs">
                      <div><p className="text-[#1A1A1A]/40">Subtotal bruto</p><p className="font-semibold">{formatearPrecio(Number(sp.subtotal))}</p></div>
                      <div><p className="text-[#1A1A1A]/40">Comisión (10%)</p><p className="font-semibold text-red-500">−{formatearPrecio(Number(sp.comision))}</p></div>
                      <div><p className="text-[#1A1A1A]/40">Tus ingresos</p><p className="font-bold text-[#2D6A4F]">{formatearPrecio(Number(sp.neto))}</p></div>
                    </div>
                    {sp.pedido.cuponId && (
                      <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200">
                        🎟 Este pedido usó un cupón. El descuento se aplicó al total de la orden; tu neto se calculó sobre el subtotal de tus productos.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {(ventas?.paginas ?? 0) > 1 && (
          <div className="px-5 py-3 border-t border-[#1A1A1A]/5 flex items-center justify-between">
            <button
              onClick={() => { const p = pagina - 1; cargar(p) }}
              disabled={pagina === 1 || cargando}
              className="text-xs px-3 py-1.5 border border-[#1A1A1A]/10 rounded-lg disabled:opacity-40 hover:bg-[#F8F5F0] transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-xs text-[#1A1A1A]/40">{pagina} / {ventas?.paginas}</span>
            <button
              onClick={() => { const p = pagina + 1; cargar(p) }}
              disabled={pagina >= (ventas?.paginas ?? 1) || cargando}
              className="text-xs px-3 py-1.5 border border-[#1A1A1A]/10 rounded-lg disabled:opacity-40 hover:bg-[#F8F5F0] transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Nota cupones */}
      <p className="text-xs text-[#1A1A1A]/40 text-center">
        El Excel incluye detalle completo de ítems. La columna «Tus ingresos» ya descuenta la comisión del 10%.
      </p>
    </div>
  )
}

export default function ReporteVentasPage() {
  return (
    <Suspense fallback={<div className="h-40 flex items-center justify-center text-[#1A1A1A]/40 text-sm">Cargando…</div>}>
      <Contenido />
    </Suspense>
  )
}
