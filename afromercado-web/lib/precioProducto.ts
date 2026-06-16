import type { Producto } from '@/types/producto'

export function precioVigente(producto?: Producto): number {
  if (!producto) return 0
  return producto.oferta?.precioFinal ?? producto.precio
}

export function tieneOfertaVigente(producto?: Producto): boolean {
  return Boolean(producto?.oferta)
}
