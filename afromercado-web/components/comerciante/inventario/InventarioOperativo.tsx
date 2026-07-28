'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList,
  PackageMinus, Plus, RotateCcw, Search, X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  crearAjuste, crearCompra, listarMovimientos, obtenerInventario,
  type InventarioData, type MovimientoInventario, type ProductoInventario,
  type TipoMovimientoInventario,
} from '@/app/comerciante/inventario/api'

const tipos: Record<TipoMovimientoInventario, { etiqueta: string; clase: string; icono: typeof ArrowDownToLine }> = {
  COMPRA: { etiqueta: 'Compra', clase: 'bg-[#2D6A4F]/10 text-[#2D6A4F]', icono: ArrowDownToLine },
  AJUSTE_ENTRADA: { etiqueta: 'Ajuste de entrada', clase: 'bg-sky-50 text-sky-700', icono: Plus },
  AJUSTE_SALIDA: { etiqueta: 'Ajuste de salida', clase: 'bg-orange-50 text-orange-700', icono: PackageMinus },
  VENTA: { etiqueta: 'Venta', clase: 'bg-[#D4A017]/15 text-[#8A6500]', icono: ArrowUpFromLine },
  DEVOLUCION_CLIENTE: { etiqueta: 'Devolución', clase: 'bg-violet-50 text-violet-700', icono: RotateCcw },
  MERMA: { etiqueta: 'Merma', clase: 'bg-red-50 text-red-700', icono: AlertTriangle },
}

const tiposRegistrables: Array<Exclude<TipoMovimientoInventario, 'VENTA'>> = [
  'COMPRA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'DEVOLUCION_CLIENTE', 'MERMA',
]
const entradas: TipoMovimientoInventario[] = ['COMPRA', 'AJUSTE_ENTRADA', 'DEVOLUCION_CLIENTE']

