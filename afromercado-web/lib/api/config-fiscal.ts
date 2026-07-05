import { apiFetch } from './client'

export interface ConfigFiscalComercio {
  comercioId: number
  ivaActivo: boolean
  ivaPorcentaje: number | string
  regimenTributario: string | null
}

interface RespuestaApi<T> {
  ok: boolean
  data: T
}

export async function obtenerConfigFiscal(comercioId: number): Promise<ConfigFiscalComercio> {
  const res = await apiFetch<RespuestaApi<ConfigFiscalComercio>>(`/admin/comercios/${comercioId}/config-fiscal`)
  return res.data
}

export async function activarIva(
  comercioId: number,
  datos: { ivaPorcentaje?: number; regimenTributario?: string }
): Promise<ConfigFiscalComercio> {
  const res = await apiFetch<RespuestaApi<ConfigFiscalComercio>>(
    `/admin/comercios/${comercioId}/config-fiscal/activar`,
    { method: 'PATCH', body: datos }
  )
  return res.data
}

export async function desactivarIva(comercioId: number): Promise<ConfigFiscalComercio> {
  const res = await apiFetch<RespuestaApi<ConfigFiscalComercio>>(
    `/admin/comercios/${comercioId}/config-fiscal/desactivar`,
    { method: 'PATCH' }
  )
  return res.data
}
