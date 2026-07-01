import { apiFetch } from './client'

export interface ReviewTienda {
  id: number
  calificacion: number
  comentario: string | null
  createdAt: string
  comprador?: { nombre?: string | null } | null
}

interface ListarReviewsResponse {
  ok: boolean
  data:
    | { reviews?: ReviewTienda[]; promedio?: number | null; total?: number }
    | ReviewTienda[]
    | null
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
  if (Array.isArray(res.data)) {
    return {
      reviews: res.data,
      promedio: null,
      total: res.data.length,
    }
  }

  const reviews = Array.isArray(res.data?.reviews) ? res.data.reviews : []
  return {
    reviews,
    promedio: res.data?.promedio ?? null,
    total: Number(res.data?.total ?? reviews.length),
  }
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
