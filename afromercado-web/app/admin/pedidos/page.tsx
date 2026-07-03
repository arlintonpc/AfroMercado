'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  listarPedidosAdmin,
  type EstadoPedido,
  type AdminPedidoResumen,
} from '@/components/admin/api'

// ── Helpers ───────────────────────────────────────────────────

const TODOS_LOS_ESTADOS: EstadoPedido[] = [
  'PENDIENTE_PAGO',
  'VERIFICANDO_PAGO',
  'PAGO_FALLIDO',
  'CONFIRMADO',
  'CANCELADO',
  'EXPIRADO',
  'ENTREGADO',
]

const LABEL_ESTADO: Record<EstadoPedido, string> = {
  PENDIENTE_PAGO:   'Pendiente de pago',
  VERIFICANDO_PAGO: 'Verificando pago',
  PAGO_FALLIDO:     'Pago fallido',
  CONFIRMADO:       'Confirmado',
  CANCELADO:        'Cancelado',
  EXPIRADO:         'Expirado',
  ENTREGADO:        'Entregado',
}

const COLOR_ESTADO: Record<EstadoPedido, string> = {
  PENDIENTE_PAGO:   'bg-[#D4A017]/15 text-[#9B7300]',
  VERIFICANDO_PAGO: 'bg-blue-100 text-blue-700',
  PAGO_FALLIDO:     'bg-red-100 text-red-600',
  CONFIRMADO:       'bg-[#D4A017]/15 text-[#9B7300]',
  CANCELADO:        'bg-red-100 text-red-600',
  EXPIRADO:         'bg-red-100 text-red-600',
  ENTREGADO:        'bg-[#52B788]/15 text-[#2D6A4F]',
}

