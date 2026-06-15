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

  const info = infoEstado(pedido.estado)
  const grupos = lineasDePedido(pedido)
  const total = pedido.total ?? pedido.subtotal ?? 0
  const direccion = pedido.direccionTexto ?? pedido.direccion
  const esPendiente =
    pedido.estado === 'PENDIENTE_PAGO' || pedido.estado === 'PENDIENTE'

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-6 pb-10">
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
            <span className="text-sm text-[#1A1A1A]/50">Pedido PED-{String(pedido.id)}</span>
            <BadgeEstado estado={pedido.estado} />
          </div>

          {esPendiente && (
            <Link href={`/pedido/${pedido.id}/pago`} className="inline-block mt-5">
              <Button>Realizar el pago</Button>
            </Link>
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
    </div>
  )
}
