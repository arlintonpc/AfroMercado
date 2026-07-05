import { apiFetch } from './client'

export type ModuloOrigenDisputa = 'PEDIDO' | 'EXPRESS' | 'HOTEL' | 'TOUR' | 'TRANSPORTE'

export type MotivoDisputa =
  | 'PRODUCTO_NO_LLEGO'
  | 'PRODUCTO_DEFECTUOSO_O_DANADO'
  | 'PRODUCTO_INCOMPLETO'
  | 'PRODUCTO_DIFERENTE_AL_PEDIDO'
  | 'CALIDAD_NO_CONFORME'
  | 'SERVICIO_NO_PRESTADO'
  | 'COBRO_INCORRECTO'
  | 'OTRO'

export type EstadoDisputa =
  | 'ABIERTA'
  | 'RESPONDIDA_COMERCIO'
  | 'RESUELTA_RECHAZADA'
  | 'RESUELTA_REEMBOLSO_TOTAL'
  | 'RESUELTA_REEMBOLSO_PARCIAL'
  | 'CERRADA_SIN_RESPUESTA'

export type AccionResolucionDisputa = 'RECHAZAR' | 'APROBAR_TOTAL' | 'APROBAR_PARCIAL'

export interface Disputa {
  id: number
  moduloOrigen: ModuloOrigenDisputa
  referenciaId: number
  compradorId: number
  comercioId: number
  motivo: MotivoDisputa
  descripcion: string
  evidenciaUrls: string[]
  montoOriginal: string | number
  montoNetoOriginal: string | number
  montoReembolsoSolicitado: string | number | null
  estado: EstadoDisputa
  respuestaComercio: string | null
  respuestaComercioUrls: string[]
  respondidoPor: number | null
  respondidoAt: string | null
  resolucion: string | null
  montoReembolsoAprobado: string | number | null
  montoDescuentoComercio: string | number | null
  resueltoPor: number | null
  resueltoAt: string | null
  notaCreditoAplicada: boolean
  reembolsoTransferidoAt: string | null
  createdAt: string
  updatedAt: string
  comercio?: { id: number; nombre: string }
  comprador?: { id: number; nombre: string; email?: string }
}

export interface DatosCrearDisputa {
  moduloOrigen: ModuloOrigenDisputa
  referenciaId: number
  motivo: MotivoDisputa
  descripcion: string
  evidenciaUrls?: string[]
  montoReembolsoSolicitado?: number
}

export interface DatosResponderDisputa {
  respuesta: string
  evidenciaUrls?: string[]
}

export interface DatosResolverDisputa {
  accion: AccionResolucionDisputa
  motivo?: string
  montoReembolsoAprobado?: number
}

export interface FiltrosDisputasAdmin {
  estado?: EstadoDisputa
  comercioId?: number
  moduloOrigen?: ModuloOrigenDisputa
}

interface RespuestaApi<T> {
  ok: boolean
  data: T
}

export async function crearDisputa(datos: DatosCrearDisputa): Promise<Disputa> {
  const res = await apiFetch<RespuestaApi<Disputa>>('/disputas', {
    method: 'POST',
    body: datos,
  })
  return res.data
}

export async function misDisputas(): Promise<Disputa[]> {
  const res = await apiFetch<RespuestaApi<Disputa[]>>('/disputas/mias')
  return res.data
}

export async function obtenerDisputa(id: number): Promise<Disputa> {
  const res = await apiFetch<RespuestaApi<Disputa>>(`/disputas/${id}`)
  return res.data
}

export async function responderDisputaComercio(id: number, datos: DatosResponderDisputa): Promise<Disputa> {
  const res = await apiFetch<RespuestaApi<Disputa>>(`/disputas/${id}/responder`, {
    method: 'POST',
    body: datos,
  })
  return res.data
}

export async function disputasComercio(): Promise<Disputa[]> {
  const res = await apiFetch<RespuestaApi<Disputa[]>>('/disputas/comercio')
  return res.data
}

export async function disputasAdmin(filtros: FiltrosDisputasAdmin = {}): Promise<Disputa[]> {
  const params = new URLSearchParams()
  if (filtros.estado) params.set('estado', filtros.estado)
  if (filtros.comercioId) params.set('comercioId', String(filtros.comercioId))
  if (filtros.moduloOrigen) params.set('moduloOrigen', filtros.moduloOrigen)
  const query = params.toString()
  const res = await apiFetch<RespuestaApi<Disputa[]>>(`/admin/disputas${query ? `?${query}` : ''}`)
  return res.data
}

export async function resolverDisputaAdmin(id: number, datos: DatosResolverDisputa): Promise<Disputa> {
  const res = await apiFetch<RespuestaApi<Disputa>>(`/admin/disputas/${id}/resolver`, {
    method: 'PATCH',
    body: datos,
  })
  return res.data
}

export async function marcarDisputaTransferida(id: number): Promise<Disputa> {
  const res = await apiFetch<RespuestaApi<Disputa>>(`/admin/disputas/${id}/marcar-transferido`, {
    method: 'PATCH',
  })
  return res.data
}
