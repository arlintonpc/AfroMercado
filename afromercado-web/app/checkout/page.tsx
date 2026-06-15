'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { apiFetch } from '@/lib/api/client'
import { useCarrito } from '@/context/CarritoContext'
import { useAuth } from '@/context/AuthContext'
import { agruparPorComercio } from '@/components/carrito/agrupar'
import {
  desenvolver,
  type RespuestaCheckout,
} from '@/components/checkout/tiposPedido'

export default function PaginaCheckout() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth, usuario } = useAuth()
  const { items, subtotal, cantidadTotal, cargando: cargandoCarrito } = useCarrito()

  // Campos de dirección
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [barrio, setBarrio] = useState('')
  const [linea1, setLinea1] = useState('')
  const [referencia, setReferencia] = useState('')
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '')
  const [notas, setNotas] = useState('')

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const grupos = useMemo(() => agruparPorComercio(items), [items])

  // Protección de ruta: si no está autenticado, a /ingresar.
  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/checkout')
    }
  }, [cargandoAuth, autenticado, router])

  // Carrito vacío: de vuelta al carrito.
  useEffect(() => {
    if (!cargandoAuth && autenticado && !cargandoCarrito && items.length === 0) {
      router.replace('/carrito')
    }
  }, [cargandoAuth, autenticado, cargandoCarrito, items.length, router])

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!departamento.trim()) e.departamento = 'Indica el departamento.'
    if (!municipio.trim()) e.municipio = 'Indica el municipio o ciudad.'
    if (!linea1.trim()) e.linea1 = 'Indica la dirección.'
    const tel = telefono.replace(/\D/g, '')
    if (!tel) e.telefono = 'Indica un teléfono de contacto.'
    else if (tel.length !== 10) e.telefono = 'El celular debe tener 10 dígitos.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function construirDireccionTexto(): string {
    const partes = [
      linea1.trim(),
      barrio.trim() ? `Barrio ${barrio.trim()}` : '',
      municipio.trim(),
      departamento.trim(),
      referencia.trim() ? `Indicaciones: ${referencia.trim()}` : '',
      `Tel: ${telefono.replace(/\D/g, '')}`,
    ].filter(Boolean)
    return partes.join(', ')
  }

  async function confirmar(ev: React.FormEvent) {
    ev.preventDefault()
    setErrorGeneral(null)
    if (enviando) return
    if (!validar()) return

    setEnviando(true)
    try {
      const direccionTexto = construirDireccionTexto()
      const raw = await apiFetch<unknown>('/pedidos/checkout', {
        method: 'POST',
        body: {
          direccionTexto,
          ...(notas.trim() ? { notas: notas.trim() } : {}),
        },
      })
      const data = desenvolver<RespuestaCheckout>(raw)
      const id = data?.pedido?.id
      if (id === undefined || id === null) {
        throw new Error('No pudimos crear el pedido. Inténtalo de nuevo.')
      }
      router.replace(`/pedido/${id}/pago`)
    } catch (err) {
      setErrorGeneral(
        err instanceof Error
          ? err.message
          : 'No pudimos confirmar tu pedido. Inténtalo de nuevo.',
      )
      setEnviando(false)
    }
  }

  // Mientras valida auth / redirige.
  if (cargandoAuth || !autenticado) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-10">
          <div className="skeleton h-8 w-48 rounded mb-6" />
          <div className="skeleton h-64 w-full rounded-2xl" />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-6 pb-10">
        <h1
          className="text-2xl md:text-3xl text-[#1A1A1A] mb-6"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Confirmar pedido
        </h1>

        <form
          onSubmit={confirmar}
          className="md:grid md:grid-cols-[1fr_320px] md:gap-6 md:items-start"
          noValidate
        >
          {/* Columna izquierda: dirección + notas */}
          <div className="flex flex-col gap-5">
            <section className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-5">
              <h2 className="font-bold text-[#1A1A1A] mb-1">Dirección de entrega</h2>
              <p className="text-xs text-[#1A1A1A]/50 mb-4">
                El productor coordinará el envío contigo con estos datos.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Departamento"
                  name="departamento"
                  placeholder="Chocó"
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  error={errores.departamento}
                />
                <Input
                  label="Municipio / Ciudad"
                  name="municipio"
                  placeholder="Quibdó"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  error={errores.municipio}
                />
              </div>

              <div className="mt-4">
                <Input
                  label="Barrio (opcional)"
                  name="barrio"
                  placeholder="Tu barrio"
                  value={barrio}
                  onChange={(e) => setBarrio(e.target.value)}
                />
              </div>

              <div className="mt-4">
                <Input
                  label="Dirección"
                  name="linea1"
                  placeholder="Calle 5 # 12-34, apto 201"
                  value={linea1}
                  onChange={(e) => setLinea1(e.target.value)}
                  error={errores.linea1}
                />
              </div>

              <div className="mt-4">
                <Input
                  label="Referencia / Indicaciones (opcional)"
                  name="referencia"
                  placeholder="Casa de portón verde, frente al parque"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                />
              </div>

              <div className="mt-4">
                <Input
                  label="Teléfono de contacto"
                  name="telefono"
                  type="tel"
                  placeholder="300 123 4567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  error={errores.telefono}
                  hint="10 dígitos. Para coordinar la entrega."
                />
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-5">
              <label
                htmlFor="notas"
                className="font-bold text-[#1A1A1A] block mb-2"
              >
                Notas para el productor (opcional)
              </label>
              <textarea
                id="notas"
                name="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="¿Algo que el productor deba saber? Empaque, fecha, etc."
                className="w-full rounded-lg border border-[#1A1A1A]/20 bg-white px-3 py-2 text-base text-[#1A1A1A] placeholder:text-[#1A1A1A]/40 focus:outline-none focus:border-[#D4A017] transition-colors resize-y"
              />
            </section>
          </div>

          {/* Columna derecha: resumen */}
          <aside className="mt-6 md:mt-0 md:sticky md:top-20">
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-5">
              <h2 className="font-bold text-[#1A1A1A] mb-4">Tu pedido</h2>

              <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1">
                {grupos.map((grupo) => (
                  <div key={grupo.comercio}>
                    <p className="text-xs font-semibold text-[#2D6A4F] mb-1.5 truncate">
                      {grupo.comercio}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {grupo.items.map((it) => (
                        <li
                          key={it.productoId}
                          className="flex justify-between gap-2 text-sm"
                        >
                          <span className="text-[#1A1A1A]/70 truncate">
                            {it.cantidad}× {it.producto?.nombre ?? 'Producto'}
                          </span>
                          <span className="text-[#1A1A1A] whitespace-nowrap">
                            {formatearPrecio((it.producto?.precio ?? 0) * it.cantidad)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="h-px bg-[#1A1A1A]/10 my-4" />

              <div className="flex justify-between text-sm text-[#1A1A1A]/70 mb-1">
                <span>Subtotal ({cantidadTotal})</span>
                <span>{formatearPrecio(subtotal)}</span>
              </div>
              <p className="text-xs text-[#1A1A1A]/50 mb-3">
                El envío se coordina con cada productor.
              </p>

              <div className="flex justify-between items-baseline mb-1">
                <span className="font-semibold text-[#1A1A1A]">Total</span>
                <span className="text-xl font-bold text-[#2D6A4F]">
                  {formatearPrecio(subtotal)}
                </span>
              </div>

              {errorGeneral && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg bg-[#C0392B]/10 border border-[#C0392B]/20 px-3 py-2 text-sm text-[#C0392B]"
                >
                  {errorGeneral}
                </div>
              )}

              <Button type="submit" loading={enviando} className="w-full mt-4">
                Confirmar pedido
              </Button>

              <p className="mt-3 text-xs text-[#1A1A1A]/50 text-center flex items-center justify-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
                Al confirmar, tendrás 30 minutos para realizar el pago.
              </p>
            </div>
          </aside>
        </form>
      </main>

      <Footer />
    </div>
  )
}
