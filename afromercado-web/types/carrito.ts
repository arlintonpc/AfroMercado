import type { Producto } from './producto'

export interface CarritoItem {
  productoId: string
  cantidad: number
  precioAlAgregar?: number
  alertaPrecio?: boolean
  // El producto asociado al item. Puede venir embebido desde la API o
  // reconstruirse desde el carrito local. Opcional para tolerar respuestas
  // del backend que solo devuelvan productoId + cantidad.
  producto?: Producto
}

export interface Carrito {
  items: CarritoItem[]
  cantidadTotal: number
  subtotal: number
}
