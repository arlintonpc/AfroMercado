import { apiFetch } from './client'

export interface ReviewTienda {
  id: number
  calificacion: number
  comentario: string | null
  createdAt: string
  comprador: { nombre: string }
}

interface ListarReviewsResponse {
  ok: boolean
  data: { reviews: ReviewTienda[]; promedio: number | null; total: number }
}

interface PuedeCalificarResponse {
  ok: boolean
  data: { puede: boolean; yaCalifico: boolean }
}

interface CrearReviewResponse {
  ok: boolean
  data: ReviewTienda
}

export async function listarReviewsTienda(
  comercioId: number,
): Promise<{ reviews: ReviewTienda[]; promedio: number | null; total: number }> {
  const res = await apiFetch<ListarReviewsResponse>(`/reviews/comercio/${comercioId}`, { auth: false })
  return res.data
}

export async function puedeCalificarTienda(
  pedidoId: number,
): Promise<{ puede: boolean; yaCalifico: boolean }> {
  const res = await apiFetch<PuedeCalificarResponse>(`/reviews/puede-calificar-tienda/${pedidoId}`)
  return res.data
}

export async function crearReviewTienda(data: {
  pedidoId: number
  calificacion: number
  comentario?: string
}): Promise<ReviewTienda> {
  const res = await apiFetch<CrearReviewResponse>('/reviews/tienda', {
    method: 'POST',
    body: data,
  })
  return res.data
}