function fecha(iso: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

function Estado({ producto }: { producto: ProductoInventario }) {
  if (producto.stockDisponible <= 0) return <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Agotado</span>
  if (producto.stockDisponible <= producto.stockMinimo) return <span className="rounded-full border border-[#D4A017]/25 bg-[#D4A017]/10 px-2.5 py-1 text-xs font-semibold text-[#8A6500]">Stock bajo</span>
  return <span className="rounded-full bg-[#2D6A4F]/10 px-2.5 py-1 text-xs font-semibold text-[#2D6A4F]">Disponible</span>
}

function TarjetaResumen({ titulo, valor, ayuda, tono = 'verde', icono: Icon }: {
  titulo: string; valor: string; ayuda: string; tono?: 'verde' | 'dorado' | 'rojo' | 'tinta'; icono: typeof Boxes
}) {
  const colores = {
    verde: 'border-[#2D6A4F]/15 bg-[#52B788]/8 text-[#2D6A4F]',
    dorado: 'border-[#D4A017]/20 bg-[#D4A017]/9 text-[#8A6500]',
    rojo: 'border-red-200 bg-red-50 text-red-700',
    tinta: 'border-[#1A1A1A]/10 bg-[#1A1A1A]/[0.03] text-[#1A1A1A]',
  }
  return <div className={`rounded-2xl border p-4 ${colores[tono]}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide opacity-70">{titulo}</p><p className="mt-1 text-2xl font-bold">{valor}</p><p className="mt-1 text-xs opacity-70">{ayuda}</p></div><Icon size={21} strokeWidth={1.8} /></div></div>
}

function ModalMovimiento({ productos, cerrar, recargar }: { productos: ProductoInventario[]; cerrar: () => void; recargar: () => Promise<void> }) {
  const [productoId, setProductoId] = useState(productos[0]?.id ?? 0)
  const [tipo, setTipo] = useState<Exclude<TipoMovimientoInventario, 'VENTA'>>('COMPRA')
  const [cantidad, setCantidad] = useState(1)
  const [costo, setCosto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!productoId || cantidad <= 0) return setError('Selecciona un producto y escribe una cantidad mayor que cero.')
    if (tipo === 'COMPRA' && (!costo || Number(costo) < 0)) return setError('Escribe un costo unitario válido para la compra.')
    if (tipo !== 'COMPRA' && !motivo.trim()) return setError('El motivo es obligatorio para ajustes, devoluciones y mermas.')
    setGuardando(true); setError(null)
    try {
      if (tipo === 'COMPRA') {
        await crearCompra({ productoId, cantidad, costoUnitario: Number(costo), notas: motivo.trim() || undefined })
      } else {
        await crearAjuste({ productoId, tipo, cantidad, motivo: motivo.trim() })
      }
      await recargar(); cerrar()
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No pudimos registrar el movimiento.')
    } finally { setGuardando(false) }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A1A1A]/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-movimiento">
    <form onSubmit={enviar} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-[#1A1A1A]/8 pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2D6A4F]">Kardex</p><h2 id="titulo-movimiento" className="mt-1 text-2xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Registrar movimiento</h2></div><button type="button" onClick={cerrar} className="rounded-full p-2 text-[#1A1A1A]/50 hover:bg-[#1A1A1A]/5" aria-label="Cerrar"><X size={20} /></button></div>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-[#1A1A1A]/75">Producto<select value={productoId} onChange={(e) => setProductoId(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#1A1A1A]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2D6A4F]">{productos.map((producto) => <option key={producto.id} value={producto.id}>{producto.nombre} · {producto.stockDisponible} disponibles</option>)}</select></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-[#1A1A1A]/75">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value as Exclude<TipoMovimientoInventario, 'VENTA'>)} className="mt-1.5 w-full rounded-xl border border-[#1A1A1A]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2D6A4F]">{tiposRegistrables.map((item) => <option key={item} value={item}>{tipos[item].etiqueta}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]/75">Cantidad<input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#1A1A1A]/15 px-3 py-2.5 text-sm outline-none focus:border-[#2D6A4F]" /></label></div>
        {tipo === 'COMPRA' && <label className="block text-sm font-semibold text-[#1A1A1A]/75">Costo unitario (COP)<input type="number" min="0" step="1" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="Ej. 12500" className="mt-1.5 w-full rounded-xl border border-[#1A1A1A]/15 px-3 py-2.5 text-sm outline-none focus:border-[#2D6A4F]" /><span className="mt-1 block text-xs font-normal text-[#1A1A1A]/45">Se recalcula el costo promedio ponderado al recibir la compra.</span></label>}
        <label className="block text-sm font-semibold text-[#1A1A1A]/75">Motivo o nota {tipo !== 'COMPRA' && <span className="text-[#C0392B]">*</span>}<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Describe el motivo del movimiento" className="mt-1.5 w-full resize-none rounded-xl border border-[#1A1A1A]/15 px-3 py-2.5 text-sm outline-none focus:border-[#2D6A4F]" /></label>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={cerrar}>Cancelar</Button><Button type="submit" loading={guardando}>Guardar movimiento</Button></div>
    </form>
  </div>
}

export default function InventarioOperativo() {
  const [data, setData] = useState<InventarioData | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'TODOS' | 'BAJO' | 'AGOTADO'>('TODOS')
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoInventario | 'TODOS'>('TODOS')
  const [modal, setModal] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const [inventario, historial] = await Promise.all([obtenerInventario(), listarMovimientos()])
      setData(inventario); setMovimientos(historial.length ? historial : inventario.movimientosRecientes)
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No pudimos cargar el inventario.') }
    finally { setCargando(false) }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const productos = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es-CO')
    return (data?.productos ?? []).filter((producto) => (!texto || producto.nombre.toLocaleLowerCase('es-CO').includes(texto)) && (filtro === 'TODOS' || filtro === 'AGOTADO' ? producto.stockDisponible <= 0 : producto.stockDisponible > 0 && producto.stockDisponible <= producto.stockMinimo))
  }, [busqueda, filtro, data?.productos])
  const historial = useMemo(() => tipoMovimiento === 'TODOS' ? movimientos : movimientos.filter((movimiento) => movimiento.tipo === tipoMovimiento), [movimientos, tipoMovimiento])

  if (cargando) return <div className="py-20 text-center text-sm text-[#1A1A1A]/45">Cargando inventario…</div>
  if (error || !data) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><p className="font-semibold text-red-700">El inventario aún no está disponible</p><p className="mt-1 text-sm text-red-600">{error ?? 'Intenta nuevamente en unos minutos.'}</p><Button variant="secondary" className="mt-4" onClick={() => void cargar()}>Reintentar</Button></div>

  return <div className="space-y-6 pb-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href="/comerciante/dashboard" className="text-xs text-[#1A1A1A]/45 hover:text-[#2D6A4F]">← Panel de vendedor</Link><h1 className="mt-1 text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Inventario operativo</h1><p className="mt-1 text-sm text-[#1A1A1A]/55">Controla existencias, costos y movimientos de tus productos.</p></div><div className="flex gap-2"><Link href="/comerciante/inventario/proveedores"><Button variant="secondary">Proveedores</Button></Link><Button onClick={() => setModal(true)}><Plus size={18} /> Registrar movimiento</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><TarjetaResumen titulo="Productos" valor={String(data.resumen.totalProductos)} ayuda="referencias controladas" icono={Boxes} /><TarjetaResumen titulo="Unidades disponibles" valor={data.resumen.unidadesDisponibles.toLocaleString('es-CO')} ayuda="sin contar las reservadas" tono="tinta" icono={ClipboardList} /><TarjetaResumen titulo="Stock bajo" valor={String(data.resumen.stockBajo)} ayuda="requieren reposición" tono="dorado" icono={AlertTriangle} /><TarjetaResumen titulo="Agotados" valor={String(data.resumen.agotados)} ayuda="sin unidades para vender" tono="rojo" icono={PackageMinus} /></div>
    <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white px-4 py-3 text-sm text-[#1A1A1A]/60">{data.resumen.mensajeMargen}</div>
    <section className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-[#1A1A1A]/6 px-4 py-4 sm:px-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-[#1A1A1A]">Existencias</h2><p className="text-xs text-[#1A1A1A]/45">Stock disponible = existencias físicas − unidades reservadas.</p></div><Link href="/comerciante/mis-productos" className="text-sm font-semibold text-[#2D6A4F] hover:underline">Gestionar productos</Link></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative block flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40" /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto" className="w-full rounded-xl border border-[#1A1A1A]/12 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2D6A4F]" /></label><div className="flex rounded-xl border border-[#1A1A1A]/12 p-1">{([{ valor: 'TODOS', etiqueta: 'Todos' }, { valor: 'BAJO', etiqueta: 'Stock bajo' }, { valor: 'AGOTADO', etiqueta: 'Agotados' }] as const).map((opcion) => <button key={opcion.valor} onClick={() => setFiltro(opcion.valor)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === opcion.valor ? 'bg-[#2D6A4F] text-white' : 'text-[#1A1A1A]/55 hover:bg-[#F8F5F0]'}`}>{opcion.etiqueta}</button>)}</div></div></div><div className="overflow-x-auto"><table className="min-w-[800px] w-full text-sm"><thead className="bg-[#F8F5F0]/65 text-left text-xs font-semibold text-[#1A1A1A]/50"><tr><th className="px-5 py-3">Producto</th><th className="px-4 py-3">Disponible</th><th className="px-4 py-3">Reservado</th><th className="px-4 py-3">Mínimo</th><th className="px-4 py-3">Costo promedio</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-[#1A1A1A]/6">{productos.length ? productos.map((producto) => <tr key={producto.id} className="hover:bg-[#F8F5F0]/45"><td className="px-5 py-3.5"><p className="font-semibold text-[#1A1A1A]">{producto.nombre}</p><p className="text-xs text-[#1A1A1A]/42">{producto.unidad}</p></td><td className="px-4 py-3.5 font-semibold text-[#1A1A1A]">{producto.stockDisponible}</td><td className="px-4 py-3.5 text-[#1A1A1A]/60">{producto.stockReservado}</td><td className="px-4 py-3.5 text-[#1A1A1A]/60">{producto.stockMinimo}</td><td className="px-4 py-3.5 text-[#1A1A1A]/70">{formatearPrecio(producto.costoPromedio)}</td><td className="px-4 py-3.5"><Estado producto={producto} /></td></tr>) : <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#1A1A1A]/45">No hay productos que coincidan con el filtro.</td></tr>}</tbody></table></div></section>
    <section className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-[#1A1A1A]/6 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="font-semibold text-[#1A1A1A]">Movimientos recientes</h2><p className="text-xs text-[#1A1A1A]/45">Trazabilidad de entradas, salidas y ajustes.</p></div><select value={tipoMovimiento} onChange={(e) => setTipoMovimiento(e.target.value as TipoMovimientoInventario | 'TODOS')} className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm text-[#1A1A1A]/70 outline-none focus:border-[#2D6A4F]"><option value="TODOS">Todos los movimientos</option>{Object.entries(tipos).map(([tipo, detalle]) => <option key={tipo} value={tipo}>{detalle.etiqueta}</option>)}</select></div><div className="divide-y divide-[#1A1A1A]/6">{historial.length ? historial.slice(0, 8).map((movimiento) => { const detalle = tipos[movimiento.tipo]; const Icono = detalle.icono; return <div key={movimiento.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${detalle.clase}`}><Icono size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#1A1A1A]">{movimiento.producto?.nombre ?? `Producto #${movimiento.productoId}`}</p><p className="truncate text-xs text-[#1A1A1A]/45">{detalle.etiqueta}{movimiento.nota ? ` · ${movimiento.nota}` : ''}</p></div><div className="hidden text-right sm:block"><p className="text-sm font-semibold text-[#1A1A1A]">{movimiento.saldoAnterior} → {movimiento.saldoPosterior}</p><p className="text-xs text-[#1A1A1A]/42">{fecha(movimiento.createdAt)}</p></div><span className={`text-sm font-bold ${entradas.includes(movimiento.tipo) ? 'text-[#2D6A4F]' : 'text-[#1A1A1A]/65'}`}>{movimiento.cantidad > 0 ? '+' : ''}{movimiento.cantidad}</span></div> }) : <div className="px-5 py-12 text-center text-sm text-[#1A1A1A]/45">Aún no hay movimientos registrados.</div>}</div></section>
    {modal && <ModalMovimiento productos={data.productos} cerrar={() => setModal(false)} recargar={cargar} />}
  </div>
}
