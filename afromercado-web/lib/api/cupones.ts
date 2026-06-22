import { apiFetch } from './client'

export interface ResultadoCupon {
  cupon: { id: number; codigo: string; tipo: string; valor: number }
  descuento: number
  totalConDescuento: number
}

export interface OpcionesCupon {
  /** IDs de los comercios presentes en el carrito (para cupones de tienda). */
  comercioIds?: number[]
  /** Subtotal por comercio { comercioId: subtotal } — hace que el descuento
   *  estimado coincida exactamente con el del checkout para cupones de tienda. */
  subtotalesPorComercio?: Record<number, number>
}

export async function validarCupon(
  codigo: string,
  subtotal: number,
  opciones: OpcionesCupon = {},
): Promise<ResultadoCupon> {
  const res = await apiFetch<{ ok: boolean; data: ResultadoCupon }>('/cupones/validar', {
    method: 'POST',
    body: {
      codigo,
      subtotal,
      ...(opciones.comercioIds?.length ? { comercioIds: opciones.comercioIds } : {}),
      ...(opciones.subtotalesPorComercio ? { subtotalesPorComercio: opciones.subtotalesPorComercio } : {}),
    },
  })
  return res.data
}
