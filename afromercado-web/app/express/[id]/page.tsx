'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'
import {
  obtenerMenuComercioExpress,
  crearPedidoExpress,
  validarCuponExpress,
  type MenuComercioExpress,
  type MenuSeccion,
  type ModalidadExpress,
  type MetodoPagoExpress,
  type ValidacionCuponExpress,
} from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'

interface ItemCarrito {
  productoId: number
  nombre: string
  precio: number
  cantidad: number
  nota: string
  fotoUrl: string | null
}

type Paso = 'menu' | 'checkout' | 'confirmado'

function TarjetaProducto({
  p, cantidadItem, agregar, quitar
}: {
  p: MenuComercioExpress['productos'][0]
  cantidadItem: (id: number) => number
  agregar: (p: any) => void
  quitar: (id: number) => void
}) {
  const disponible = Math.max(0, p.stock - (p.stockReservado ?? 0))
  const agotado = disponible === 0
  const cant = cantidadItem(p.id)
  return (
    <div className={`bg-white rounded-2xl shadow-sm flex gap-3 p-3 ${agotado ? 'opacity-50' : ''}`}>
      {p.fotoUrl ? (
        <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
          <Image src={p.fotoUrl} alt={p.nombre} fill className="object-cover" />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-xl bg-[#F0EBE3] flex items-center justify-center text-2xl flex-shrink-0">🥘</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#1A1A1A] text-sm leading-tight">{p.nombre}</p>
        {p.descripcion && <p className="text-xs text-[#999] mt-0.5 line-clamp-2">{p.descripcion}</p>}
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="font-bold text-[#1A1A1A]">{formatearPrecio(Number(p.precio))}</span>
            <span className="text-xs text-[#999] ml-1">/ {p.unidad.toLowerCase()}</span>
          </div>
          {agotado ? (
            <span className="text-xs text-[#999]">Agotado</span>
          ) : cant === 0 ? (
            <button
              onClick={() => agregar(p)}
              className="flex items-center gap-1 bg-[#2D6A4F] text-white text-sm font-semibold px-3 py-1.5 rounded-xl"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Agregar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => quitar(p.id)} className="w-7 h-7 rounded-full bg-[#F0EBE3] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14"/></svg>
              </button>
              <span className="font-bold text-[#1A1A1A] w-4 text-center">{cant}</span>
              <button onClick={() => agregar(p)} className="w-7 h-7 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MenuExpressPage() {
  const params = useParams()
  const router = useRouter()
  const { autenticado, usuario } = useAuth()
  const comercioId = Number(params.id)

  const [menu, setMenu] = useState<MenuComercioExpress | null>(null)
  const [cargando, setCargando] = useState(true)
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [paso, setPaso] = useState<Paso>('menu')
  const [tabActiva, setTabActiva] = useState<number | 'todos'>('todos')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pedidoId, setPedidoId] = useState<number | null>(null)

  // Cupón
  const [codigoCupon, setCodigoCupon]         = useState('')
  const [cuponAplicado, setCuponAplicado]     = useState<ValidacionCuponExpress | null>(null)
  const [validandoCupon, setValidandoCupon]   = useState(false)
  const [errorCupon, setErrorCupon]           = useState<string | null>(null)

  // Checkout fields
  const [modalidad, setModalidad] = useState<ModalidadExpress>('RECOGER')
  const [metodoPago, setMetodoPago] = useState<MetodoPagoExpress>('EFECTIVO')
  const [direccion, setDireccion] = useState('')
  const [telefonoEntrega, setTelefonoEntrega] = useState('')
  const [notaCliente, setNotaCliente] = useState('')
  const [mesa, setMesa] = useState('')

  // Pre-llenar teléfono desde el perfil del usuario
  useEffect(() => {
    if (usuario?.telefono && !telefonoEntrega) {
      setTelefonoEntrega(usuario.telefono.replace(/\D/g, '').replace(/^57/, ''))
    }
  }, [usuario])

  const cargar = useCallback(async () => {
    const data = await obtenerMenuComercioExpress(comercioId)
    setMenu(data)
    setCargando(false)
    if (data?.modalidades?.length) setModalidad(data.modalidades[0])
  }, [comercioId])

  useEffect(() => { cargar() }, [cargar])

  function agregar(p: MenuComercioExpress['productos'][0]) {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.productoId === p.id)
      if (idx >= 0) {
        const copia = [...prev]
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 }
        return copia
      }
      return [...prev, { productoId: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: 1, nota: '', fotoUrl: p.fotoUrl }]
    })
  }

  function quitar(productoId: number) {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.productoId === productoId)
      if (idx < 0) return prev
      const copia = [...prev]
      if (copia[idx].cantidad <= 1) copia.splice(idx, 1)
      else copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad - 1 }
      return copia
    })
  }

  function cantidadItem(productoId: number) {
    return carrito.find(i => i.productoId === productoId)?.cantidad ?? 0
  }

  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0)
  const totalPrecio = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)

  async function aplicarCupon() {
    if (!codigoCupon.trim()) return
    setValidandoCupon(true)
    setErrorCupon(null)
    try {
      const validacion = await validarCuponExpress(codigoCupon.trim(), totalPrecio, comercioId)
      setCuponAplicado(validacion)
      setErrorCupon(null)
    } catch (e: any) {
      setErrorCupon(e?.message ?? 'Cupón inválido')
      setCuponAplicado(null)
    } finally {
      setValidandoCupon(false)
    }
  }

  async function confirmarPedido() {
    if (!autenticado) { router.push('/login'); return }
    if (carrito.length === 0) return
    if (modalidad === 'DOMICILIO') {
      if (!direccion.trim()) { setError('Ingresa la dirección de entrega.'); return }
      if (!telefonoEntrega.trim()) { setError('Ingresa un teléfono de contacto para el domicilio.'); return }
    }
    if (modalidad === 'MESA' && !mesa.trim()) { setError('Ingresa el número de mesa.'); return }
    setEnviando(true)
    setError(null)
    try {
      const direccionFinal = modalidad === 'DOMICILIO'
        ? `${direccion.trim()} | Tel: ${telefonoEntrega.trim()}`
        : modalidad === 'MESA' ? `Mesa ${mesa}` : undefined
      const pedido = await crearPedidoExpress({
        comercioId,
        modalidad,
        metodoPago,
        items: carrito.map(i => ({ productoId: i.productoId, cantidad: i.cantidad, nota: i.nota || undefined })),
        notaCliente: notaCliente || undefined,
        direccionTexto: direccionFinal,
        municipioEntrega: menu?.comercio.municipio,
        codigoCupon: cuponAplicado ? codigoCupon.trim() : undefined,
      })
      setPedidoId(pedido.id)
      setPaso('confirmado')
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo enviar el pedido. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="animate-pulse text-[#2D6A4F] text-lg">Cargando menú...</div>
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-2xl">🍽️</p>
        <p className="font-semibold text-[#1A1A1A]">Este restaurante no está disponible en Express</p>
        <Link href="/express" className="text-[#2D6A4F] underline">Ver otros restaurantes</Link>
      </div>
    )
  }

  // ── CONFIRMADO ─────────────────────────────────────────────
  if (paso === 'confirmado') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center text-4xl">✅</div>
        <div>
          <p className="text-2xl font-bold text-[#1A1A1A]">¡Pedido enviado!</p>
          <p className="text-[#666] mt-1">El restaurante lo confirmará en los próximos minutos.</p>
          {pedidoId && <p className="text-sm text-[#999] mt-1">Pedido #{pedidoId}</p>}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/express/mis-pedidos" className="block w-full text-center rounded-xl bg-[#2D6A4F] text-white py-3 font-semibold">
            Ver mis pedidos
          </Link>
          <button onClick={() => { setCarrito([]); setPaso('menu') }} className="text-[#2D6A4F] underline text-sm">
            Hacer otro pedido
          </button>
        </div>
      </div>
    )
  }

  // Agrupar productos por sección
  const secciones = menu.secciones ?? []
  const sinSeccion = menu.productos.filter(p => !p.menuSeccionId)
  const conSeccion = secciones.map(s => ({
    seccion: s,
    productos: menu.productos.filter(p => p.menuSeccionId === s.id),
  })).filter(g => g.productos.length > 0)
  const hayTabs = secciones.length > 0
  const productosFiltrados = tabActiva === 'todos'
    ? menu.productos
    : menu.productos.filter(p => p.menuSeccionId === tabActiva)

  // ── CHECKOUT ───────────────────────────────────────────────
  if (paso === 'checkout') {
    return (
      <div className="min-h-screen bg-[#FAF8F5]">
        <header className="sticky top-0 z-10 bg-white border-b border-[#E8DCC8] px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPaso('menu')} className="text-[#2D6A4F] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <p className="font-bold text-[#1A1A1A]">Confirmar pedido</p>
        </header>

        <div className="max-w-lg mx-auto p-4 space-y-5 pb-36">
          {/* Resumen */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-semibold text-[#1A1A1A] mb-3">Tu pedido</p>
            {carrito.map(i => (
              <div key={i.productoId} className="flex justify-between text-sm py-1.5 border-b border-[#F0EBE3] last:border-0">
                <span className="text-[#1A1A1A]">{i.cantidad}× {i.nombre}</span>
                <span className="text-[#1A1A1A] font-medium">{formatearPrecio(i.precio * i.cantidad)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-[#1A1A1A] mt-3 pt-2 border-t border-[#E8DCC8]">
              <span>Total</span>
              <span>{formatearPrecio(totalPrecio + (modalidad === 'DOMICILIO' ? (menu.costoEnvioBase ?? 0) : 0))}</span>
            </div>
            {modalidad === 'DOMICILIO' && menu.costoEnvioBase > 0 && (
              <p className="text-xs text-[#999] mt-1">Incluye domicilio: {formatearPrecio(menu.costoEnvioBase)}</p>
            )}
            {cuponAplicado && (
              <>
                <div className="flex justify-between text-sm py-1 text-green-700">
                  <span>Descuento ({cuponAplicado.cupon.codigo})</span>
                  <span>-{formatearPrecio(cuponAplicado.descuento)}</span>
                </div>
                <div className="flex justify-between font-bold text-[#1A1A1A] mt-1 pt-2 border-t border-[#E8DCC8]">
                  <span>Total con descuento</span>
                  <span>{formatearPrecio(cuponAplicado.subtotalConDescuento + (modalidad === 'DOMICILIO' ? (menu?.costoEnvioBase ?? 0) : 0))}</span>
                </div>
              </>
            )}
          </div>

          {/* Modalidad */}
          {menu.modalidades.length > 1 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-semibold text-[#1A1A1A] mb-3">¿Cómo lo recibes?</p>
              <div className="flex gap-2 flex-wrap">
                {menu.modalidades.map(m => (
                  <button
                    key={m}
                    onClick={() => setModalidad(m)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      modalidad === m
                        ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                        : 'bg-white text-[#1A1A1A] border-[#E8DCC8]'
                    }`}
                  >
                    {m === 'DOMICILIO' ? '🛵 A domicilio' : m === 'RECOGER' ? '🏪 Recoger' : '🪑 En mesa'}
                  </button>
                ))}
              </div>
              {modalidad === 'DOMICILIO' && (
                <div className="mt-3 space-y-2">
                  <input
                    className="w-full rounded-xl border border-[#E8DCC8] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
                    placeholder="Dirección de entrega (barrio, calle, referencia…) *"
                    value={direccion}
                    onChange={e => setDireccion(e.target.value)}
                    required
                  />
                  <div className="flex items-center border border-[#E8DCC8] rounded-xl overflow-hidden focus-within:border-[#2D6A4F]">
                    <span className="px-3 text-sm text-gray-400 bg-[#F8F5F0] border-r border-[#E8DCC8] h-10 flex items-center">+57</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      className="flex-1 h-10 px-3 text-sm focus:outline-none"
                      placeholder="Teléfono de contacto *"
                      value={telefonoEntrega}
                      onChange={e => setTelefonoEntrega(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-400">El repartidor usará este número si necesita ubicarte.</p>
                </div>
              )}
              {modalidad === 'MESA' && (
                <input
                  className="mt-3 w-32 rounded-xl border border-[#E8DCC8] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
                  placeholder="Número de mesa"
                  value={mesa}
                  onChange={e => setMesa(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Pago */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-semibold text-[#1A1A1A] mb-3">Método de pago</p>
            <div className="flex gap-2 flex-wrap">
              {(['EFECTIVO', 'NEQUI'] as MetodoPagoExpress[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    metodoPago === m
                      ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                      : 'bg-white text-[#1A1A1A] border-[#E8DCC8]'
                  }`}
                >
                  {m === 'EFECTIVO' ? '💵 Efectivo' : '📱 Nequi'}
                </button>
              ))}
            </div>
          </div>

          {/* Nota */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-semibold text-[#1A1A1A] mb-2">Nota para el restaurante <span className="text-[#999] font-normal text-sm">(opcional)</span></p>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-[#E8DCC8] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none"
              placeholder="Ej: sin picante, alergia a mariscos…"
              value={notaCliente}
              onChange={e => setNotaCliente(e.target.value)}
            />
          </div>

          {/* Cupón de descuento */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-semibold text-[#1A1A1A] mb-2">¿Tienes un cupón?</p>
            {cuponAplicado ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-green-700">✅ {cuponAplicado.cupon.codigo} aplicado</p>
                  <p className="text-xs text-green-600">
                    Descuento: -{formatearPrecio(cuponAplicado.descuento)}
                    {cuponAplicado.cupon.tipo === 'PORCENTAJE' ? ` (${Number(cuponAplicado.cupon.valor)}%)` : ''}
                  </p>
                </div>
                <button
                  onClick={() => { setCuponAplicado(null); setCodigoCupon('') }}
                  className="text-xs text-red-500 font-medium"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={codigoCupon}
                  onChange={e => setCodigoCupon(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && aplicarCupon()}
                  placeholder="Código de descuento"
                  className="flex-1 rounded-xl border border-[#E8DCC8] px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#2D6A4F]"
                />
                <button
                  onClick={aplicarCupon}
                  disabled={validandoCupon || !codigoCupon.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {validandoCupon ? '...' : 'Aplicar'}
                </button>
              </div>
            )}
            {errorCupon && <p className="text-xs text-red-600 mt-2">{errorCupon}</p>}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        </div>

        {/* Botón fijo */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8DCC8] p-4">
          <button
            onClick={confirmarPedido}
            disabled={enviando}
            className="w-full max-w-lg mx-auto block rounded-2xl bg-[#2D6A4F] text-white py-4 font-bold text-lg disabled:opacity-60 transition-opacity"
          >
            {enviando ? 'Enviando...' : `Pedir ahora · ${formatearPrecio(totalPrecio)}`}
          </button>
        </div>
      </div>
    )
  }

  // ── MENÚ ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header del restaurante */}
      <header className="bg-white border-b border-[#E8DCC8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/express" className="inline-flex items-center gap-1.5 text-sm text-[#2D6A4F] mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Express
          </Link>
          <div className="flex items-center gap-4">
            {menu.comercio.logoUrl ? (
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                <Image src={menu.comercio.logoUrl} alt={menu.comercio.nombre} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#F0EBE3] flex items-center justify-center text-2xl flex-shrink-0">🍽️</div>
            )}
            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A]">{menu.comercio.nombre}</h1>
              <p className="text-sm text-[#666] flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {menu.comercio.municipio}
                {Number(menu.comercio.calificacion) > 0 && (
                  <span className="ml-2">⭐ {Number(menu.comercio.calificacion).toFixed(1)}</span>
                )}
              </p>
              <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                menu.abiertoAhora ? 'bg-[#D4EDDA] text-[#155724]' : 'bg-[#F8D7DA] text-[#721C24]'
              }`}>
                {menu.abiertoAhora ? '● Abierto' : '● Cerrado'}
              </span>
            </div>
          </div>

          {!menu.abiertoAhora && (
            <p className="mt-3 text-sm text-[#721C24] bg-[#F8D7DA] rounded-xl px-3 py-2">
              Este restaurante está cerrado ahora. Puedes ver el menú pero no hacer pedidos.
            </p>
          )}

          {hayTabs && (
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-2 py-2 min-w-max">
                <button
                  onClick={() => setTabActiva('todos')}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    tabActiva === 'todos'
                      ? 'bg-[#2D6A4F] text-white'
                      : 'bg-[#F0EBE3] text-[#555]'
                  }`}
                >
                  🍽️ Todo el menú
                </button>
                {secciones.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setTabActiva(s.id)
                      setTimeout(() => {
                        document.getElementById(`seccion-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 50)
                    }}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      tabActiva === s.id
                        ? 'bg-[#2D6A4F] text-white'
                        : 'bg-[#F0EBE3] text-[#555]'
                    }`}
                  >
                    {s.icono} {s.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Video del restaurante */}
      {(menu as any).videoUrl && (
        <div id="seccion-video" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <ReproductorVideo url={(menu as any).videoUrl} />
        </div>
      )}

      {/* Menú */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-40 lg:pb-8">
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">
        <div className="space-y-6">
        {menu.productos.length === 0 ? (
          <div className="text-center py-12 text-[#999]">
            <p className="text-3xl mb-2">🥘</p>
            <p>Este restaurante aún no tiene productos en Express</p>
          </div>
        ) : tabActiva !== 'todos' ? (
          // Vista filtrada por una sección
          <section>
            {(() => {
              const sec = secciones.find(s => s.id === tabActiva)
              return sec ? (
                <h2 className="font-bold text-[#1A1A1A] text-base mb-3 pb-1 border-b border-[#E8DCC8]">
                  {sec.icono} {sec.nombre}
                </h2>
              ) : null
            })()}
            <div className="space-y-3">
              {productosFiltrados.map(p => <TarjetaProducto key={p.id} p={p} cantidadItem={cantidadItem} agregar={agregar} quitar={quitar} />)}
            </div>
          </section>
        ) : hayTabs ? (
          // Vista "Todos" con secciones
          <>
            {conSeccion.map(({ seccion, productos: prods }) => (
              <section key={seccion.id} id={`seccion-${seccion.id}`} className="scroll-mt-32">
                <h2 className="font-bold text-[#1A1A1A] text-base mb-3 pb-1 border-b border-[#E8DCC8]">
                  {seccion.icono} {seccion.nombre}
                </h2>
                <div className="space-y-3">
                  {prods.map(p => <TarjetaProducto key={p.id} p={p} cantidadItem={cantidadItem} agregar={agregar} quitar={quitar} />)}
                </div>
              </section>
            ))}
            {sinSeccion.length > 0 && (
              <section>
                <h2 className="font-bold text-[#1A1A1A] text-base mb-3 pb-1 border-b border-[#E8DCC8]">Otros</h2>
                <div className="space-y-3">
                  {sinSeccion.map(p => <TarjetaProducto key={p.id} p={p} cantidadItem={cantidadItem} agregar={agregar} quitar={quitar} />)}
                </div>
              </section>
            )}
          </>
        ) : (
          // Sin secciones — lista plana agrupada por categoría
          (() => {
            const porCategoria: Record<string, typeof menu.productos> = {}
            for (const p of menu.productos) {
              const cat = (p as any).categoria?.nombre ?? 'Otros'
              if (!porCategoria[cat]) porCategoria[cat] = []
              porCategoria[cat].push(p)
            }
            return Object.entries(porCategoria).map(([cat, prods]) => (
              <section key={cat}>
                <h2 className="font-bold text-[#1A1A1A] text-base mb-3 pb-1 border-b border-[#E8DCC8]">{cat}</h2>
                <div className="space-y-3">
                  {prods.map(p => <TarjetaProducto key={p.id} p={p} cantidadItem={cantidadItem} agregar={agregar} quitar={quitar} />)}
                </div>
              </section>
            ))
          })()
        )}
        </div>{/* fin columna izquierda */}

        {/* Sidebar carrito — solo desktop */}
        <div className="hidden lg:block">
          <div className="lg:sticky lg:top-20 bg-white rounded-2xl border border-[#E8DCC8] shadow-lg p-5 space-y-4">
            <p className="font-bold text-[#1A1A1A] text-base">🛒 Tu pedido</p>
            {carrito.length === 0 ? (
              <p className="text-sm text-[#999] text-center py-6">Agrega productos del menú</p>
            ) : (
              <>
                <div className="space-y-2">
                  {carrito.map(i => (
                    <div key={i.productoId} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center gap-1">
                          <button onClick={() => quitar(i.productoId)} className="w-6 h-6 rounded-full bg-[#F0EBE3] flex items-center justify-center text-[#2D6A4F] font-bold">−</button>
                          <span className="w-5 text-center font-semibold">{i.cantidad}</span>
                          <button onClick={() => agregar({ id: i.productoId, nombre: i.nombre, precio: i.precio, fotoUrl: i.fotoUrl, stock: 999, stockReservado: 0, descripcion: '', unidad: 'und', menuSeccionId: null } as any)} className="w-6 h-6 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center font-bold">+</button>
                        </div>
                        <span className="truncate text-[#1A1A1A]">{i.nombre}</span>
                      </div>
                      <span className="text-[#1A1A1A] font-medium ml-2 flex-shrink-0">{formatearPrecio(i.precio * i.cantidad)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#E8DCC8] pt-3 flex justify-between font-bold text-[#1A1A1A]">
                  <span>Total</span>
                  <span>{formatearPrecio(totalPrecio)}</span>
                </div>
                <button
                  onClick={() => {
                    if (!autenticado) { router.push('/login'); return }
                    if (!menu.abiertoAhora) return
                    setPaso('checkout')
                  }}
                  disabled={!menu.abiertoAhora}
                  className="w-full rounded-xl bg-[#2D6A4F] text-white py-3 font-bold text-sm disabled:opacity-50"
                >
                  {menu.abiertoAhora ? 'Confirmar pedido' : 'Restaurante cerrado'}
                </button>
              </>
            )}
          </div>
        </div>
        </div>{/* fin grid 2 col */}
      </main>

      {/* Barra de carrito flotante — solo mobile */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-transparent lg:hidden">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => {
                if (!autenticado) { router.push('/login'); return }
                if (!menu.abiertoAhora) return
                setPaso('checkout')
              }}
              disabled={!menu.abiertoAhora}
              className="w-full rounded-2xl bg-[#2D6A4F] text-white py-4 font-bold text-base shadow-lg flex items-center justify-between px-5 disabled:opacity-50"
            >
              <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm">{totalItems}</span>
              <span>{menu.abiertoAhora ? 'Ver pedido' : 'Restaurante cerrado'}</span>
              <span>{formatearPrecio(totalPrecio)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
