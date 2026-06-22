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
  /** true si el envío salió gratis por una regla (plataforma o vendedor). */
  gratis?: boolean
  /** 'plataforma' | 'vendedor' | null — por qué salió gratis. */
  motivo?: 'plataforma' | 'vendedor' | null
}

export interface OpcionesEnvio {
  /** Subtotal del carrito; habilita la evaluación de envío gratis. */
  subtotal?: number
  /** Comercio del pedido (solo cuando hay una sola tienda) para envío gratis del vendedor. */
  comercioId?: number
}

export async function calcularEnvio(
  departamento: string,
  pesoKg: number,
  opciones: OpcionesEnvio = {},
): Promise<ResultadoEnvio> {
  const params = new URLSearchParams({
    departamento,
    pesoKg: String(pesoKg),
  })
  if (opciones.subtotal != null) params.set('subtotal', String(opciones.subtotal))
  if (opciones.comercioId != null) params.set('comercioId', String(opciones.comercioId))
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
