import type { CarritoItem } from '@/types/carrito'

export interface GrupoComercio {
  comercio: string
  municipio?: string
  items: CarritoItem[]
  subtotal: number
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
    const precio = it.producto?.precio ?? 0
    const sub = precio * it.cantidad

    const grupo = mapa.get(comercio)
    if (grupo) {
      grupo.items.push(it)
      grupo.subtotal += sub
    } else {
      mapa.set(comercio, {
        comercio,
        municipio,
        items: [it],
        subtotal: sub,
      })
    }
  }

  return Array.from(mapa.values())
}
