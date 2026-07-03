import { apiFetch } from './client'

/**
 * Alianzas comerciales — cupón compartido entre comercios de distintos
 * módulos (Express, Hotel, Tour, Transporte, Pedido).
 *
 * Rutas backend (ver afromercado/src/routes/alianza.routes.js y
 * alianza.controller.js — todas envuelven la data en { ok: true, data }):
 *  - GET    /alianzas/mias             → AlianzaComercial[]
 *  - POST   /alianzas                  → AlianzaComercial (crea + auto-agrega al creador como socio)
 *  - POST   /alianzas/:id/socios       → AlianzaSocio (invita a otro comercio)
 *  - PATCH  /alianzas/:id/socios/mio   → AlianzaSocio (acepta mi propia invitación)
 *  - DELETE /alianzas/:id/socios/mio   → { ok, accion }  (rechaza o me retiro)
 *  - GET    /alianzas/codigo/:codigo   → público, no se consume desde el panel de comerciante
 */

export type ModuloAlianza = 'PEDIDO' | 'EXPRESS' | 'HOTEL' | 'TOUR' | 'TRANSPORTE'
export type TipoDescuentoAlianza = 'PORCENTAJE' | 'VALOR_FIJO'
export type EstadoAlianza = 'PENDIENTE_APROBACION' | 'PUBLICADA' | 'RECHAZADA' | 'DESPUBLICADA'

export interface ComercioResumenAlianza {
  id: number
  nombre: string
  municipio?: string | null
  departamento?: string | null
}

export interface AlianzaSocio {
  id: number
  alianzaId: number
  comercioId: number
  modulo: ModuloAlianza
  tipoDescuento: TipoDescuentoAlianza
  /** El backend serializa Decimal como string. */
  valorDescuento: string | number
  aceptado: boolean
  aceptadoAt?: string | null
  activo: boolean
  createdAt: string
  comercio: ComercioResumenAlianza
}

export interface AlianzaComercial {
  id: number
  nombre: string
  descripcion?: string | null
  departamento?: string | null
  municipio?: string | null
  codigoCompartido: string
  estado: EstadoAlianza
  inicio: string
  fin: string
  creadoPorComercioId: number
  aprobadoPor?: number | null
  aprobadoAt?: string | null
  motivoRechazo?: string | null
  createdAt: string
  updatedAt: string
  socios: AlianzaSocio[]
}

export interface DatosCrearAlianza {
  nombre: string
  descripcion?: string | null
  departamento?: string | null
  municipio?: string | null
  /** ISO date/datetime. */
  inicio: string
  /** ISO date/datetime. */
  fin: string
  /** Módulo + descuento propio del creador (se auto-agrega como primer socio). */
  modulo: ModuloAlianza
  tipoDescuento: TipoDescuentoAlianza
  valorDescuento: number
}

export interface DatosInvitarSocio {
  comercioId: number
  modulo: ModuloAlianza
  tipoDescuento: TipoDescuentoAlianza
  valorDescuento: number
}

export interface ResultadoRechazarOSalir {
  ok: boolean
  accion: 'RECHAZADA' | 'YA_RETIRADO' | 'RETIRADO'
}

/** Lista las alianzas donde participo (como creador o invitado, aceptadas o pendientes). */
export async function listarMisAlianzas(): Promise<AlianzaComercial[]> {
  const res = await apiFetch<{ ok: boolean; data: AlianzaComercial[] }>('/alianzas/mias')
  return res.data
}

/** Crea una alianza nueva. El comercio autenticado se auto-agrega como primer socio. */
export async function crearAlianza(datos: DatosCrearAlianza): Promise<AlianzaComercial> {
  const res = await apiFetch<{ ok: boolean; data: AlianzaComercial }>('/alianzas', {
    method: 'POST',
    body: datos,
  })
  return res.data
}

/** Invita a otro comercio (por su ID) a unirse a la alianza en un módulo dado. */
export async function invitarSocioAlianza(alianzaId: number, datos: DatosInvitarSocio): Promise<AlianzaSocio> {
  const res = await apiFetch<{ ok: boolean; data: AlianzaSocio }>(`/alianzas/${alianzaId}/socios`, {
    method: 'POST',
    body: datos,
  })
  return res.data
}

/** Acepta una invitación pendiente en una alianza. */
export async function aceptarInvitacionAlianza(alianzaId: number): Promise<AlianzaSocio> {
  const res = await apiFetch<{ ok: boolean; data: AlianzaSocio }>(`/alianzas/${alianzaId}/socios/mio`, {
    method: 'PATCH',
  })
  return res.data
}

/** Rechaza una invitación pendiente, o me retiro si ya era socio aceptado. */
export async function rechazarOSalirAlianza(alianzaId: number): Promise<ResultadoRechazarOSalir> {
  const res = await apiFetch<{ ok: boolean; data: ResultadoRechazarOSalir }>(`/alianzas/${alianzaId}/socios/mio`, {
    method: 'DELETE',
  })
  return res.data
}
