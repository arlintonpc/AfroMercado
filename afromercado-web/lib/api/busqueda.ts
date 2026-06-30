import { apiFetch } from './client'

export interface ResultadoBusqueda {
  productos: { id: number; nombre: string; precio: number | string; fotos: string[]; comercio: { municipio: string } }[]
  hoteles: { id: number; comercio: { nombre: string; municipio: string }; habitaciones: { fotos: string[]; precioPorNoche: number | string }[] }[]
  tours: { id: number; nombre: string; precioPersona: number | string; fotos: string[]; comercio: { municipio: string } }[]
  transportes: { id: number; nombre: string; tipo: string; fotos: string[]; comercio: { municipio: string } }[]
}

export async function busquedaGlobal(q: string): Promise<ResultadoBusqueda> {
  const r = await apiFetch<{ ok: boolean; data: ResultadoBusqueda }>(
    `/busqueda?q=${encodeURIComponent(q)}&limite=4`
  )
  return r.data
}