function BadgeEstado({ estado }: { estado: EstadoPedido }) {
  return (
    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${COLOR_ESTADO[estado]}`}>
      {LABEL_ESTADO[estado]}
    </span>
  )
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Esqueleto de carga ────────────────────────────────────────

function FilaEsqueleto() {
  return (
    <tr className="border-b border-[#1A1A1A]/5">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[#1A1A1A]/8 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

// ── Vista de tarjeta (móvil, < md) ─────────────────────────────

function TarjetaPedidoMovil({ p }: { p: AdminPedidoResumen }) {
  return (
    <div className="border-b border-[#1A1A1A]/5 last:border-0 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <code className="text-xs font-bold bg-[#F8F5F0] border border-[#1A1A1A]/8 px-2 py-0.5 rounded-lg tracking-wide text-[#1A1A1A]">
            {p.codigo ?? `#${p.id}`}
          </code>
          <p className="mt-1.5 font-semibold text-[#1A1A1A] leading-tight">{p.comprador.nombre}</p>
          <p className="text-xs text-[#1A1A1A]/40 leading-tight">{p.comprador.email}</p>
        </div>
        <BadgeEstado estado={p.estado} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[#1A1A1A]/60">
        <span>{formatearFecha(p.createdAt)}</span>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F] font-bold">
          {p.subPedidos.length}
        </span>
        <span className="font-semibold text-[#2D6A4F]">{formatearPrecio(p.total)}</span>
      </div>
      <Link
        href={`/admin/pedidos/${p.id}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2D6A4F] hover:text-[#245a42] transition-colors"
      >
        Ver detalle →
      </Link>
    </div>
  )
}

function TarjetaEsqueleto() {
  return (
    <div className="border-b border-[#1A1A1A]/5 px-4 py-3">
      <div className="h-4 w-24 bg-[#1A1A1A]/8 rounded animate-pulse" />
      <div className="mt-2 h-4 w-40 bg-[#1A1A1A]/8 rounded animate-pulse" />
      <div className="mt-2 h-4 w-full bg-[#1A1A1A]/8 rounded animate-pulse" />
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function AdminPedidosPage() {
  const [items,    setItems]    = useState<AdminPedidoResumen[]>([])
  const [total,    setTotal]    = useState(0)
  const [pagina,   setPagina]   = useState(1)
  const [paginas,  setPaginas]  = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | ''>('')

  const cargar = useCallback(async (pag: number, estado: EstadoPedido | '') => {
    setCargando(true)
    setError(null)
    try {
      const res = await listarPedidosAdmin({
        page:   pag,
        limit:  20,
        estado: estado || undefined,
      })
      setItems(res.items)
      setTotal(res.total)
      setPagina(res.pagina)
      setPaginas(res.paginas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los pedidos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar(1, filtroEstado) }, [cargar, filtroEstado])

  function handleEstado(e: React.ChangeEvent<HTMLSelectElement>) {
    setFiltroEstado(e.target.value as EstadoPedido | '')
    setPagina(1)
  }

  function handlePagina(p: number) {
    setPagina(p)
    void cargar(p, filtroEstado)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Link href="/admin" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">
            ← Panel admin
          </Link>
          <h1
            className="text-3xl text-[#1A1A1A] mt-1"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Pedidos
          </h1>
          <p className="text-sm text-[#1A1A1A]/50 mt-0.5">
            {cargando ? 'Cargando…' : `${total} pedido${total !== 1 ? 's' : ''} en total`}
          </p>
        </div>

        {/* Filtro estado */}
        <div className="flex items-center gap-2">
          <label htmlFor="filtro-estado" className="text-xs font-semibold text-[#1A1A1A]/60">
            Estado:
          </label>
          <select
            id="filtro-estado"
            value={filtroEstado}
            onChange={handleEstado}
            className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          >
            <option value="">Todos</option>
            {TODOS_LOS_ESTADOS.map((e) => (
              <option key={e} value={e}>{LABEL_ESTADO[e]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Tarjetas (móvil, < md) */}
      <div className="md:hidden bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
        {cargando ? (
          <>{[1, 2, 3, 4, 5].map((i) => <TarjetaEsqueleto key={i} />)}</>
        ) : items.length === 0 ? (
          <p className="px-4 py-16 text-center text-base font-semibold text-[#1A1A1A]/40">
            No hay pedidos{filtroEstado ? ` con estado "${LABEL_ESTADO[filtroEstado]}"` : ''}.
          </p>
        ) : (
          items.map((p) => <TarjetaPedidoMovil key={p.id} p={p} />)
        )}
      </div>

      {/* Tabla (desktop/tablet, md+) */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
                <th className="px-4 py-3 text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide whitespace-nowrap">Código</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide whitespace-nowrap">Comprador</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide whitespace-nowrap text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide whitespace-nowrap text-center">SubPedidos</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide whitespace-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <>{[1, 2, 3, 4, 5].map((i) => <FilaEsqueleto key={i} />)}</>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <p className="text-base font-semibold text-[#1A1A1A]/40">
                      No hay pedidos{filtroEstado ? ` con estado "${LABEL_ESTADO[filtroEstado]}"` : ''}.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[#1A1A1A]/5 last:border-0 hover:bg-[#F8F5F0]/60 transition-colors"
                  >
                    {/* Código */}
                    <td className="px-4 py-3">
                      <code className="text-xs font-bold bg-[#F8F5F0] border border-[#1A1A1A]/8 px-2 py-0.5 rounded-lg tracking-wide text-[#1A1A1A]">
                        {p.codigo ?? `#${p.id}`}
                      </code>
                    </td>

                    {/* Comprador */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1A1A1A] leading-tight">{p.comprador.nombre}</p>
                      <p className="text-xs text-[#1A1A1A]/40 leading-tight mt-0.5">{p.comprador.email}</p>
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[#1A1A1A]/60">
                      {formatearFecha(p.createdAt)}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <BadgeEstado estado={p.estado} />
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-right font-semibold text-[#2D6A4F] whitespace-nowrap">
                      {formatearPrecio(p.total)}
                    </td>

                    {/* # SubPedidos */}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-bold">
                        {p.subPedidos.length}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/pedidos/${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2D6A4F] hover:text-[#245a42] transition-colors whitespace-nowrap"
                      >
                        Ver detalle →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación (compartida entre vista de tarjetas y de tabla) */}
      {paginas > 1 && (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-[#1A1A1A]/50">
            Página {pagina} de {paginas}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePagina(pagina - 1)}
              disabled={pagina <= 1 || cargando}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1A1A1A]/60 hover:text-[#1A1A1A] disabled:opacity-30 hover:bg-[#1A1A1A]/5 transition-colors"
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(paginas, 7) }, (_, i) => {
              const p = paginas <= 7 ? i + 1 : i + Math.max(1, pagina - 3)
              if (p > paginas) return null
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePagina(p)}
                  disabled={cargando}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    p === pagina
                      ? 'bg-[#2D6A4F] text-white'
                      : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => handlePagina(pagina + 1)}
              disabled={pagina >= paginas || cargando}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1A1A1A]/60 hover:text-[#1A1A1A] disabled:opacity-30 hover:bg-[#1A1A1A]/5 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
