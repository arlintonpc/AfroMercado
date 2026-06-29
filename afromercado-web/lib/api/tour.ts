import { apiFetch } from './client'

export type EstadoReservaTour = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'RECHAZADA' | 'COMPLETADA'

export interface ConfigTour {
  id: number
  comercioId: number
  activo: boolean
  nombre: string
  descripcion?: string | null
  duracionHoras: number
  precioPersona: number | string
  maxParticipantes: number
  puntoEncuentro?: string | null
  fotos: string[]
  servicios: string[]
  idiomas: string[]
  confirmacionAuto: boolean
  horasLimiteConfirm: number
  politicaCancelacion?: string | null
  creadoAt: string
  updatedAt: string
  comercio: {
    id: number
    nombre: string
    municipio: string
    departamento?: string | null
    latitud?: number | null
    longitud?: number | null
    logoUrl?: string | null
    calificacion: number | string
    totalReviews: number
    whatsapp?: string | null
    descripcion?: string | null
  }
}

export interface ReservaTour {
  id: number
  codigo: string
  configTourId: number
  clienteId?: number
  fechaTour: string
  participantes: number
  total: number | string
  estado: EstadoReservaTour
  metodoPago: string
  notasCliente?: string | null
  nombreContacto: string
  telefonoContacto: string
  creadoAt: string
  configTour?: ConfigTour
  cliente?: { id: number; nombre: string; email: string; telefono?: string | null }
}

// ── PÚBLICO ─────────────────────────────────────────────────
export async function listarTours(params?: { municipio?: string; departamento?: string }): Promise<ConfigTour[]> {
  const q = new URLSearchParams(params as Record<string, string> ?? {}).toString()
  const r = await apiFetch<{ ok: boolean; data: ConfigTour[] }>(`/tours${q ? `?${q}` : ''}`)
  return r.data
}

export async function obtenerTour(id: number): Promise<ConfigTour> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>(`/tours/${id}`)
  return r.data
}

export async function verificarDisponibilidadTour(configTourId: number, fecha: string): Promise<{ disponibles: number; maxParticipantes: number }> {
  const r = await apiFetch<{ ok: boolean; data: { disponibles: number; maxParticipantes: number } }>(
    `/tours/disponibilidad?configTourId=${configTourId}&fecha=${fecha}`
  )
  return r.data
}

// ── CLIENTE ──────────────────────────────────────────────────
export async function crearReservaTour(datos: {
  configTourId: number
  fechaTour: string
  participantes: number
  metodoPago: string
  notasCliente?: string
  nombreContacto: string
  telefonoContacto: string
}): Promise<ReservaTour> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTour }>('/tours/reservas', { method: 'POST', body: datos })
  return r.data
}

export async function misReservasTour(): Promise<ReservaTour[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTour[] }>('/tours/reservas/mis')
  return r.data
}

export async function cancelarReservaTour(id: number): Promise<ReservaTour> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTour }>(`/tours/reservas/${id}/cancelar`, { method: 'PATCH' })
  return r.data
}

// ── OPERADOR ─────────────────────────────────────────────────
export async function obtenerMiTour(): Promise<ConfigTour> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>('/tours/mi-tour/config')
  return r.data
}

export async function actualizarMiTour(datos: Partial<ConfigTour>): Promise<ConfigTour> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>('/tours/mi-tour/config', { method: 'PUT', body: datos })
  return r.data
}

export async function reservasOperadorTour(estado?: string): Promise<ReservaTour[]> {
  const q = estado ? `?estado=${estado}` : ''
  const r = await apiFetch<{ ok: boolean; data: ReservaTour[] }>(`/tours/mi-tour/reservas${q}`)
  return r.data
}

export async function cambiarEstadoReservaTour(id: number, estado: EstadoReservaTour): Promise<ReservaTour> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTour }>(`/tours/mi-tour/reservas/${id}/estado`, { method: 'PATCH', body: { estado } })
  return r.data
}

// ── ADMIN ─────────────────────────────────────────────────────
export interface TourAdmin extends ConfigTour {
  _count: { reservas: number }
}

export async function adminListarTours(): Promise<TourAdmin[]> {
  const r = await apiFetch<{ ok: boolean; data: TourAdmin[] }>('/tours/admin/todos')
  return r.data
}

export async function adminCambiarEstadoTour(id: number, activo: boolean): Promise<ConfigTour> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>(`/tours/admin/${id}/estado`, { method: 'PATCH', body: { activo } })
  return r.data
}

export async function subirFotosTour(archivos: FileList): Promise<ConfigTour> {
  const form = new FormData()
  Array.from(archivos).forEach(f => form.append('fotos', f))
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tours/mi-tour/config/fotos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message ?? 'Error al subir fotos')
  return json.data
}
