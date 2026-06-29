import { apiFetch } from './client'

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
