import { apiFetch } from './client'

export interface TarifaEnvio {
  id: number
  departamento: string
  pesoMaxKg: number
  precio: number
  activa: boolean
}

export interface ResultadoEnvio {
  precio: number
  departamento: string
  pesoKg: number
}

export async function calcularEnvio(
  departamento: string,
  pesoKg: number,
): Promise<ResultadoEnvio> {
  const params = new URLSearchParams({
    departamento,
    pesoKg: String(pesoKg),
  })
  const r = await apiFetch<{ ok: boolean; data: ResultadoEnvio }>(
    `/envios/calcular?${params}`,
    { auth: false },
  )
  return r.data
}

export async function listarTarifas(): Promise<Record<string, TarifaEnvio[]>> {
  const r = await apiFetch<{ ok: boolean; data: Record<string, TarifaEnvio[]> }>(
    '/envios/tarifas',
    { auth: false },
  )
  return r.data
}
