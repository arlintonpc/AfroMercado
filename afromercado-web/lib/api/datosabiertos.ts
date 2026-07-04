import { apiFetch, API_URL } from './client'

export interface DatasetAbierto {
  id: string
  nombre: string
  descripcion: string
  frecuencia: string
  cobertura: string
  licencia: string
  ultimaActualizacion: string
}

export interface DatoGeografico {
  departamento: string
  municipio?: string
  comercios: number
  pedidos: number
  gmv: number
}

/** Lista los datasets públicos disponibles (metadatos, sin datos crudos). */
export async function listarDatasetsAbiertos(): Promise<DatasetAbierto[]> {
  const r = await apiFetch<{ ok: boolean; data: DatasetAbierto[] }>('/datos-abiertos', { auth: false })
  return r.data
}

/** Datos agregados por (departamento, municipio) del último mes cerrado. Endpoint público. */
export async function obtenerDatosMunicipios(): Promise<DatoGeografico[]> {
  const r = await apiFetch<{ ok: boolean; data: DatoGeografico[] }>('/datos-abiertos/municipios', { auth: false })
  return r.data
}

/** Datos agregados por departamento del último mes cerrado. Endpoint público. */
export async function obtenerDatosDepartamentos(): Promise<DatoGeografico[]> {
  const r = await apiFetch<{ ok: boolean; data: DatoGeografico[] }>('/datos-abiertos/departamentos', { auth: false })
  return r.data
}

/** URL directa de descarga (JSON o CSV) para los botones de descarga de la página pública. */
export function urlDescargaDatosAbiertos(dataset: 'municipios' | 'departamentos', formato: 'json' | 'csv'): string {
  return `${API_URL}/datos-abiertos/${dataset}?formato=${formato}`
}
