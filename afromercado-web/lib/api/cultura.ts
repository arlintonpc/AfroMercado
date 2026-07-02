import { apiFetch } from './client'

export type EstadoEventoCultural = 'BORRADOR' | 'PUBLICADO' | 'FINALIZADO' | 'CANCELADO'
export type EstadoReservaCultural = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'RECHAZADA' | 'USADA'

export interface EntradaCultural {
  id: number
  eventoCulturalId: number
  nombre: string
  descripcion?: string | null
  precio: number | string
  cupo?: number | null
  vendidas: number
  activa: boolean
  orden: number
  creadoAt: string
  updatedAt: string
}

export interface EventoCultural {
  id: number
  comercioId?: number | null
  titulo: string
  descripcion?: string | null
  categoria?: string | null
  departamento: string
  municipio: string
  lugar?: string | null
  latitud?: number | null
  longitud?: number | null
  fechaInicio: string
  fechaFin?: string | null
  portadaUrl?: string | null
  fotos: string[]
  videoUrl?: string | null
  patrimonio: boolean
  patrimonioNota?: string | null
  gratuito: boolean
  destacado: boolean
  estado: EstadoEventoCultural
  creadoAt: string
  updatedAt: string
  entradas?: EntradaCultural[]
  comercio?: { id: number; nombre: string; municipio: string; whatsapp?: string | null } | null
}

export interface ReservaCultural {
  id: number
  codigo: string
  eventoCulturalId: number
  entradaCulturalId: number
  clienteId: number
  cantidad: number
  total: number | string
  estado: EstadoReservaCultural
  metodoPago: string
  nombreContacto: string
  telefonoContacto: string
  creadoAt: string
  updatedAt: string
  evento?: EventoCultural
  entrada?: EntradaCultural
}

export async function listarAgenda(params: { departamento?: string; municipio?: string; categoria?: string } = {}): Promise<EventoCultural[]> {
  const qs = new URLSearchParams()
  if (params.departamento) qs.set('departamento', params.departamento)
  if (params.municipio) qs.set('municipio', params.municipio)
  if (params.categoria) qs.set('categoria', params.categoria)
  const q = qs.toString()
  const r = await apiFetch<{ ok: boolean; data: EventoCultural[] }>(`/cultura${q ? `?${q}` : ''}`)
  return r.data
}

export async function obtenerEvento(id: number): Promise<EventoCultural> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural }>(`/cultura/${id}`)
  return r.data
}

export async function crearReservaCultural(datos: {
  entradaCulturalId: number
  cantidad: number
  metodoPago?: string
  notasCliente?: string
  nombreContacto: string
  telefonoContacto: string
}): Promise<ReservaCultural> {
  const r = await apiFetch<{ ok: boolean; data: ReservaCultural }>('/cultura/reservas', { method: 'POST', body: datos })
  return r.data
}

export async function misReservasCultura(): Promise<ReservaCultural[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaCultural[] }>('/cultura/reservas/mis')
  return r.data
}

export async function cancelarReservaCultura(id: number): Promise<ReservaCultural> {
  const r = await apiFetch<{ ok: boolean; data: ReservaCultural }>(`/cultura/reservas/${id}/cancelar`, { method: 'PATCH' })
  return r.data
}

/** Precio más bajo entre las entradas activas (para el "desde $"). null si no hay entradas. */
export function precioDesde(evento: EventoCultural): number | null {
  const activas = (evento.entradas ?? []).filter((e) => e.activa)
  if (activas.length === 0) return null
  return Math.min(...activas.map((e) => Number(e.precio)))
}

// ── Organizador (comercio) ───────────────────────────────────

export interface EventoInput {
  titulo: string
  departamento: string
  municipio: string
  fechaInicio: string
  descripcion?: string
  categoria?: string
  lugar?: string
  fechaFin?: string
  portadaUrl?: string
  gratuito?: boolean
  patrimonio?: boolean
  patrimonioNota?: string
  estado?: EstadoEventoCultural
}

export interface EntradaInput {
  nombre: string
  precio: number
  descripcion?: string
  cupo?: number | null
  activa?: boolean
  orden?: number
}

export async function misEventosCultura(): Promise<EventoCultural[]> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural[] }>('/cultura/mis-eventos')
  return r.data
}

export async function crearEventoCultura(datos: EventoInput): Promise<EventoCultural> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural }>('/cultura/mis-eventos', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarEventoCultura(id: number, datos: Partial<EventoInput>): Promise<EventoCultural> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural }>(`/cultura/mis-eventos/${id}`, { method: 'PATCH', body: datos })
  return r.data
}

export async function crearEntradaCultura(eventoId: number, datos: EntradaInput): Promise<EntradaCultural> {
  const r = await apiFetch<{ ok: boolean; data: EntradaCultural }>(`/cultura/mis-eventos/${eventoId}/entradas`, { method: 'POST', body: datos })
  return r.data
}

export async function actualizarEntradaCultura(entradaId: number, datos: Partial<EntradaInput>): Promise<EntradaCultural> {
  const r = await apiFetch<{ ok: boolean; data: EntradaCultural }>(`/cultura/entradas/${entradaId}`, { method: 'PATCH', body: datos })
  return r.data
}

export async function eliminarEntradaCultura(entradaId: number): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/cultura/entradas/${entradaId}`, { method: 'DELETE' })
}
