import { apiFetch } from './client'

export async function puedeCalificarProducto(
  productoId: number,
): Promise<{ puede: boolean; yaCalifico: boolean }> {
  const res = await apiFetch<{ ok: boolean; data: { puede: boolean; yaCalifico: boolean } }>(
    `/reviews/puede-calificar/${productoId}`,
  )
  return res.data
}

export async function crearReviewProducto(data: {
  productoId: number
  calificacion: number
  comentario?: string
}): Promise<void> {
  await apiFetch<{ ok: boolean }>('/reviews', {
    method: 'POST',
    body: data,
  })
}
