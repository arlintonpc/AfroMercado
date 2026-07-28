import { apiFetch } from '@/lib/api/client'

export type TipoMovimientoInventario =
  | 'COMPRA'
  | 'AJUSTE_ENTRADA'
  | 'AJUSTE_SALIDA'
  | 'VENTA'
  | 'DEVOLUCION_CLIENTE'
  | 'MERMA'

type NumeroApi = unknown
const numero = (valor: NumeroApi) => Number(valor ?? 0)
const idempotencyKey = () => globalThis.crypto?.randomUUID?.() ?? `inv-${Date.now()}-${Math.random().toString(36).slice(2)}`

export interface ProductoInventario {
  id: number
  nombre: string
  fotoUrl?: string | null
  unidad: string
  stock: number
  stockReservado: number
  stockDisponible: number
  stockMinimo: number
  costoPromedio: number
  valorInventario: number
}

export interface MovimientoInventario {
  id: number
  productoId: number
  tipo: TipoMovimientoInventario
  cantidad: number
  saldoAnterior: number
  saldoPosterior: number
  costoUnitario: number
  nota?: string | null
  createdAt: string
  producto?: Pick<ProductoInventario, 'id' | 'nombre' | 'fotoUrl' | 'unidad'>
}

export interface ProveedorInventario {
  id: number
  nombre: string
  nit?: string | null
  telefono?: string | null
  email?: string | null
  activo: boolean
}

export interface ResumenInventario {
  totalProductos: number
  unidadesDisponibles: number
  valorInventario: number
  stockBajo: number
  agotados: number
  mensajeMargen?: string
}

export interface InventarioData {
  resumen: ResumenInventario
  productos: ProductoInventario[]
  movimientosRecientes: MovimientoInventario[]
}

export interface CrearAjusteInventario {
  productoId: number
  tipo: Exclude<TipoMovimientoInventario, 'VENTA' | 'COMPRA'>
  cantidad: number
  motivo: string
}

export interface CrearCompraInventario {
  productoId: number
  cantidad: number
  costoUnitario: number
  proveedorId?: number
  notas?: string
}

function mapearProducto(producto: Record<string, unknown>): ProductoInventario {
  const stock = numero(producto.stock)
  const stockReservado = numero(producto.stockReservado)
  const costoPromedio = numero(producto.costoPromedio)
  return {
    id: Number(producto.id), nombre: String(producto.nombre), unidad: String(producto.unidad),
    fotoUrl: (producto.fotoUrl as string | null | undefined) ?? null,
    stock, stockReservado, stockDisponible: Math.max(0, stock - stockReservado),
    stockMinimo: numero(producto.stockMinimo), costoPromedio,
    valorInventario: Number((stock * costoPromedio).toFixed(2)),
  }
}

function mapearMovimiento(movimiento: Record<string, unknown>): MovimientoInventario {
  const producto = movimiento.producto as Record<string, unknown> | undefined
  return {
    id: Number(movimiento.id), productoId: Number(movimiento.productoId),
    tipo: movimiento.tipo as TipoMovimientoInventario, cantidad: numero(movimiento.cantidad),
    saldoAnterior: numero(movimiento.stockAnterior), saldoPosterior: numero(movimiento.stockPosterior),
    costoUnitario: numero(movimiento.costoUnitario), nota: (movimiento.motivo as string | null | undefined) ?? null,
    createdAt: String(movimiento.createdAt),
    producto: producto ? { id: Number(producto.id), nombre: String(producto.nombre), fotoUrl: (producto.fotoUrl as string | null | undefined) ?? null, unidad: String(producto.unidad) } : undefined,
  }
}

export async function obtenerInventario(): Promise<InventarioData> {
  const respuesta = await apiFetch<{ ok: boolean; data: Record<string, unknown> }>('/inventario/resumen')
  const data = respuesta.data
  const resumenApi = data.resumen as Record<string, unknown>
  const productos = ((data.productos as Record<string, unknown>[]) ?? []).map(mapearProducto)
  return {
    resumen: {
      totalProductos: numero(resumenApi.productos),
      unidadesDisponibles: productos.reduce((total, producto) => total + producto.stockDisponible, 0),
      valorInventario: numero(resumenApi.valorInventario),
      stockBajo: ((resumenApi.stockBajo as unknown[]) ?? []).length,
      agotados: productos.filter((producto) => producto.stockDisponible <= 0).length,
      mensajeMargen: resumenApi.mensajeMargen as string | undefined,
    },
    productos,
    movimientosRecientes: ((data.movimientos as Record<string, unknown>[]) ?? []).map(mapearMovimiento),
  }
}

export async function listarMovimientos(params?: { productoId?: number; tipo?: TipoMovimientoInventario | 'TODOS' }): Promise<MovimientoInventario[]> {
  const query = new URLSearchParams()
  if (params?.productoId) query.set('productoId', String(params.productoId))
  if (params?.tipo && params.tipo !== 'TODOS') query.set('tipo', params.tipo)
  const sufijo = query.size ? `?${query.toString()}` : ''
  const respuesta = await apiFetch<{ ok: boolean; movimientos: Record<string, unknown>[] }>(`/inventario/movimientos${sufijo}`)
  return (respuesta.movimientos ?? []).map(mapearMovimiento)
}

export async function crearAjuste(datos: CrearAjusteInventario): Promise<MovimientoInventario> {
  const respuesta = await apiFetch<{ ok: boolean; movimiento: Record<string, unknown> }>('/inventario/movimientos', {
    method: 'POST', body: { ...datos, idempotencyKey: idempotencyKey() },
  })
  return mapearMovimiento(respuesta.movimiento)
}

export async function crearCompra(datos: CrearCompraInventario): Promise<void> {
  await apiFetch('/inventario/compras', {
    method: 'POST',
    body: {
      idempotencyKey: idempotencyKey(), proveedorId: datos.proveedorId,
      notas: datos.notas,
      items: [{ productoId: datos.productoId, cantidad: datos.cantidad, costoUnitario: datos.costoUnitario }],
    },
  })
}

export async function listarProveedores(): Promise<ProveedorInventario[]> {
  const respuesta = await apiFetch<{ ok: boolean; proveedores: ProveedorInventario[] }>('/inventario/proveedores')
  return respuesta.proveedores ?? []
}

export async function crearProveedor(datos: Omit<ProveedorInventario, 'id' | 'activo'>): Promise<ProveedorInventario> {
  const respuesta = await apiFetch<{ ok: boolean; proveedor: ProveedorInventario }>('/inventario/proveedores', { method: 'POST', body: datos })
  return respuesta.proveedor
}
