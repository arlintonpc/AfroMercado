import { apiFetch } from './client'
import type { Producto } from '@/types/producto'
import type { Categoria } from '@/types/categoria'

export type MotivoDenunciaProducto = 'PRODUCTO_FALSO' | 'ESTAFA_DINERO' | 'CONTENIDO_INAPROPIADO' | 'VENDEDOR_SOSPECHOSO' | 'OTRO'
export type EstadoDenunciaProducto = 'PENDIENTE' | 'DESESTIMADA' | 'PRODUCTO_BLOQUEADO' | 'CUENTA_BLOQUEADA'
export type AccionResolverDenunciaProducto = 'DESESTIMAR' | 'BLOQUEAR_PRODUCTO' | 'BLOQUEAR_CUENTA'

export const MOTIVOS_DENUNCIA_PRODUCTO: { value: MotivoDenunciaProducto; label: string }[] = [
  { value: 'PRODUCTO_FALSO', label: 'El producto no existe o no corresponde a lo publicado' },
  { value: 'ESTAFA_DINERO', label: 'Estafa / pide dinero por adelantado' },
  { value: 'CONTENIDO_INAPROPIADO', label: 'Contenido inapropiado' },
  { value: 'VENDEDOR_SOSPECHOSO', label: 'Identidad o comercio sospechoso' },
  { value: 'OTRO', label: 'Otro motivo' },
]

export interface DenunciaProducto {
  id: number
  productoId: number
  denuncianteId: number
  motivo: MotivoDenunciaProducto
  descripcion?: string | null
  estado: EstadoDenunciaProducto
  createdAt: string
  producto?: { nombre: string; id: number; comercio?: { id: number; nombre: string } }
  denunciante?: { nombre: string }
}

export interface FiltrosProductos {
  q?: string
  categoriaId?: string
  grupo?: 'ANCESTRAL' | 'LOCAL' | 'AGRO'
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
 * Denuncia un producto — canal de protección para venta con contacto
 * directo (el sistema Disputa exige un pedido ya completado en la
 * plataforma y no aplica a un contacto solo por WhatsApp).
 * POST /api/productos/:id/denunciar
 */
export async function denunciarProducto(
  id: number,
  datos: { motivo: MotivoDenunciaProducto; descripcion?: string },
): Promise<void> {
  await apiFetch(`/productos/${id}/denunciar`, { method: 'POST', body: datos })
}

/**
 * Lista denuncias de productos pendientes de revisión (admin).
 * GET /api/productos/admin/denuncias
 */
export async function adminDenunciasProductos(): Promise<DenunciaProducto[]> {
  const r = await apiFetch<{ ok: boolean; data: DenunciaProducto[] }>('/productos/admin/denuncias')
  return r.data
}

/**
 * Resuelve una denuncia de producto (admin).
 * PATCH /api/productos/admin/denuncias/:id/resolver
 */
export async function adminResolverDenunciaProducto(
  id: number,
  datos: { accion: AccionResolverDenunciaProducto; motivo?: string },
): Promise<DenunciaProducto> {
  const r = await apiFetch<{ ok: boolean; data: DenunciaProducto }>(
    `/productos/admin/denuncias/${id}/resolver`,
    { method: 'PATCH', body: datos },
  )
  return r.data
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
