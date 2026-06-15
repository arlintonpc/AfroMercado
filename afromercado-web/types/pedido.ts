import type { Producto } from './producto'

export type EstadoPedido =
  | 'PENDIENTE'
  | 'PAGADO'
  | 'EN_PREPARACION'
  | 'ENVIADO'
  | 'ENTREGADO'
  | 'CANCELADO'

export interface PedidoItem {
  productoId: string
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  producto?: Producto
}

export interface Pedido {
  id: string
  estado: EstadoPedido
  items: PedidoItem[]
  total: number
  creadoEn: string
  // Datos opcionales de envío/contacto que pueda devolver el backend.
  direccion?: string
  telefono?: string
  notas?: string
}

export interface DatosCheckout {
  direccion?: string
  telefono?: string
  notas?: string
}
