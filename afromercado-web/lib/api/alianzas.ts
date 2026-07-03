import { apiFetch } from './client'

/** Módulo de AfroMercado en el que participa un socio de la alianza. */
export type ModuloAlianza = 'PEDIDO' | 'EXPRESS' | 'HOTEL' | 'TOUR' | 'TRANSPORTE'

export interface SocioAlianzaPublico {
  comercioId: number
  nombre: string
  municipio: string
  departamento?: string | null
  logoUrl?: string | null
  modulo: ModuloAlianza
  /** Id de la fila de configuración del módulo (ConfigHotel.id, ConfigTour.id, etc.), o null si no aplica/no existe. */
  moduloConfigId: number | null
}

export interface AlianzaPublica {
  id: number
  nombre: string
  descripcion?: string | null
  departamento?: string | null
  municipio?: string | null
  codigoCompartido: string
  inicio: string
  fin: string
  socios: SocioAlianzaPublico[]
}

/** Versión liviana usada en listados (región, badge de comercio) — sin socios. */
export interface AlianzaResumen {
  id: number
  nombre: string
  descripcion?: string | null
  departamento?: string | null
  municipio?: string | null
  codigoCompartido: string
  inicio: string
  fin: string
}

export async function obtenerAlianzaPorCodigo(codigo: string): Promise<AlianzaPublica> {
  const r = await apiFetch<{ ok: boolean; data: AlianzaPublica }>(`/alianzas/codigo/${encodeURIComponent(codigo)}`, { auth: false })
  return r.data
}

export async function listarAlianzasPorRegion(params: { departamento?: string; municipio?: string; fecha?: string } = {}): Promise<AlianzaResumen[]> {
  const qs = new URLSearchParams()
  if (params.departamento) qs.set('departamento', params.departamento)
  if (params.municipio) qs.set('municipio', params.municipio)
  if (params.fecha) qs.set('fecha', params.fecha)
  const q = qs.toString()
  const r = await apiFetch<{ ok: boolean; data: AlianzaResumen[] }>(`/alianzas/region${q ? `?${q}` : ''}`, { auth: false })
  return r.data
}
