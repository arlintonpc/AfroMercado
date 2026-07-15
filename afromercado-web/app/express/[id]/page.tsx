'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'
import {
  obtenerMenuComercioExpress,
  crearPedidoExpress,
  validarCuponExpress,
  misPedidosExpress,
  obtenerPedidoExpress,
  esFavoritoExpress,
  toggleFavoritoExpress,
  type MenuComercioExpress,
  type MenuSeccion,
  type ModalidadExpress,
  type MetodoPagoExpress,
  type ValidacionCuponExpress,
  type DiaSemana,
  type HorarioExpress,
} from '@/lib/api/express'
import { reviewsExpress, crearReviewExpress, type ReviewExpress } from '@/lib/api/review'
import SeccionReviews, { type ReviewItem } from '@/components/ui/SeccionReviews'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import ModalComplementos from '@/components/express/ModalComplementos'
import { urlComoLlegar } from '@/lib/comoLlegar'

interface ItemCarrito {
  productoId: number
  nombre: string
  precio: number
  cantidad: number
  nota: string
  fotoUrl: string | null
  complementos?: Array<{ nombre: string; precio: number }>
}

// getDay(): 0=domingo … 6=sábado
const DIA_SEMANA_POR_INDICE: DiaSemana[] = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']

/** Horario de apertura del comercio para el día de hoy (hora local Colombia = hora del navegador del usuario). */
function horarioDeHoy(horarios: HorarioExpress[] | undefined): HorarioExpress | null {
  if (!horarios?.length) return null
  const dia = DIA_SEMANA_POR_INDICE[new Date().getDay()]
  return horarios.find(h => h.dia === dia) ?? null
}

type Paso = 'menu' | 'checkout' | 'confirmado'

