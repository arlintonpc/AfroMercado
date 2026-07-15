import { apiFetch } from './client'

export interface ReviewTransporte {
  id: number
  configTransporteId: number
  clienteId: number
  reservaTransporteId: number
  calificacion: number
  comentario?: string | null
  creadoAt: string
  cliente?: { nombre: string; avatarUrl?: string | null }
}

export interface ReviewExpress {
  id: number
  configExpressId: number
  clienteId: number
  pedidoExpressId: number
  calificacion: number
  comentario?: string | null
  fotoUrls: string[]
  creadoAt: string
  cliente?: { nombre: string; avatarUrl?: string | null }
}

function normalizarReviewExpress(review: ReviewExpress): ReviewExpress {
  return {
    ...review,
    comentario: review.comentario ?? null,
    fotoUrls: Array.isArray(review.fotoUrls) ? review.fotoUrls : [],
    cliente: review.cliente ?? undefined,
  }
}

export async function reviewsTransporte(configTransporteId: number): Promise<ReviewTransporte[]> {
  const r = await apiFetch<{ ok: boolean; data: ReviewTransporte[] }>(`/transportes/${configTransporteId}/reviews`)
  return r.data
}

export async function crearReviewTransporte(reservaTransporteId: number, calificacion: number, comentario?: string): Promise<ReviewTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ReviewTransporte }>(`/transportes/reservas/${reservaTransporteId}/review`, {
    method: 'POST',
    body: { reservaTransporteId, calificacion, comentario },
  })
  return r.data
}

export async function reviewsExpress(comercioId: number): Promise<ReviewExpress[]> {
  const r = await apiFetch<{ ok: boolean; data: ReviewExpress[] }>(`/express/comercios/${comercioId}/reviews`)
  return Array.isArray(r.data) ? r.data.map(normalizarReviewExpress) : []
}

export async function crearReviewExpress(
  pedidoExpressId: number,
  calificacion: number,
  comentario?: string,
  fotoUrls?: string[],
): Promise<ReviewExpress> {
  const r = await apiFetch<{ ok: boolean; data: ReviewExpress }>(`/express/pedidos/${pedidoExpressId}/review`, {
    method: 'POST',
    body: { pedidoExpressId, calificacion, comentario, fotoUrls },
  })
  return normalizarReviewExpress(r.data)
}

export async function subirFotoReviewExpress(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('foto', file)
  const r = await apiFetch<{ ok: boolean; url: string }>('/express/reviews/foto', { method: 'POST', body: fd })
  return r.url
}

export interface ReviewHotel {
  id: number
  configHotelId: number
  clienteId: number
  reservaHotelId: number
  calificacion: number
  comentario?: string | null
  creadoAt: string
  cliente?: { nombre: string; avatarUrl?: string | null }
}

export interface ReviewTour {
  id: number
  configTourId: number
  clienteId: number
  reservaTourId: number
  calificacion: number
  comentario?: string | null
  creadoAt: string
  cliente?: { nombre: string; avatarUrl?: string | null }
}

export async function reviewsHotel(configHotelId: number): Promise<ReviewHotel[]> {
  const r = await apiFetch<{ ok: boolean; data: ReviewHotel[] }>(`/hoteles/${configHotelId}/reviews`)
  return r.data
}

export async function crearReviewHotel(reservaHotelId: number, calificacion: number, comentario?: string): Promise<ReviewHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReviewHotel }>(`/hoteles/reservas/${reservaHotelId}/review`, {
    method: 'POST',
    body: { reservaHotelId, calificacion, comentario },
  })
  return r.data
}

export async function reviewsTour(configTourId: number): Promise<ReviewTour[]> {
  const r = await apiFetch<{ ok: boolean; data: ReviewTour[] }>(`/tours/${configTourId}/reviews`)
  return r.data
}

export async function crearReviewTour(reservaTourId: number, calificacion: number, comentario?: string): Promise<ReviewTour> {
  const r = await apiFetch<{ ok: boolean; data: ReviewTour }>(`/tours/reservas/${reservaTourId}/review`, {
    method: 'POST',
    body: { reservaTourId, calificacion, comentario },
  })
  return r.data
}

export interface ReviewCultura {
  id: number
  eventoCulturalId: number
  clienteId: number
  reservaCulturalId: number
  calificacion: number
  comentario?: string | null
  fotoUrls: string[]
  videoUrl?: string | null
  creadoAt: string
  cliente?: { nombre: string; avatarUrl?: string | null }
}

function normalizarReviewCultura(review: ReviewCultura): ReviewCultura {
  return {
    ...review,
    comentario: review.comentario ?? null,
    fotoUrls: Array.isArray(review.fotoUrls) ? review.fotoUrls : [],
    videoUrl: review.videoUrl ?? null,
    cliente: review.cliente ?? undefined,
  }
}

export async function reviewsCultura(eventoCulturalId: number): Promise<ReviewCultura[]> {
  const r = await apiFetch<{ ok: boolean; data: ReviewCultura[] }>(`/cultura/${eventoCulturalId}/reviews`)
  return Array.isArray(r.data) ? r.data.map(normalizarReviewCultura) : []
}

export async function crearReviewCultura(
  reservaCulturalId: number,
  calificacion: number,
  comentario?: string,
  adjuntos?: { fotoUrls?: string[]; videoUrl?: string | null },
): Promise<ReviewCultura> {
  const r = await apiFetch<{ ok: boolean; data: ReviewCultura }>(`/cultura/reservas/${reservaCulturalId}/review`, {
    method: 'POST',
    body: {
      reservaCulturalId,
      calificacion,
      comentario,
      fotoUrls: adjuntos?.fotoUrls,
      videoUrl: adjuntos?.videoUrl,
    },
  })
  return normalizarReviewCultura(r.data)
}

export async function subirFotoReviewCultura(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('foto', file)
  const r = await apiFetch<{ ok: boolean; url: string }>('/cultura/reviews/foto', { method: 'POST', body: fd })
  return r.url
}

export async function subirVideoReviewCultura(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('video', file)
  const r = await apiFetch<{ ok: boolean; url: string }>('/cultura/reviews/video', { method: 'POST', body: fd })
  return r.url
}

export interface ReviewGaleria extends ReviewCultura {
  evento: { id: number; titulo: string; municipio: string; departamento: string }
}

export async function galeriaCultura(page = 1, departamento?: string): Promise<{ items: ReviewGaleria[]; total: number; pagina: number }> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (departamento) params.set('departamento', departamento)
  const r = await apiFetch<{ ok: boolean; data: { items: ReviewGaleria[]; total: number; pagina: number } }>(`/cultura/galeria?${params.toString()}`)
  return {
    ...r.data,
    items: Array.isArray(r.data.items)
      ? r.data.items.map((item) => ({
          ...normalizarReviewCultura(item),
          evento: item.evento,
        }))
      : [],
  }
}
