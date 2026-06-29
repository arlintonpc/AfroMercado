import { apiFetch } from './client'

export type EstadoReservaHotel = 'PENDIENTE' | 'CONFIRMADA' | 'CHECKIN' | 'CHECKOUT' | 'CANCELADA' | 'RECHAZADA'

export interface HabitacionTipo {
  id: number
  configHotelId: number
  nombre: string
  descripcion?: string | null
  capacidad: number
  precioPorNoche: number | string
  cantidad: number
  fotos: string[]
  serviciosExtra: string[]
  activo: boolean
  creadoAt: string
  videoUrl?: string | null
  videoPosterUrl?: string | null
  videoDuracionSeg?: number | null
}

export interface ConfigHotel {
  id: number
  comercioId: number
  activo: boolean
  confirmacionAuto: boolean
  horasLimiteConfirm: number
  servicios: string[]
  politicaCancelacion?: string | null
  checkInHora: string
  checkOutHora: string
  creadoAt: string
  updatedAt: string
  habitaciones: HabitacionTipo[]
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

export interface ReservaHotel {
  id: number
  codigo: string
  configHotelId: number
  habitacionTipoId: number
  clienteId: number
  fechaEntrada: string
  fechaSalida: string
  huespedes: number
  total: number | string
  estado: EstadoReservaHotel
  metodoPago: string
  notasCliente?: string | null
  nombreHuesped: string
  telefonoHuesped: string
  creadoAt: string
  habitacionTipo?: { nombre: string; fotos: string[]; precioPorNoche: number | string }
  configHotel?: {
    id: number
    checkInHora: string
    checkOutHora: string
    comercio: { nombre: string; municipio: string; logoUrl?: string | null }
  }
  cliente?: { nombre: string; email: string; telefono?: string | null }
  review?: { id: number } | null
}

// ── PÚBLICO ──────────────────────────────────────────────────
export async function listarHoteles(params?: { municipio?: string; departamento?: string }): Promise<ConfigHotel[]> {
  const q = new URLSearchParams()
  if (params?.municipio) q.set('municipio', params.municipio)
  if (params?.departamento) q.set('departamento', params.departamento)
  const qs = q.toString()
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel[] }>(`/hoteles${qs ? `?${qs}` : ''}`, { auth: false })
  return r.data
}

export async function obtenerHotel(id: number): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>(`/hoteles/${id}`, { auth: false })
  return r.data
}

export async function verificarDisponibilidad(habitacionTipoId: number, fechaEntrada: string, fechaSalida: string) {
  const q = new URLSearchParams({ habitacionTipoId: String(habitacionTipoId), fechaEntrada, fechaSalida })
  const r = await apiFetch<{ ok: boolean; data: { disponibles: number; total: number } }>(`/hoteles/disponibilidad?${q}`, { auth: false })
  return r.data
}

// ── CLIENTE ──────────────────────────────────────────────────
export async function crearReserva(datos: {
  habitacionTipoId: number
  fechaEntrada: string
  fechaSalida: string
  huespedes: number
  metodoPago: string
  notasCliente?: string
  nombreHuesped: string
  telefonoHuesped: string
}): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>('/hoteles/reservas', { method: 'POST', body: datos })
  return r.data
}

export async function misReservasHotel(): Promise<ReservaHotel[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel[] }>('/hoteles/reservas/mis')
  return r.data
}

export async function cancelarReservaHotel(id: number): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>(`/hoteles/reservas/${id}/cancelar`, { method: 'PATCH' })
  return r.data
}

// ── HOTELERO ─────────────────────────────────────────────────
export async function obtenerMiHotel(): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>('/hoteles/mi-hotel/config')
  return r.data
}

export async function actualizarMiHotel(datos: Partial<ConfigHotel>): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>('/hoteles/mi-hotel/config', { method: 'PUT', body: datos })
  return r.data
}

