'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'
import { BadgeEstado } from '@/components/checkout/estadoPedido'
import type { PedidoDetalle } from '@/components/checkout/tiposPedido'

/**
 * Extrae el array de pedidos tolerando: array directo, { data }, { data: { items } },
 * { items } o { pedidos }.
 */
function extraerPedidos(raw: unknown): PedidoDetalle[] {
  if (Array.isArray(raw)) return raw as PedidoDetalle[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const data = 'data' in obj ? obj.data : obj
    if (Array.isArray(data)) return data as PedidoDetalle[]
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      if (Array.isArray(d.items)) return d.items as PedidoDetalle[]
      if (Array.isArray(d.pedidos)) return d.pedidos as PedidoDetalle[]
    }
  }
  return []
}

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
        setPedidos(extraerPedidos(raw))
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No pudimos cargar tus pedidos.')
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [autenticado, cargandoAuth])

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-6 pb-10">
        <h1
          className="text-2xl md:text-3xl text-[#1A1A1A] mb-6"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Mis pedidos
        </h1>

        {cargando || cargandoAuth ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white border border-[#1A1A1A]/5 p-6 text-center">
            <p className="text-sm text-[#C0392B] mb-4">{error}</p>
            <Button variant="secondary" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/5">
            <EmptyState
              titulo="Aún no tienes pedidos"
              descripcion="Cuando hagas tu primera compra, la verás aquí con su estado."
            />
            <div className="flex justify-center pb-10">
              <Link href="/">
                <Button>Explorar productos</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pedidos.map((p) => {
              const total = p.total ?? p.subtotal ?? 0
              const n = contarItems(p)
              return (
                <li key={String(p.id)}>
                  <Link
                    href={`/pedido/${p.id}`}
                    className="block rounded-2xl bg-white border border-[#1A1A1A]/5 p-4 hover:border-[#2D6A4F]/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1A1A1A]">
                          Pedido PED-{String(p.id)}
                        </p>
                        <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
                          {fechaLegible(p.creadoEn)}
                          {n > 0 ? ` · ${n} ${n === 1 ? 'producto' : 'productos'}` : ''}
                        </p>
                      </div>
                      <BadgeEstado estado={p.estado} />
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1A1A1A]/5">
                      <span className="text-sm text-[#1A1A1A]/50">Total</span>
                      <span className="font-bold text-[#2D6A4F]">
                        {formatearPrecio(total)}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  )
}
