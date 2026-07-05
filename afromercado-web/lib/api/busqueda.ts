import { apiFetch } from './client'

export interface ResultadoBusqueda {
  productos: { id: number; nombre: string; precio: number | string; fotoUrl: string | null; comercio: { id: number; municipio: string; calificacion: number | string } }[]
  hoteles: { id: number; comercio: { id: number; nombre: string; municipio: string; calificacion: number | string }; habitaciones: { fotos: string[]; precioPorNoche: number | string }[] }[]
  tours: { id: number; nombre: string; precioPersona: number | string; fotos: string[]; comercio: { id: number; municipio: string; calificacion: number | string } }[]
  transportes: { id: number; nombre: string; tipo: string; fotos: string[]; comercio: { id: number; municipio: string; calificacion: number | string } }[]
  pagina: number
}

export interface FiltrosBusqueda {
  categoria?: number
  precioMin?: number
  precioMax?: number
  calificacionMin?: number
  lat?: number
  lng?: number
  radioKm?: number
  page?: number
}

export async function busquedaGlobal(q: string, filtros: FiltrosBusqueda = {}): Promise<ResultadoBusqueda> {
  const params = new URLSearchParams({ q })
  if (filtros.categoria) params.set('categoria', String(filtros.categoria))
  if (filtros.precioMin != null) params.set('precioMin', String(filtros.precioMin))
  if (filtros.precioMax != null) params.set('precioMax', String(filtros.precioMax))
  if (filtros.calificacionMin != null) params.set('calificacionMin', String(filtros.calificacionMin))
  if (filtros.lat != null) params.set('lat', String(filtros.lat))
  if (filtros.lng != null) params.set('lng', String(filtros.lng))
  if (filtros.radioKm != null) params.set('radioKm', String(filtros.radioKm))
  if (filtros.page) params.set('page', String(filtros.page))
  const r = await apiFetch<{ ok: boolean; data: ResultadoBusqueda }>(`/busqueda?${params.toString()}`)
  return r.data
}

export interface Sugerencia {
  tipo: 'PRODUCTO' | 'HOTEL' | 'TOUR' | 'TRANSPORTE'
  id: number
  texto: string
}

export async function sugerenciasBusqueda(q: string): Promise<Sugerencia[]> {
  const r = await apiFetch<{ ok: boolean; data: Sugerencia[] }>(`/busqueda/sugerencias?q=${encodeURIComponent(q)}`)
  return r.data
}