export async function agregarHabitacion(datos: Partial<HabitacionTipo>): Promise<HabitacionTipo> {
  const r = await apiFetch<{ ok: boolean; data: HabitacionTipo }>('/hoteles/mi-hotel/habitaciones', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarHabitacion(id: number, datos: Partial<HabitacionTipo>): Promise<HabitacionTipo> {
  const r = await apiFetch<{ ok: boolean; data: HabitacionTipo }>(`/hoteles/mi-hotel/habitaciones/${id}`, { method: 'PUT', body: datos })
  return r.data
}

export async function eliminarHabitacion(id: number): Promise<void> {
  await apiFetch(`/hoteles/mi-hotel/habitaciones/${id}`, { method: 'DELETE' })
}

export async function reservasHotelero(params?: { estado?: string }): Promise<ReservaHotel[]> {
  const q = params?.estado ? `?estado=${params.estado}` : ''
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel[] }>(`/hoteles/mi-hotel/reservas${q}`)
  return r.data
}

export async function cambiarEstadoReserva(id: number, estado: EstadoReservaHotel): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>(`/hoteles/mi-hotel/reservas/${id}/estado`, { method: 'PATCH', body: { estado } })
  return r.data
}

export async function subirFotosHabitacion(habitacionId: number, files: File[]): Promise<HabitacionTipo> {
  const fd = new FormData()
  files.forEach(f => fd.append('fotos', f))
  const { obtenerToken } = await import('./client')
  const token = obtenerToken()
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
  const res = await fetch(`${API}/hoteles/mi-hotel/habitaciones/${habitacionId}/fotos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j?.error ?? 'Error al subir fotos')
  return j.data
}

export async function subirVideoHabitacion(habitacionId: number, file: File): Promise<{ videoUrl: string; videoPosterUrl?: string; videoDuracionSeg?: number }> {
  const fd = new FormData()
  fd.append('video', file)
  const { obtenerToken } = await import('./client')
  const token = obtenerToken()
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
  const res = await fetch(`${API}/hotel/habitaciones/${habitacionId}/video`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j?.error ?? 'Error al subir video')
  return j.data
}

export async function quitarVideoHabitacion(habitacionId: number): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `/hotel/habitaciones/${habitacionId}/video`,
    { method: 'DELETE', auth: true }
  )
}

export async function ocupacionHotel(): Promise<{ habitaciones: HabitacionTipo[]; reservas: ReservaHotel[] }> {
  const r = await apiFetch<{ ok: boolean; data: { habitaciones: HabitacionTipo[]; reservas: ReservaHotel[] } }>('/hoteles/mi-hotel/ocupacion')
  return r.data
}

// ── ADMIN ─────────────────────────────────────────────────────
export interface HotelAdmin extends ConfigHotel {
  _count: { reservas: number }
}

export async function adminListarHoteles(): Promise<HotelAdmin[]> {
  const r = await apiFetch<{ ok: boolean; data: HotelAdmin[] }>('/hoteles/admin/todos')
  return r.data
}

export async function adminCambiarEstadoHotel(id: number, activo: boolean): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>(`/hoteles/admin/${id}/estado`, { method: 'PATCH', body: { activo } })
  return r.data
}

export async function adminReservasHotel(id: number): Promise<ReservaHotel[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel[] }>(`/hoteles/admin/${id}/reservas`)
  return r.data
}

// ── BLOQUEOS ─────────────────────────────────────────────────
export interface BloqueoFecha {
  id: string
  habitacionId: number | null
  fechaInicio: string
  fechaFin: string
  motivo: string | null
}

export async function listarBloqueos(): Promise<BloqueoFecha[]> {
  const d = await apiFetch<{ ok: boolean; data: BloqueoFecha[] }>('/hotel/bloqueos', { auth: true })
  return d.data
}

export async function crearBloqueo(datos: { habitacionId?: number | null; fechaInicio: string; fechaFin: string; motivo?: string }): Promise<BloqueoFecha> {
  const d = await apiFetch<{ ok: boolean; data: BloqueoFecha }>('/hotel/bloqueos', { method: 'POST', body: datos, auth: true })
  return d.data
}

export async function eliminarBloqueo(bloqueoId: string): Promise<void> {
  await apiFetch(`/hotel/bloqueos/${bloqueoId}`, { method: 'DELETE', auth: true })
}

export async function iniciarPagoReserva(reservaId: number): Promise<{ checkoutUrl: string; referencia: string; montoDeposito: number; pct: number }> {
  const d = await apiFetch<{ ok: boolean; data: any }>(`/hotel/reservas/${reservaId}/checkout`, { method: 'POST', auth: true })
  return d.data
}