function TarjetaProducto({
  p, cantidadItem, agregar, quitar, cerrado
}: {
  p: MenuComercioExpress['productos'][0]
  cantidadItem: (id: number) => number
  agregar: (p: any) => void
  quitar: (id: number) => void
  cerrado?: boolean
}) {
  const disponible = Math.max(0, p.stock - (p.stockReservado ?? 0))
  const agotado = disponible === 0
  const bloqueado = agotado || !!cerrado
  const cant = cantidadItem(p.id)
  return (
    <div className={`bg-white rounded-2xl shadow-sm flex gap-3 p-3 ${bloqueado ? 'opacity-50' : ''}`}>
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
          ) : cerrado ? (
            <span className="text-xs text-[#721C24] bg-[#F8D7DA] px-2 py-1 rounded-lg">Cerrado</span>
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

function MenuExpressContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { autenticado, usuario } = useAuth()
  const comercioId = Number(params.id)
  const reorderId = searchParams.get('reorder')

  const [menu, setMenu] = useState<MenuComercioExpress | null>(null)
  const [cargando, setCargando] = useState(true)
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [paso, setPaso] = useState<Paso>('menu')
  const [tabActiva, setTabActiva] = useState<number | 'todos'>('todos')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pedidoId, setPedidoId] = useState<number | null>(null)
  const [productoComplemento, setProductoComplemento] = useState<MenuComercioExpress['productos'][0] | null>(null)
  const [reviews, setReviews] = useState<ReviewExpress[]>([])
  const [cargandoReviews, setCargandoRev] = useState(true)
  const [pedidoElegibleId, setPedidoElegibleId] = useState<number | undefined>()
  const [esFav, setEsFav] = useState(false)
  const [toggling, setToggling] = useState(false)

  // Cupón
  const [codigoCupon, setCodigoCupon]         = useState('')
  const [cuponAplicado, setCuponAplicado]     = useState<ValidacionCuponExpress | null>(null)
  const [validandoCupon, setValidandoCupon]   = useState(false)
  const [errorCupon, setErrorCupon]           = useState<string | null>(null)
  const [mostrarCupon, setMostrarCupon]       = useState(false)

  // Checkout fields
  const [modalidad, setModalidad] = useState<ModalidadExpress>('RECOGER')
  const [metodoPago, setMetodoPago] = useState<MetodoPagoExpress>('EFECTIVO')
  const [direccion, setDireccion] = useState('')
  const [telefonoEntrega, setTelefonoEntrega] = useState('')
  const [notaCliente, setNotaCliente] = useState('')
  const [mesa, setMesa] = useState('')

  // Cuándo: ahora vs. programado para más tarde
  const [cuando, setCuando] = useState<'ahora' | 'programado'>('ahora')
  const [horaProgramada, setHoraProgramada] = useState('')

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
    if (usuario && data) {
      esFavoritoExpress(data.id).then(r => setEsFav(r.favorito)).catch(() => {})
    }
  }, [comercioId, usuario])

  useEffect(() => { cargar() }, [cargar])

  // "Pedir de nuevo": prellenar el carrito con los productos de un pedido anterior.
  // Los productos que ya no existen o están inactivos se omiten silenciosamente.
  useEffect(() => {
    if (!reorderId || !menu) return
    obtenerPedidoExpress(Number(reorderId)).then(pedidoAnterior => {
      const productosPorId = new Map(menu.productos.map(p => [p.id, p]))
      const itemsPrellenado: ItemCarrito[] = []
      for (const item of pedidoAnterior.items) {
        const prod = productosPorId.get(item.productoId)
        if (!prod) continue // producto eliminado o ya no disponible en este comercio
        const complementos = Array.isArray(item.complementos)
          ? (item.complementos as Array<{ nombre: string; precio: number }>)
          : undefined
        const precioExtras = complementos?.reduce((s, c) => s + Number(c.precio), 0) ?? 0
        itemsPrellenado.push({
          productoId: prod.id,
          nombre: prod.nombre,
          precio: Number(prod.precio) + precioExtras,
          cantidad: item.cantidad,
          nota: item.nota ?? '',
          fotoUrl: prod.fotoUrl,
          complementos,
        })
      }
      if (itemsPrellenado.length > 0) setCarrito(itemsPrellenado)
    }).catch(() => {})
  }, [reorderId, menu])

  async function toggleFav() {
    if (!usuario) { router.push('/ingresar'); return }
    if (!menu) return
    setToggling(true)
    try {
      const r = await toggleFavoritoExpress(menu.id)
      setEsFav(r.favorito)
    } catch {}
    setToggling(false)
  }

  useEffect(() => {
    reviewsExpress(comercioId).then(r => { setReviews(r); setCargandoRev(false) }).catch(() => setCargandoRev(false))
  }, [comercioId])

  useEffect(() => {
    if (!usuario) return
    misPedidosExpress().then(ps => {
      const elegible = ps.find((p: any) => p.comercioId === comercioId && p.estado === 'ENTREGADO' && !p.review)
      setPedidoElegibleId(elegible?.id)
    }).catch(() => {})
  }, [usuario, comercioId])

  useEffect(() => {
    if (menu?.comercio?.nombre) {
      document.title = `${menu.comercio.nombre} — Pedidos Teravia`
    }
    return () => { document.title = 'Teravia' }
  }, [menu?.comercio?.nombre])

  function agregar(p: MenuComercioExpress['productos'][0]) {
    if ((p.gruposComplemento?.length ?? 0) > 0) {
      setProductoComplemento(p)
      return
    }
    agregarAlCarrito(p, [], Number(p.precio))
  }

  function agregarAlCarrito(
    p: MenuComercioExpress['productos'][0],
    complementos: Array<{ nombre: string; precio: number }>,
    precioTotal: number
  ) {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.productoId === p.id)
      if (idx >= 0 && (complementos?.length ?? 0) === 0) {
        const copia = [...prev]
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 }
        return copia
      }
      return [...prev, { productoId: p.id, nombre: p.nombre, precio: precioTotal, cantidad: 1, nota: '', fotoUrl: p.fotoUrl, complementos }]
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
    if (!autenticado) { router.push('/ingresar'); return }
    if (carrito.length === 0) return
    if (modalidad === 'DOMICILIO') {
      if (!direccion.trim()) { setError('Ingresa la dirección de entrega.'); return }
      if (!telefonoEntrega.trim()) { setError('Ingresa un teléfono de contacto para el domicilio.'); return }
    }
    if (modalidad === 'MESA' && !mesa.trim()) { setError('Ingresa el número de mesa.'); return }
    let fechaProgramada: string | undefined
    if (cuando === 'programado') {
      if (!horaProgramada) { setError('Elige una hora para programar el pedido.'); return }
      const [hh, mm] = horaProgramada.split(':').map(Number)
      const fecha = new Date()
      fecha.setSeconds(0, 0)
      fecha.setHours(hh, mm)
      if (fecha.getTime() <= Date.now()) { setError('Elige una hora futura para el pedido programado.'); return }
      fechaProgramada = fecha.toISOString()
    }
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
        items: carrito.map(i => ({ productoId: i.productoId, cantidad: i.cantidad, nota: i.nota || undefined, complementos: i.complementos?.length ? i.complementos : undefined })),
        notaCliente: notaCliente || undefined,
        direccionTexto: direccionFinal,
        municipioEntrega: menu?.comercio.municipio,
        codigoCupon: cuponAplicado ? codigoCupon.trim() : undefined,
        fechaProgramada,
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
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`¡Acabo de hacer un pedido en Teravia! 🎉\n${menu?.comercio.nombre ?? ''}${pedidoId ? `\nPedido #${pedidoId}` : ''}\nhttps://afromercado.co`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl font-semibold text-sm hover:bg-[#20b858] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Compartir por WhatsApp
          </a>
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
  // Precio base de cada ítem (sin complementos)
  const precioBaseProducto = (item: ItemCarrito) => {
    const prod = menu?.productos.find(p => p.id === item.productoId)
    return prod ? Number(prod.precio) : item.precio
  }
  const costoEnvio = modalidad === 'DOMICILIO' ? Number(menu?.costoEnvioBase ?? 0) : 0
  const totalFinal = cuponAplicado
    ? Number(cuponAplicado.subtotalConDescuento) + costoEnvio
    : totalPrecio + costoEnvio

  if (paso === 'checkout') {
    return (
      <div className="min-h-screen bg-[#FAF8F5]">
        <header className="sticky top-0 z-10 bg-white border-b border-[#E8DCC8] px-4 py-4 flex items-center gap-3">
          <button onClick={() => setPaso('menu')} className="text-[#2D6A4F] p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="font-bold text-[#1A1A1A] text-lg">Confirmar pedido</p>
            <p className="text-xs text-gray-500">{menu?.comercio?.nombre}</p>
          </div>
        </header>

        <div className="max-w-lg mx-auto p-4 space-y-4 pb-36">

          {/* ── RESUMEN DETALLADO ── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EBE3] flex items-center justify-between">
              <p className="font-bold text-[#1A1A1A] text-base">🧾 Tu pedido</p>
              <span className="text-xs text-gray-400">{carrito.reduce((s, i) => s + i.cantidad, 0)} ítem{carrito.reduce((s, i) => s + i.cantidad, 0) !== 1 ? 's' : ''}</span>
            </div>

            <div className="divide-y divide-[#F0EBE3]">
              {carrito.map((item, idx) => {
                const precioBase = precioBaseProducto(item)
                const extras = item.complementos ?? []
                const precioExtrasTotal = extras.reduce((s, c) => s + Number(c.precio), 0)
                return (
                  <div key={`${item.productoId}-${idx}`} className="px-5 py-4">
                    {/* Fila principal */}
                    <div className="flex items-start gap-3">
                      {item.fotoUrl && (
                        <img src={item.fotoUrl} alt={item.nombre}
                          className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <p className="font-semibold text-[#1A1A1A] text-sm">{item.cantidad}× {item.nombre}</p>
                          <p className="font-semibold text-[#1A1A1A] text-sm flex-shrink-0">{formatearPrecio((precioBase + precioExtrasTotal) * item.cantidad)}</p>
                        </div>
                        {/* Complementos con precio individual */}
                        {extras.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {extras.map((c, ci) => (
                              <div key={ci} className="flex justify-between text-xs text-gray-500">
                                <span>+ {c.nombre}</span>
                                <span>{Number(c.precio) > 0 ? `+${formatearPrecio(Number(c.precio))}` : 'Gratis'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totales */}
            <div className="px-5 py-4 bg-[#F8F5F0] space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatearPrecio(totalPrecio)}</span>
              </div>
              {costoEnvio > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>🛵 Domicilio</span>
                  <span>{formatearPrecio(costoEnvio)}</span>
                </div>
              )}
              {cuponAplicado && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>🏷️ Descuento ({cuponAplicado.cupon.codigo})</span>
                  <span>-{formatearPrecio(cuponAplicado.descuento)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[#1A1A1A] text-base pt-2 border-t border-[#E8DCC8]">
                <span>Total a pagar</span>
                <span className="text-[#2D6A4F]">{formatearPrecio(totalFinal)}</span>
              </div>
            </div>
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
                    autoComplete="street-address"
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
                      autoComplete="tel"
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

          {/* ¿Cuándo? — ahora o programado */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-semibold text-[#1A1A1A] mb-3">¿Cuándo lo quieres?</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCuando('ahora')}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  cuando === 'ahora'
                    ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                    : 'bg-white text-[#1A1A1A] border-[#E8DCC8]'
                }`}
              >
                🚀 Pedir ahora
              </button>
              <button
                onClick={() => setCuando('programado')}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  cuando === 'programado'
                    ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                    : 'bg-white text-[#1A1A1A] border-[#E8DCC8]'
                }`}
              >
                🕐 Programar para más tarde
              </button>
            </div>
            {cuando === 'programado' && (() => {
              const horarioHoy = horarioDeHoy(menu?.horarios)
              if (!horarioHoy || !horarioHoy.abierto) {
                return (
                  <p className="mt-3 text-xs text-[#721C24] bg-[#F8D7DA] rounded-xl px-3 py-2">
                    El restaurante no tiene horario de apertura configurado para hoy. Intenta pedir ahora o elige otro momento.
                  </p>
                )
              }
              return (
                <div className="mt-3 space-y-1.5">
                  <input
                    type="time"
                    className="w-40 rounded-xl border border-[#E8DCC8] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
                    value={horaProgramada}
                    min={horarioHoy.apertura}
                    max={horarioHoy.cierre}
                    onChange={e => setHoraProgramada(e.target.value)}
                  />
                  <p className="text-xs text-gray-400">
                    Horario de hoy: {horarioHoy.apertura} – {horarioHoy.cierre}
                  </p>
                </div>
              )
            })()}
          </div>

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
                  onClick={() => { setCuponAplicado(null); setCodigoCupon(''); setMostrarCupon(false) }}
                  className="text-xs text-red-500 font-medium"
                >
                  Quitar
                </button>
              </div>
            ) : !mostrarCupon ? (
              <button onClick={() => setMostrarCupon(true)}
                className="text-xs text-[#2D6A4F] underline hover:text-[#1B4332] text-left">
                ¿Tienes un código de descuento?
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  value={codigoCupon}
                  onChange={e => setCodigoCupon(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && aplicarCupon()}
                  placeholder="Código de descuento"
                  autoFocus
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
            disabled={enviando || (cuando === 'programado' && !horaProgramada)}
            className="w-full max-w-lg mx-auto block rounded-2xl bg-[#2D6A4F] text-white py-4 font-bold text-lg disabled:opacity-60 transition-opacity"
          >
            {enviando
              ? 'Enviando...'
              : cuando === 'programado'
                ? `Programar pedido · ${formatearPrecio(totalFinal)}`
                : `Pedir ahora · ${formatearPrecio(totalFinal)}`}
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
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#1A1A1A]">{menu.comercio.nombre}</h1>
              <p className="text-sm text-[#666] flex items-center gap-1 flex-wrap">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {menu.comercio.municipio}
                {Number(menu.comercio.calificacion) > 0 && (
                  <span className="ml-2">⭐ {Number(menu.comercio.calificacion).toFixed(1)}</span>
                )}
                <a href={urlComoLlegar(menu.comercio.latitud, menu.comercio.longitud, menu.comercio.municipio)}
                  target="_blank" rel="noopener noreferrer"
                  className="ml-2 text-[#2D6A4F] font-semibold underline hover:no-underline">
                  Cómo llegar
                </a>
              </p>
              <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                menu.abiertoAhora ? 'bg-[#D4EDDA] text-[#155724]' : 'bg-[#F8D7DA] text-[#721C24]'
              }`}>
                {menu.abiertoAhora ? '● Abierto' : '● Cerrado'}
              </span>
            </div>
            <button onClick={toggleFav} disabled={toggling}
              className={`flex-shrink-0 p-2 rounded-full transition-colors ${esFav ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'}`}
              title={esFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}>
              <svg className="w-5 h-5" fill={esFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
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
              {productosFiltrados.map(p => <TarjetaProducto key={p.id} p={p} cantidadItem={cantidadItem} agregar={agregar} quitar={quitar} cerrado={!menu.abiertoAhora} />)}
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
                  {prods.map(p => <TarjetaProducto key={p.id} p={p} cantidadItem={cantidadItem} agregar={agregar} quitar={quitar} cerrado={!menu.abiertoAhora} />)}
                </div>
              </section>
            ))}
            {sinSeccion.length > 0 && (
              <section>
                <h2 className="font-bold text-[#1A1A1A] text-base mb-3 pb-1 border-b border-[#E8DCC8]">Otros</h2>
                <div className="space-y-3">
                  {sinSeccion.map(p => <TarjetaProducto key={p.id} p={p} cantidadItem={cantidadItem} agregar={agregar} quitar={quitar} cerrado={!menu.abiertoAhora} />)}
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
                  {prods.map(p => <TarjetaProducto key={p.id} p={p} cantidadItem={cantidadItem} agregar={agregar} quitar={quitar} cerrado={!menu.abiertoAhora} />)}
                </div>
              </section>
            ))
          })()
        )}
        {/* RESEÑAS */}
        <div className="mt-6">
          <SeccionReviews
            reviews={reviews.map(r => ({ ...r, clienteId: r.clienteId }))}
            cargando={cargandoReviews}
            elegibleId={pedidoElegibleId}
            placeholder="¿Cómo estuvo el pedido?"
            onCrear={async (elegibleId, cal, com) => {
              const nueva = await crearReviewExpress(elegibleId, cal, com)
              return nueva as ReviewItem
            }}
            onNueva={r => setReviews(prev => [r as ReviewExpress, ...prev])}
          />
        </div>
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
                  {carrito.map((i, idx) => (
                    <div key={`${i.productoId}-${idx}`} className="text-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center gap-1">
                            <button onClick={() => quitar(i.productoId)} className="w-6 h-6 rounded-full bg-[#F0EBE3] flex items-center justify-center text-[#2D6A4F] font-bold">−</button>
                            <span className="w-5 text-center font-semibold">{i.cantidad}</span>
                            <button onClick={() => setCarrito(prev => prev.map((x, xi) => xi === idx ? { ...x, cantidad: x.cantidad + 1 } : x))} className="w-6 h-6 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center font-bold">+</button>
                          </div>
                          <span className="truncate text-[#1A1A1A]">{i.nombre}</span>
                        </div>
                        <span className="text-[#1A1A1A] font-medium ml-2 flex-shrink-0">{formatearPrecio(i.precio * i.cantidad)}</span>
                      </div>
                      {i.complementos && i.complementos.length > 0 && (
                        <p className="text-xs text-gray-400 pl-16 mt-0.5 truncate">+ {i.complementos.map(c => c.nombre).join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#E8DCC8] pt-3 flex justify-between font-bold text-[#1A1A1A]">
                  <span>Total</span>
                  <span>{formatearPrecio(totalPrecio)}</span>
                </div>
                <button
                  onClick={() => {
                    if (!autenticado) { router.push('/ingresar'); return }
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
                if (!autenticado) { router.push('/ingresar'); return }
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

      {/* Modal de complementos */}
      {productoComplemento && (
        <ModalComplementos
          producto={productoComplemento}
          onConfirmar={(complementos, precioTotal) => {
            agregarAlCarrito(productoComplemento, complementos, precioTotal)
            setProductoComplemento(null)
          }}
          onCerrar={() => setProductoComplemento(null)}
        />
      )}
    </div>
  )
}

export default function MenuExpressPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="animate-pulse text-[#2D6A4F] text-lg">Cargando menú...</div>
      </div>
    }>
      <MenuExpressContent />
    </Suspense>
  )
}
