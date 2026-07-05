import type { CarritoItem } from '@/types/carrito'
import { precioVigente } from '@/lib/precioProducto'

export interface GrupoComercio {
  comercio: string
  municipio?: string
  items: CarritoItem[]
  subtotal: number
  /** IVA estimado de este comercio sobre `subtotal`, 0 si no tiene IVA activo. */
  iva: number
}

/**
 * Agrupa los items del carrito por nombre de comercio. Cada productor prepara
 * su parte por separado, por eso se muestran en bloques distintos.
 */
export function agruparPorComercio(items: CarritoItem[]): GrupoComercio[] {
  const mapa = new Map<string, GrupoComercio>()

  for (const it of items) {
    const comercio = it.producto?.comercio?.nombre ?? 'Productor'
    const municipio = it.producto?.comercio?.municipio
    const precio = precioVigente(it.producto)
    const sub = precio * it.cantidad
    const ivaActivo = it.producto?.comercio?.ivaActivo ?? false
    const ivaPorcentaje = it.producto?.comercio?.ivaPorcentaje ?? 0
    const iva = ivaActivo ? sub * (ivaPorcentaje / 100) : 0

    const grupo = mapa.get(comercio)
    if (grupo) {
      grupo.items.push(it)
      grupo.subtotal += sub
      grupo.iva += iva
    } else {
      mapa.set(comercio, {
        comercio,
        municipio,
        items: [it],
        subtotal: sub,
        iva,
      })
    }
  }

  return Array.from(mapa.values())
}
