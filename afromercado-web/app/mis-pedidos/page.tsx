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
  { label: 'Entregado' },
]

const PASO_IDX: Record<string, number> = {
  PENDIENTE_PAGO: 0,
  VERIFICANDO_PAGO: 1,
  CONFIRMADO: 2,
  ENTREGADO: 3,
}

function BarraProgreso({ estado }: { estado: string }) {
  const actual = PASO_IDX[estado] ?? -1
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

// ── Tarjeta de pedido ─────────────────────────────────────────

const ESTADOS_ACTIVOS = new Set(['PENDIENTE_PAGO', 'VERIFICANDO_PAGO', 'CONFIRMADO'])
const ESTADOS_INACTIVOS = new Set(['ENTREGADO', 'CANCELADO', 'EXPIRADO', 'PAGO_FALLIDO'])

function TarjetaPedido({ pedido }: { pedido: PedidoDetalle }) {
  const total = pedido.total ?? pedido.subtotal ?? 0
  const n = contarItems(pedido)
  const fecha = fechaLegible(pedido.creadoEn)
  const productores = (pedido.subPedidos ?? [])
    .map(g => nombreComercio(g))
    .filter(Boolean)
    .join(', ')

  const esPendiente = pedido.estado === 'PENDIENTE_PAGO'
  const inactivo = ESTADOS_INACTIVOS.has(pedido.estado)

  return (
    <div className={`bg-white rounded-2xl border p-5 transition-shadow hover:shadow-md ${
      inactivo ? 'border-[#1A1A1A]/5 opacity-65' : 'border-[#1A1A1A]/8'
    }`}>
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-[#1A1A1A]/40 font-semibold uppercase tracking-wide">
            PED-{String(pedido.id)}
          </p>
          {fecha && <p className="text-sm text-[#1A1A1A]/55 mt-0.5">{fecha}</p>}
        </div>
        <BadgeEstado estado={pedido.estado} />
      </div>

      {/* Barra de progreso */}
      {ESTADOS_ACTIVOS.has(pedido.estado) && <BarraProgreso estado={pedido.estado} />}

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
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1A1A1A]/5">
        <span className="text-lg font-bold text-[#2D6A4F]">{formatearPrecio(total)}</span>
        <Link href={`/pedido/${pedido.id}`}>
          <Button variant={esPendiente ? 'primary' : 'secondary'} size="sm">
            {esPendiente ? 'Pagar ahora' : 'Ver detalles'}
          </Button>
        </Link>
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
        setPedidos(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No pudimos cargar tus pedidos.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [autenticado, cargandoAuth])

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
                  {historial.map(p => <TarjetaPedido key={String(p.id)} pedido={p} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
