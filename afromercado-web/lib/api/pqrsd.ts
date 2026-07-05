import { apiFetch } from './client'

export type TipoPqrsd = 'PETICION' | 'QUEJA' | 'RECLAMO' | 'SUGERENCIA' | 'DENUNCIA'
export type EstadoPqrsd = 'ABIERTO' | 'EN_PROCESO' | 'RESPONDIDO' | 'CERRADO'

export interface Pqrsd {
  id: number
  usuarioId: number | null
  nombreContacto: string
  emailContacto: string
  telefonoContacto: string | null
  tipo: TipoPqrsd
  asunto: string
  mensaje: string
  moduloRelacionado: string | null
  referenciaId: number | null
  estado: EstadoPqrsd
  prioridad: string
  respuesta: string | null
  respondidoAt: string | null
  cerradoAt: string | null
  createdAt: string
  updatedAt: string
  usuario?: { id: number; nombre: string; email: string }
}

export interface DatosCrearPqrsd {
  nombreContacto?: string
  emailContacto?: string
  telefonoContacto?: string
  tipo: TipoPqrsd
  asunto: string
  mensaje: string
  moduloRelacionado?: string
  referenciaId?: number
}

interface RespuestaApi<T> {
  ok: boolean
  data: T
}

export async function crearPqrsd(datos: DatosCrearPqrsd): Promise<Pqrsd> {
  const res = await apiFetch<RespuestaApi<Pqrsd>>('/pqrsd', { method: 'POST', body: datos })
  return res.data
}

export async function misPqrsd(): Promise<Pqrsd[]> {
  const res = await apiFetch<RespuestaApi<Pqrsd[]>>('/pqrsd/mios')
  return res.data
}

export async function pqrsdAdmin(filtros: { estado?: EstadoPqrsd; tipo?: TipoPqrsd } = {}): Promise<Pqrsd[]> {
  const params = new URLSearchParams()
  if (filtros.estado) params.set('estado', filtros.estado)
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  const query = params.toString()
  const res = await apiFetch<RespuestaApi<Pqrsd[]>>(`/admin/pqrsd${query ? `?${query}` : ''}`)
  return res.data
}

export async function responderPqrsdAdmin(id: number, respuesta: string): Promise<Pqrsd> {
  const res = await apiFetch<RespuestaApi<Pqrsd>>(`/admin/pqrsd/${id}/responder`, { method: 'PATCH', body: { respuesta } })
  return res.data
}

export async function cerrarPqrsdAdmin(id: number): Promise<Pqrsd> {
  const res = await apiFetch<RespuestaApi<Pqrsd>>(`/admin/pqrsd/${id}/cerrar`, { method: 'PATCH' })
  return res.data
}
