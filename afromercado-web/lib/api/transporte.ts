import { apiFetch } from './client'

export type EstadoReservaTransporte = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'RECHAZADA' | 'COMPLETADA'

export interface RutaTransporte {
  id: number
  configTransporteId: number
  origen: string
  destino: string
  horario: string
  diasSemana: string[]
  capacidad: number
  precioAsiento: number | string
  activo: boolean
  creadoAt: string
}

export interface ConfigTransporte {
  id: number
  comercioId: number
  activo: boolean
  nombre: string
  descripcion?: string | null
  tipo: string
  fotos: string[]
  creadoAt: string
  updatedAt: string
  rutas: RutaTransporte[]
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
  }
}

export interface ReservaTransporte {
  id: number
  codigo: string
  rutaTransporteId: number
  clienteId?: number
  fechaViaje: string
  asientos: number
  total: number | string
  estado: EstadoReservaTransporte
  metodoPago: string
  notasCliente?: string | null
  nombreContacto: string
  telefonoContacto: string
  creadoAt: string
  ruta?: RutaTransporte & { configTransporte?: ConfigTransporte }
  cliente?: { id: number; nombre: string; email: string }
}

// ── PÚBLICO ──────────────────────────────────────────────────
export async function listarTransportes(params?: { municipio?: string; departamento?: string }): Promise<ConfigTransporte[]> {
  const q = new URLSearchParams((params ?? {}) as Record<string, string>).toString()
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte[] }>(`/transportes${q ? `?${q}` : ''}`)
  return r.data
}

export async function obtenerTransporte(id: number): Promise<ConfigTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte }>(`/transportes/${id}`)
  return r.data
}

export async function verificarDisponibilidadTransporte(rutaId: number, fecha: string): Promise<{ disponibles: number; capacidad: number }> {
  const r = await apiFetch<{ ok: boolean; data: { disponibles: number; capacidad: number } }>(
    `/transportes/disponibilidad?rutaId=${rutaId}&fecha=${fecha}`
  )
  return r.data
}

// ── CLIENTE ──────────────────────────────────────────────────
export async function crearReservaTransporte(datos: {
  rutaTransporteId: number
  fechaViaje: string
  asientos: number
  metodoPago: string
  notasCliente?: string
  nombreContacto: string
  telefonoContacto: string
}): Promise<ReservaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte }>('/transportes/reservas', { method: 'POST', body: datos })
  return r.data
}

export async function misReservasTransporte(): Promise<ReservaTransporte[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte[] }>('/transportes/reservas/mis')
  return r.data
}

export async function cancelarReservaTransporte(id: number): Promise<ReservaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte }>(`/transportes/reservas/${id}/cancelar`, { method: 'PATCH' })
  return r.data
}

// ── OPERADOR ─────────────────────────────────────────────────
export async function obtenerMiTransporte(): Promise<ConfigTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte }>('/transportes/mi-transporte/config')
  return r.data
}

export async function actualizarMiTransporte(datos: Partial<ConfigTransporte>): Promise<ConfigTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte }>('/transportes/mi-transporte/config', { method: 'PUT', body: datos })
  return r.data
}

export async function agregarRuta(datos: Partial<RutaTransporte>): Promise<RutaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: RutaTransporte }>('/transportes/mi-transporte/rutas', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarRuta(id: number, datos: Partial<RutaTransporte>): Promise<RutaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: RutaTransporte }>(`/transportes/mi-transporte/rutas/${id}`, { method: 'PUT', body: datos })
  return r.data
}

export async function eliminarRuta(id: number): Promise<void> {
  await apiFetch(`/transportes/mi-transporte/rutas/${id}`, { method: 'DELETE' })
}

export async function reservasOperadorTransporte(estado?: string): Promise<ReservaTransporte[]> {
  const q = estado ? `?estado=${estado}` : ''
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte[] }>(`/transportes/mi-transporte/reservas${q}`)
  return r.data
}

export async function cambiarEstadoReservaTransporte(id: number, estado: EstadoReservaTransporte): Promise<ReservaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte }>(`/transportes/mi-transporte/reservas/${id}/estado`, { method: 'PATCH', body: { estado } })
  return r.data
}

export async function subirFotosTransporte(files: File[]): Promise<ConfigTransporte> {
  const fd = new FormData()
  files.forEach(f => fd.append('fotos', f))
  const { obtenerToken } = await import('./client')
  const token = obtenerToken()
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
  const res = await fetch(`${API}/transportes/mi-transporte/config/fotos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j?.error ?? 'Error al subir fotos')
  return j.data
}

// ── ADMIN ─────────────────────────────────────────────────────
export interface TransporteAdmin extends ConfigTransporte {
  _count: { rutas: number }
}

export async function adminListarTransportes(): Promise<TransporteAdmin[]> {
  const r = await apiFetch<{ ok: boolean; data: TransporteAdmin[] }>('/transportes/admin/todos')
  return r.data
}

export async function adminCambiarEstadoTransporte(id: number, activo: boolean): Promise<ConfigTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte }>(`/transportes/admin/${id}/estado`, { method: 'PATCH', body: { activo } })
  return r.data
}
