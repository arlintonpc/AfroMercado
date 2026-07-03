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
  creadoAt: string
  cliente?: { nombre: string; avatarUrl?: string | null }
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
  return r.data
}

export async function crearReviewExpress(pedidoExpressId: number, calificacion: number, comentario?: string): Promise<ReviewExpress> {
  const r = await apiFetch<{ ok: boolean; data: ReviewExpress }>(`/express/pedidos/${pedidoExpressId}/review`, {
    method: 'POST',
    body: { pedidoExpressId, calificacion, comentario },
  })
  return r.data
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
  creadoAt: string
  cliente?: { nombre: string; avatarUrl?: string | null }
}

export async function reviewsCultura(eventoCulturalId: number): Promise<ReviewCultura[]> {
  const r = await apiFetch<{ ok: boolean; data: ReviewCultura[] }>(`/cultura/${eventoCulturalId}/reviews`)
  return r.data
}

export async function crearReviewCultura(reservaCulturalId: number, calificacion: number, comentario?: string): Promise<ReviewCultura> {
  const r = await apiFetch<{ ok: boolean; data: ReviewCultura }>(`/cultura/reservas/${reservaCulturalId}/review`, {
    method: 'POST',
    body: { reservaCulturalId, calificacion, comentario },
  })
  return r.data
}
