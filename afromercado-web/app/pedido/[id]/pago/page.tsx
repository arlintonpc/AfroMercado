'use client'

import { use, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { apiFetch, obtenerToken } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'
import { useCarrito } from '@/context/CarritoContext'
import { Contador } from '@/components/checkout/Contador'
import { BotonCopiar } from '@/components/checkout/BotonCopiar'
import {
  desenvolver,
  type DatosPagoTransferencia,
  type MetodoPago,
  type PagoCreado,
  type PedidoDetalle,
} from '@/components/checkout/tiposPedido'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

const METODOS: { valor: MetodoPago; etiqueta: string; icono: string }[] = [
  { valor: 'NEQUI', etiqueta: 'Nequi', icono: '📱' },
  { valor: 'DAVIPLATA', etiqueta: 'Daviplata', icono: '💳' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia', icono: '🏦' },
  { valor: 'EFECTIVO', etiqueta: 'Efectivo', icono: '💵' },
]

function FilaDato({
  etiqueta,
  valor,
  copiable = false,
}: {
  etiqueta: string
  valor: string
  copiable?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-xs text-[#1A1A1A]/50">{etiqueta}</p>
        <p className="font-semibold text-[#1A1A1A] truncate">{valor}</p>
      </div>
      {copiable && <BotonCopiar texto={valor} />}
    </div>
  )
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [instrucciones, setInstrucciones] = useState<DatosPagoTransferencia | null>(null)
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Formulario
  const [metodo, setMetodo] = useState<MetodoPago>('NEQUI')
  const [referencia, setReferencia] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Protección de ruta.
  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace(`/ingresar?redirect=/pedido/${id}/pago`)
    }
  }, [cargandoAuth, autenticado, router, id])

  // Carga instrucciones + pedido.
  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setErrorCarga(null)
      try {
        const [rawInstr, rawPedido] = await Promise.all([
          apiFetch<unknown>(`/pagos/instrucciones/${id}`).catch(() => null),
          apiFetch<unknown>(`/pedidos/${id}`).catch(() => null),
        ])
        if (cancelado) return
        if (rawInstr) {
          setInstrucciones(desenvolver<DatosPagoTransferencia>(rawInstr))
        }
        if (rawPedido) {
          setPedido(desenvolver<PedidoDetalle>(rawPedido))
        }
        if (!rawInstr && !rawPedido) {
          setErrorCarga('No pudimos cargar la información de pago.')
        }
      } catch (e) {
        if (!cancelado) {
          setErrorCarga(
            e instanceof Error ? e.message : 'No pudimos cargar la información de pago.',
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

  // Limpieza del object URL del preview.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (f) {
      if (!f.type.startsWith('image/')) {
        setErrores((prev) => ({ ...prev, archivo: 'Sube una imagen del comprobante.' }))
        setArchivo(null)
        setPreviewUrl(null)
        return
      }
      setErrores((prev) => {
        const { archivo: _omit, ...rest } = prev
        void _omit
        return rest
      })
      setArchivo(f)
      setPreviewUrl(URL.createObjectURL(f))
    } else {
      setArchivo(null)
      setPreviewUrl(null)
    }
  }

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!referencia.trim()) {
      e.referencia =
        metodo === 'EFECTIVO'
          ? 'Indica una referencia (ej. acordado con el productor).'
          : 'Ingresa el número de referencia de tu transferencia.'
    }
    if (metodo !== 'EFECTIVO' && !archivo) {
      e.archivo = 'Adjunta el comprobante de tu pago.'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function yaPague(ev: React.FormEvent) {
    ev.preventDefault()
    setErrorEnvio(null)
    if (enviando) return
    if (!validar()) return

    setEnviando(true)
    try {
      // 1) Crear el pago.
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`

      const rawPago = await apiFetch<unknown>('/pagos', {
        method: 'POST',
        body: {
          pedidoId: id,
          metodo,
          referencia: referencia.trim(),
          idempotencyKey,
        },
      })
      const pago = desenvolver<PagoCreado>(rawPago)
      const pagoId = pago?.id

      // 2) Adjuntar comprobante (multipart) si hay archivo.
      if (archivo && pagoId !== undefined && pagoId !== null) {
        const fd = new FormData()
        fd.append('comprobante', archivo)
        const token = obtenerToken()
        const resp = await fetch(`${API_URL}/pagos/${pagoId}/comprobante`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        })
        if (!resp.ok) {
          let msg = 'No pudimos subir el comprobante.'
          try {
            const j = await resp.json()
            if (j?.error) msg = j.error
            else if (j?.message) msg = j.message
          } catch {
            // sin cuerpo
          }
          throw new Error(msg)
        }
      }

      // 3) Éxito → limpiar carrito y a la confirmación.
      try {
        await vaciar()
      } catch {
        // no bloquea la confirmación
      }
      router.replace(`/pedido/${id}`)
    } catch (err) {
      setErrorEnvio(
        err instanceof Error
          ? err.message
          : 'No pudimos registrar tu pago. Inténtalo de nuevo.',
      )
      setEnviando(false)
    }
  }

  const monto =
    instrucciones?.monto ?? pedido?.total ?? pedido?.subtotal ?? 0
  const refPago = instrucciones?.referencia ?? `PED-${id}`
  const expiresAt = pedido?.expiresAt ?? null

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
            Realiza tu pago
          </h1>
          <p className="text-sm text-[#1A1A1A]/50 mt-1">Pedido {refPago}</p>
        </div>

        {/* Contador */}
        {expiresAt && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-[#D4A017]/10 border border-[#D4A017]/25 px-4 py-3">
            <span className="text-sm text-[#1A1A1A]/70">Tiempo restante para pagar:</span>
            <Contador expiresAt={expiresAt} />
          </div>
        )}

        {cargando ? (
          <div className="skeleton h-72 w-full rounded-2xl" />
        ) : (
          <>
            {/* Mensaje de confianza */}
            <div className="mb-5 rounded-2xl bg-[#52B788]/10 border border-[#52B788]/25 p-4 flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-[#2D6A4F] text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-[#2D6A4F] text-sm">
                  Tu pago está protegido por AfroMercado
                </p>
                <p className="text-sm text-[#1A1A1A]/70 mt-0.5">
                  Verificamos tu pago antes de que los productores preparen tu pedido.
                  Máximo 2 horas. Así compras con tranquilidad.
                </p>
              </div>
            </div>

            {/* Monto + instrucciones de transferencia */}
            <section className="mb-5 rounded-2xl bg-white border border-[#1A1A1A]/5 p-5">
              <p className="text-sm text-[#1A1A1A]/60">Transfiere exactamente</p>
              <p className="text-4xl font-bold text-[#2D6A4F] mt-1">
                {formatearPrecio(monto)}
              </p>

              <div className="mt-4 divide-y divide-[#1A1A1A]/8">
                {instrucciones?.nequi && (
                  <FilaDato etiqueta="Nequi" valor={instrucciones.nequi} copiable />
                )}
                {instrucciones?.daviplata && (
                  <FilaDato etiqueta="Daviplata" valor={instrucciones.daviplata} copiable />
                )}
                <FilaDato etiqueta="Referencia del pedido" valor={refPago} copiable />
              </div>

              {!instrucciones?.nequi && !instrucciones?.daviplata && (
                <p className="mt-3 text-sm text-[#1A1A1A]/50">
                  Si no ves los datos de pago, contáctanos por WhatsApp y te ayudamos
                  a completar tu pago.
                </p>
              )}

              <p className="mt-4 text-xs text-[#1A1A1A]/50">
                Incluye la referencia <strong>{refPago}</strong> en tu transferencia
                para que podamos identificar tu pago más rápido.
              </p>
            </section>

            {/* Formulario "Ya pagué" */}
            <form
              onSubmit={yaPague}
              className="rounded-2xl bg-white border border-[#1A1A1A]/5 p-5"
              noValidate
            >
              <h2 className="font-bold text-[#1A1A1A] mb-4">Confirma tu pago</h2>

              {/* Método */}
              <fieldset>
                <legend className="text-sm font-semibold text-[#1A1A1A] mb-2">
                  ¿Cómo pagaste?
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {METODOS.map((m) => (
                    <button
                      key={m.valor}
                      type="button"
                      onClick={() => setMetodo(m.valor)}
                      aria-pressed={metodo === m.valor}
                      className={`min-h-[44px] rounded-xl border px-2 py-2 text-sm font-semibold flex flex-col items-center gap-0.5 transition-colors ${
                        metodo === m.valor
                          ? 'border-[#2D6A4F] bg-[#2D6A4F]/8 text-[#2D6A4F]'
                          : 'border-[#1A1A1A]/15 text-[#1A1A1A]/70 hover:border-[#2D6A4F]/40'
                      }`}
                    >
                      <span aria-hidden className="text-lg">{m.icono}</span>
                      {m.etiqueta}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Referencia */}
              <div className="mt-4">
                <Input
                  label="Número de referencia de tu transferencia"
                  name="referencia"
                  placeholder="Ej. M1234567 o el comprobante de tu app"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  error={errores.referencia}
                  hint="Lo encuentras en el comprobante de tu app de pago."
                />
              </div>

              {/* Comprobante */}
              <div className="mt-4">
                <p className="font-semibold text-sm text-[#1A1A1A] mb-2">
                  Comprobante de pago{metodo === 'EFECTIVO' ? ' (opcional)' : ''}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onArchivo}
                  className="hidden"
                  aria-label="Subir comprobante de pago"
                />

                {!previewUrl ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border-2 border-dashed border-[#1A1A1A]/20 hover:border-[#2D6A4F]/50 bg-[#F8F5F0] px-4 py-6 flex flex-col items-center gap-2 text-[#1A1A1A]/60 transition-colors"
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" />
                      <path d="M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm font-medium">Toca para subir una foto del comprobante</span>
                    <span className="text-xs text-[#1A1A1A]/40">JPG o PNG</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-[#1A1A1A]/10 bg-[#F8F5F0]">
                    <Image
                      src={previewUrl}
                      alt="Vista previa del comprobante"
                      width={400}
                      height={300}
                      unoptimized
                      className="w-full max-h-72 object-contain"
                    />
                    <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-[#1A1A1A]/8">
                      <span className="text-xs text-[#1A1A1A]/60 truncate max-w-[60%]">
                        {archivo?.name}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-semibold text-[#2D6A4F] hover:underline"
                        >
                          Cambiar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (previewUrl) URL.revokeObjectURL(previewUrl)
                            setArchivo(null)
                            setPreviewUrl(null)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                          className="text-xs font-semibold text-[#C0392B] hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {errores.archivo && (
                  <p role="alert" className="mt-1.5 text-sm text-[#C0392B]">
                    {errores.archivo}
                  </p>
                )}
              </div>

              {errorEnvio && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]"
                >
                  {errorEnvio}
                </div>
              )}

              <Button type="submit" loading={enviando} className="w-full mt-5">
                Ya pagué, enviar comprobante
              </Button>

              <p className="mt-3 text-center text-xs text-[#1A1A1A]/50">
                Al enviar, verificaremos tu pago y te avisaremos cuando esté confirmado.
              </p>
            </form>

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
