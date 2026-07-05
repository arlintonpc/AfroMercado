import { apiFetch } from './client'

export interface PerfilFidelizacion {
  id: number
  usuarioId: number
  puntos: number
  puntosAcumuladosTotal: number
  codigoReferido: string
  referidoPorId: number | null
  createdAt: string
}

export type TipoMovimientoPuntos = 'GANADO_COMPRA' | 'GANADO_REFERIDO' | 'CANJEADO' | 'AJUSTE_ADMIN'

export interface MovimientoPuntos {
  id: number
  tipo: TipoMovimientoPuntos
  puntos: number
  descripcion: string | null
  createdAt: string
}

export interface CuponCanjeado {
  id: number
  codigo: string
  valor: string | number
  fin: string
}

interface RespuestaApi<T> {
  ok: boolean
  data: T
}

export async function miPerfilFidelizacion(): Promise<PerfilFidelizacion> {
  const r = await apiFetch<RespuestaApi<PerfilFidelizacion>>('/fidelizacion/mi-perfil')
  return r.data
}

export async function misMovimientosPuntos(): Promise<MovimientoPuntos[]> {
  const r = await apiFetch<RespuestaApi<MovimientoPuntos[]>>('/fidelizacion/movimientos')
  return r.data
}

export async function canjearPuntos(puntos: number): Promise<CuponCanjeado> {
  const r = await apiFetch<RespuestaApi<CuponCanjeado>>('/fidelizacion/canjear', {
    method: 'POST',
    body: { puntos },
  })
  return r.data
}
