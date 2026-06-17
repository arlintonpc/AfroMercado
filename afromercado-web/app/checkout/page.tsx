'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { precioVigente } from '@/lib/precioProducto'
import { apiFetch } from '@/lib/api/client'
import { listarDirecciones, crearDireccion } from '@/lib/api/direccion'
import { validarCupon, type ResultadoCupon } from '@/lib/api/cupones'
import { useCarrito } from '@/context/CarritoContext'
import { useAuth } from '@/context/AuthContext'
import { agruparPorComercio } from '@/components/carrito/agrupar'
import {
  desenvolver,
  type RespuestaCheckout,
} from '@/components/checkout/tiposPedido'
import type { Direccion } from '@/types/direccion'

export default function PaginaCheckout() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth, usuario } = useAuth()
  const { items, subtotal, cantidadTotal, cargando: cargandoCarrito } = useCarrito()

  // Direcciones guardadas
  const [direcciones, setDirecciones] = useState<Direccion[]>([])
  const [cargandoDirs, setCargandoDirs] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Campos del formulario
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [barrio, setBarrio] = useState('')
  const [linea1, setLinea1] = useState('')
  const [referencia, setReferencia] = useState('')
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '')
  const [notas, setNotas] = useState('')

  // Guardar nueva dirección
  const [guardarDir, setGuardarDir] = useState(false)
  const [alias, setAlias] = useState('')

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [codigoCupon, setCodigoCupon] = useState('')
  const [aplicandoCupon, setAplicandoCupon] = useState(false)
  const [cuponAplicado, setCuponAplicado] = useState<ResultadoCupon | null>(null)
  const [errorCupon, setErrorCupon] = useState<string | null>(null)

  const grupos = useMemo(() => agruparPorComercio(items), [items])

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/checkout')
    }
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (!cargandoAuth && autenticado && !cargandoCarrito && items.length === 0) {
      router.replace('/carrito')
    }
  }, [cargandoAuth, autenticado, cargandoCarrito, items.length, router])

  // Cargar direcciones guardadas
  const seleccionarDireccion = useCallback((dir: Direccion) => {
    setSelectedId(dir.id)
    setDepartamento(dir.departamento)
    setMunicipio(dir.municipio)
    setBarrio(dir.barrio ?? '')
    setLinea1(dir.linea1)
    setReferencia(dir.referencia ?? '')
    setTelefono(dir.telefono ?? usuario?.telefono ?? '')
    setGuardarDir(false)
    setErrores({})
  }, [usuario?.telefono])

  useEffect(() => {
    if (!autenticado) return
    listarDirecciones()
      .then((dirs) => {
        setDirecciones(dirs)
        // Pre-seleccionar la dirección principal si existe
        const principal = dirs.find((d) => d.esPrincipal) ?? dirs[0]
        if (principal) {
          seleccionarDireccion(principal)
        }
      })
      .catch(() => {})
      .finally(() => setCargandoDirs(false))
  }, [autenticado, seleccionarDireccion])

  function seleccionarNueva() {
    setSelectedId(null)
    setDepartamento('')
    setMunicipio('')
    setBarrio('')
    setLinea1('')
    setReferencia('')
    setTelefono(usuario?.telefono ?? '')
    setAlias('')
    setGuardarDir(false)
    setErrores({})
  }

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!departamento.trim()) e.departamento = 'Indica el departamento.'
    if (!municipio.trim()) e.municipio = 'Indica el municipio o ciudad.'
    if (!linea1.trim()) e.linea1 = 'Indica la dirección.'
    const tel = telefono.replace(/\D/g, '')
    if (!tel) e.telefono = 'Indica un teléfono de contacto.'
    else if (tel.length !== 10) e.telefono = 'El celular debe tener 10 dígitos.'
    if (guardarDir && !alias.trim()) e.alias = 'Escribe un nombre para esta dirección (ej: Casa).'
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

  async function aplicarCupon() {
    if (!codigoCupon.trim()) return
    setErrorCupon(null)
    setCuponAplicado(null)
    setAplicandoCupon(true)
    try {
      const resultado = await validarCupon(codigoCupon.trim(), subtotal)
      setCuponAplicado(resultado)
    } catch (err) {
      setErrorCupon(err instanceof Error ? err.message : 'Cupón inválido')
    } finally {
      setAplicandoCupon(false)
    }
  }

  async function confirmar(ev: React.FormEvent) {
    ev.preventDefault()
    setErrorGeneral(null)
    if (enviando) return
    if (!validar()) return

    setEnviando(true)
    try {
      let direccionId: number | undefined = selectedId ?? undefined

      // Si solicitó guardar como nueva dirección
      if (!selectedId && guardarDir && alias.trim()) {
        const nueva = await crearDireccion({
          alias: alias.trim(),
          linea1: linea1.trim(),
          barrio: barrio.trim() || undefined,
          municipio: municipio.trim(),
          departamento: departamento.trim(),
          referencia: referencia.trim() || undefined,
          telefono: telefono.replace(/\D/g, '') || undefined,
        })
        direccionId = nueva.id
        setDirecciones((prev) => [...prev, nueva])
      }

      const direccionTexto = construirDireccionTexto()
      const raw = await apiFetch<unknown>('/pedidos/checkout', {
        method: 'POST',
        body: {
          direccionTexto,
          ...(direccionId !== undefined ? { direccionId } : {}),
          ...(notas.trim() ? { notas: notas.trim() } : {}),
          ...(cuponAplicado ? { codigoCupon: cuponAplicado.cupon.codigo } : {}),
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
          {/* Columna izquierda */}
          <div className="flex flex-col gap-5">
            <section className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-5">
              <h2 className="font-bold text-[#1A1A1A] mb-1">Dirección de entrega</h2>
              <p className="text-xs text-[#1A1A1A]/50 mb-4">
                El productor coordinará el envío contigo con estos datos.
              </p>

              {/* Selector de direcciones guardadas */}
              {!cargandoDirs && direcciones.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide mb-2">
                    Mis direcciones guardadas
                  </p>
                  <div className="flex flex-col gap-2">
                    {direcciones.map((dir) => (
                      <button
                        key={dir.id}
                        type="button"
                        onClick={() => seleccionarDireccion(dir)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedId === dir.id
                            ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                            : 'border-[#1A1A1A]/10 hover:border-[#2D6A4F]/40 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`flex-shrink-0 w-4 h-4 rounded-full border-2 mt-0.5 ${
                              selectedId === dir.id
                                ? 'border-[#2D6A4F] bg-[#2D6A4F]'
                                : 'border-[#1A1A1A]/30'
                            }`}>
                              {selectedId === dir.id && (
                                <span className="block w-full h-full rounded-full scale-50 bg-white" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-[#1A1A1A]">
                                {dir.alias}
                              </span>
                              {dir.esPrincipal && (
                                <span className="ml-2 text-xs bg-[#2D6A4F]/10 text-[#2D6A4F] font-medium px-1.5 py-0.5 rounded-full">
                                  Principal
                                </span>
                              )}
                              <p className="text-xs text-[#1A1A1A]/55 truncate mt-0.5">
                                {dir.linea1}{dir.barrio ? `, Barrio ${dir.barrio}` : ''} — {dir.municipio}, {dir.departamento}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}

                    {/* Nueva dirección */}
                    <button
                      type="button"
                      onClick={seleccionarNueva}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        selectedId === null
                          ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                          : 'border-[#1A1A1A]/10 hover:border-[#2D6A4F]/40 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                          selectedId === null
                            ? 'border-[#2D6A4F] bg-[#2D6A4F]'
                            : 'border-[#1A1A1A]/30'
                        }`}>
                          {selectedId === null && (
                            <span className="block w-full h-full rounded-full scale-50 bg-white" />
                          )}
                        </span>
                        <span className="text-sm font-semibold text-[#1A1A1A]">
                          + Nueva dirección
                        </span>
                      </div>
                    </button>
                  </div>
                  <div className="h-px bg-[#1A1A1A]/8 mt-4 mb-4" />
                </div>
              )}

              {/* Formulario de dirección */}
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

              {/* Guardar como nueva dirección (solo en modo "nueva dirección") */}
              {selectedId === null && (
                <div className="mt-5 pt-4 border-t border-[#1A1A1A]/8">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardarDir}
                      onChange={(e) => setGuardarDir(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#2D6A4F] flex-shrink-0"
                    />
                    <span className="text-sm text-[#1A1A1A]/70">
                      Guardar esta dirección para futuras compras
                    </span>
                  </label>

                  {guardarDir && (
                    <div className="mt-3">
                      <Input
                        label="Nombre para esta dirección"
                        name="alias"
                        placeholder="Casa, Oficina, Trabajo…"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        error={errores.alias}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-5">
              <label htmlFor="notas" className="font-bold text-[#1A1A1A] block mb-2">
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
                        <li key={it.productoId} className="flex justify-between gap-2 text-sm">
                          <span className="text-[#1A1A1A]/70 truncate">
                            {it.cantidad}× {it.producto?.nombre ?? 'Producto'}
                          </span>
                          <span className="text-[#1A1A1A] whitespace-nowrap">
                            {formatearPrecio(precioVigente(it.producto) * it.cantidad)}
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

              {cuponAplicado && (
                <div className="flex justify-between text-sm text-[#2D6A4F] mb-1">
                  <span>Descuento ({cuponAplicado.cupon.codigo})</span>
                  <span>-{formatearPrecio(cuponAplicado.descuento)}</span>
                </div>
              )}

              <p className="text-xs text-[#1A1A1A]/50 mb-3">
                El envío se coordina con cada productor.
              </p>

              <div className="flex justify-between items-baseline mb-4">
                <span className="font-semibold text-[#1A1A1A]">Total</span>
                <span className="text-xl font-bold text-[#2D6A4F]">
                  {formatearPrecio(cuponAplicado ? cuponAplicado.totalConDescuento : subtotal)}
                </span>
              </div>

              {/* Cupón de descuento */}
              <div className="border border-[#1A1A1A]/10 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-[#1A1A1A] mb-2">
                  ¿Tienes un cupón de descuento?
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Código..."
                    value={codigoCupon}
                    onChange={(e) => {
                      setCodigoCupon(e.target.value.toUpperCase())
                      setCuponAplicado(null)
                      setErrorCupon(null)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), aplicarCupon())}
                    className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-[#1A1A1A]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                    disabled={aplicandoCupon}
                  />
                  <button
                    type="button"
                    onClick={aplicarCupon}
                    disabled={aplicandoCupon || !codigoCupon.trim()}
                    className="flex-shrink-0 h-10 px-4 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#2D6A4F]/90 transition-colors"
                  >
                    {aplicandoCupon ? '...' : 'Aplicar'}
                  </button>
                </div>

                {cuponAplicado && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-[#2D6A4F] bg-[#52B788]/10 rounded-lg px-3 py-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Descuento aplicado: -{formatearPrecio(cuponAplicado.descuento)}
                  </div>
                )}

                {errorCupon && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="9" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errorCupon}
                  </div>
                )}
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
