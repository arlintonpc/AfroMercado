'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'
import { useCarrito } from '@/context/CarritoContext'
import { Contador } from '@/components/checkout/Contador'
import {
  desenvolver,
  type PedidoDetalle,
} from '@/components/checkout/tiposPedido'

interface PagoDigital {
  id: number | string
  pedidoId: number | string
  monto: number
  estado: string
  proveedor?: string | null
  checkoutUrl?: string | null
  providerReference?: string | null
  providerStatus?: string | null
  expiraAt?: string | null
}

function crearIdempotencyKey(pedidoId: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `checkout-${pedidoId}-${crypto.randomUUID()}`
  }
  return `checkout-${pedidoId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function estadoLegible(pago: PagoDigital | null) {
  if (!pago) return 'Sin intento de pago'
  if (pago.estado === 'CONFIRMADO') return 'Pago confirmado'
  if (pago.estado === 'FALLIDO') return 'Pago fallido'
  if (pago.providerStatus) return pago.providerStatus
  return pago.estado
}

export default function PaginaPago({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const { vaciar } = useCarrito()

  const [pedido, setPedido] = useState<PedidoDetalle | null>(null)
  const [pago, setPago] = useState<PagoDigital | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorPago, setErrorPago] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace(`/ingresar?redirect=/pedido/${id}/pago`)
    }
  }, [cargandoAuth, autenticado, router, id])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setErrorCarga(null)
      try {
        const [rawPedido, rawPago] = await Promise.all([
          apiFetch<unknown>(`/pedidos/${id}`).catch(() => null),
          apiFetch<unknown>(`/pagos/pedido/${id}/estado`).catch(() => null),
        ])
        if (cancelado) return
        if (rawPedido) setPedido(desenvolver<PedidoDetalle>(rawPedido))
        if (rawPago) setPago(desenvolver<PagoDigital | null>(rawPago))
        if (!rawPedido) setErrorCarga('No pudimos cargar la informacion del pedido.')
      } catch (e) {
        if (!cancelado) {
          setErrorCarga(
            e instanceof Error ? e.message : 'No pudimos cargar la informacion de pago.',
          )
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

  async function iniciarPago() {
    setErrorPago(null)
    if (enviando) return

    const checkoutExistente = pago?.checkoutUrl
    if (checkoutExistente && pago.estado !== 'FALLIDO') {
      window.location.assign(checkoutExistente)
      return
    }

    setEnviando(true)
    try {
      const raw = await apiFetch<unknown>('/pagos/checkout', {
        method: 'POST',
        body: {
          pedidoId: id,
          idempotencyKey: crearIdempotencyKey(id),
        },
      })
      const nuevoPago = desenvolver<PagoDigital>(raw)
      setPago(nuevoPago)

      if (!nuevoPago.checkoutUrl) {
        throw new Error('La pasarela no devolvio una URL de pago.')
      }

      try {
        await vaciar()
      } catch {
        // El checkout ya vacia el carrito en backend; esto solo sincroniza la UI.
      }
      window.location.assign(nuevoPago.checkoutUrl)
    } catch (err) {
      setErrorPago(
        err instanceof Error
          ? err.message
          : 'No pudimos iniciar el pago digital. Intentalo de nuevo.',
      )
      setEnviando(false)
    }
  }

  const monto = pago?.monto ?? pedido?.total ?? pedido?.subtotal ?? 0
  const refPago = pago?.providerReference ?? pedido?.codigo ?? `PED-${id}`
  const expiresAt = pago?.expiraAt ?? pedido?.expiresAt ?? null
  const pagoConfirmado = pago?.estado === 'CONFIRMADO' || pedido?.estado === 'CONFIRMADO'

  if (cargandoAuth || !autenticado) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10">
          <div className="skeleton h-64 w-full rounded-2xl" />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-6 pb-10">
        <div className="mb-4">
          <h1
            className="text-2xl md:text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Pago seguro
          </h1>
          <p className="text-sm text-[#1A1A1A]/50 mt-1">Pedido {refPago}</p>
        </div>

        {expiresAt && !pagoConfirmado && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-[#D4A017]/10 border border-[#D4A017]/25 px-4 py-3">
            <span className="text-sm text-[#1A1A1A]/70">Tiempo restante para pagar:</span>
            <Contador expiresAt={expiresAt} />
          </div>
        )}

        {cargando ? (
          <div className="skeleton h-72 w-full rounded-2xl" />
        ) : (
          <>
            <section className="mb-5 rounded-2xl bg-[#2D6A4F] text-white p-5 overflow-hidden relative">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10" />
              <div className="absolute -right-4 bottom-4 h-16 w-16 rounded-full bg-[#D4A017]/30" />
              <p className="text-sm text-white/75">Total a pagar</p>
              <p className="text-4xl font-bold mt-1">{formatearPrecio(monto)}</p>
              <p className="mt-3 text-sm text-white/80 max-w-md">
                El pago se procesa por pasarela. Teravia no solicita comprobantes,
                no recibe transferencias manuales y solo confirma el pedido con respuesta
                oficial de la pasarela.
              </p>
            </section>

            <section className="mb-5 rounded-2xl bg-white border border-[#1A1A1A]/5 p-5">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-[#52B788]/15 text-[#2D6A4F]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h2 className="font-bold text-[#1A1A1A]">Compra protegida por pasarela</h2>
                  <p className="text-sm text-[#1A1A1A]/65 mt-1">
                    Puedes pagar con los medios digitales habilitados por el proveedor:
                    PSE, tarjetas y billeteras disponibles segun la pasarela.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {['PSE', 'Tarjeta', 'Billetera'].map((medio) => (
                  <div key={medio} className="rounded-xl border border-[#1A1A1A]/10 bg-[#F8F5F0] px-3 py-3 text-center">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{medio}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-[#1A1A1A]/5 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[#1A1A1A]/50">Estado del pago</p>
                  <p className="font-semibold text-[#1A1A1A]">{estadoLegible(pago)}</p>
                </div>
                {pago?.proveedor && (
                  <span className="rounded-full bg-[#2D6A4F]/10 px-3 py-1 text-xs font-semibold text-[#2D6A4F]">
                    {pago.proveedor}
                  </span>
                )}
              </div>

              {errorPago && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]"
                >
                  {errorPago}
                </div>
              )}

              {pagoConfirmado ? (
                <Link
                  href={`/pedido/${id}`}
                  className="mt-5 flex min-h-[48px] items-center justify-center rounded-xl bg-[#2D6A4F] px-5 py-3 text-center text-sm font-bold text-white"
                >
                  Ver pedido confirmado
                </Link>
              ) : (
                <Button type="button" loading={enviando} className="w-full mt-5" onClick={iniciarPago}>
                  {pago?.checkoutUrl && pago.estado !== 'FALLIDO'
                    ? 'Continuar en la pasarela'
                    : 'Pagar seguro ahora'}
                </Button>
              )}

              <p className="mt-3 text-center text-xs text-[#1A1A1A]/50">
                No subas comprobantes ni transfieras por fuera de Teravia.
              </p>
            </section>

            {errorCarga && (
              <p className="mt-4 text-center text-sm text-[#C0392B]">{errorCarga}</p>
            )}

            <p className="mt-6 text-center text-sm">
              <Link href={`/pedido/${id}`} className="text-[#2D6A4F] font-semibold hover:underline">
                Ver estado del pedido
              </Link>
            </p>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
