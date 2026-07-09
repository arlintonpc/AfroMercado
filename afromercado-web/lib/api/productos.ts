import { apiFetch } from './client'
import type { Producto } from '@/types/producto'
import type { Categoria } from '@/types/categoria'

export interface FiltrosProductos {
  q?: string
  categoriaId?: string
  grupo?: 'ANCESTRAL' | 'LOCAL'
  municipio?: string
  departamento?: string
  precioMin?: number
  precioMax?: number
  alcance?: 'LOCAL' | 'NACIONAL' | 'AMBOS'
  enOferta?: boolean
  pagina?: number
  porPagina?: number
}

export interface ListaProductos {
  items: Producto[]
  total: number
  paginas: number
  pagina: number
}

/**
 * Construye un querystring a partir de los filtros, omitiendo valores vacíos.
 */
function construirQuery(filtros: FiltrosProductos = {}): string {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue
    params.set(clave, String(valor))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Lista productos con filtros y paginación.
 * GET /api/productos?...
 */
export function listarProductos(
  filtros: FiltrosProductos = {},
): Promise<ListaProductos> {
  return apiFetch<ListaProductos>(`/productos${construirQuery(filtros)}`, {
    auth: false,
  })
}

/**
 * Obtiene un producto por id.
 * GET /api/productos/:id → { producto } o el producto directo.
 * Normaliza ambas formas a un Producto.
 */
export async function obtenerProducto(id: string): Promise<Producto> {
  const datos = await apiFetch<Producto | { producto: Producto }>(
    `/productos/${id}`,
    { auth: false },
  )
  if (datos && typeof datos === 'object' && 'producto' in datos) {
    return (datos as { producto: Producto }).producto
  }
  return datos as Producto
}

/**
 * Lista las categorías.
 * GET /api/categorias → { categorias: [...] } o un array directo.
 */
export async function listarCategorias(): Promise<Categoria[]> {
  const datos = await apiFetch<Categoria[] | { categorias: Categoria[] }>(
    '/categorias',
    { auth: false },
  )
  if (Array.isArray(datos)) return datos
  if (datos && typeof datos === 'object' && 'categorias' in datos) {
    return (datos as { categorias: Categoria[] }).categorias
  }
  return []
}
