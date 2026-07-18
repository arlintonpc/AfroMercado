import { apiFetch } from '@/lib/api/client'

export type TipoOrganizacionTerritorial =
  | 'CONSEJO_COMUNITARIO'
  | 'RESGUARDO_INDIGENA'
  | 'ZONA_RESERVA_CAMPESINA'
  | 'OTRA'

export interface ProveedorDirectorio {
  id: number
  nombre: string
  descripcion: string | null
  departamento: string | null
  municipio: string
  whatsapp: string | null
  whatsappVisible: boolean
  logoUrl: string | null
  verificadoEtnico: boolean
  organizacionTerritorialTipo: TipoOrganizacionTerritorial | null
  productos: Array<{ categoria: { id: number; nombre: string } | null }>
}

export interface ComercioDirectorio {
  id: number
  nombre: string
  descripcion: string | null
  departamento: string | null
  municipio: string
  whatsapp: string | null
  whatsappVisible: boolean
  logoUrl: string | null
  calificacion: string | number
  totalReviews: number
  verificadoEtnico: boolean
  organizacionTerritorialTipo: TipoOrganizacionTerritorial | null
  productos: Array<{ categoria: { id: number; nombre: string } | null }>
}

export interface ComercioDirectorioDetalle extends ComercioDirectorio {
  historia: string | null
  videoUrl: string | null
  videoPosterUrl: string | null
  vereda: string | null
  latitud: number | null
  longitud: number | null
  createdAt: string
  productos: Array<{
    id: number
    nombre: string
    precio: string | number
    fotoUrl: string | null
    categoria: { id: number; nombre: string } | null
  }>
}

export interface PaginacionDirectorio {
  page: number
  pageSize: number
  total: number
  totalPaginas: number
}

/**
 * Directorio público de proveedores certificados (Módulo C institucional).
 * Sin autenticación — no envía token. Solo vitrina de descubrimiento para
 * compra pública local: la compra y facturación ocurren fuera de la plataforma.
 */
export async function listarDirectorioComprasPublicas(params?: {
  departamento?: string
  municipio?: string
  categoria?: string
}): Promise<ProveedorDirectorio[]> {
  const qs = new URLSearchParams()
  if (params?.departamento) qs.set('departamento', params.departamento)
  if (params?.municipio) qs.set('municipio', params.municipio)
  if (params?.categoria) qs.set('categoria', params.categoria)
  const query = qs.toString()
  const resp = await apiFetch<{ ok: boolean; data: ProveedorDirectorio[] }>(
    `/directorio-compras-publicas${query ? `?${query}` : ''}`,
    { auth: false },
  )
  return resp.data
}

/**
 * Directorio empresarial general (ciudadano) — cualquier comercio verificado
 * del territorio, sin exigir disponibilidad para compra pública. Sin
 * autenticación, con paginación real.
 */
export async function listarDirectorio(params?: {
  departamento?: string
  municipio?: string
  categoria?: string
  buscar?: string
  page?: number
}): Promise<{ data: ComercioDirectorio[]; paginacion: PaginacionDirectorio }> {
  const qs = new URLSearchParams()
  if (params?.departamento) qs.set('departamento', params.departamento)
  if (params?.municipio) qs.set('municipio', params.municipio)
  if (params?.categoria) qs.set('categoria', params.categoria)
  if (params?.buscar) qs.set('buscar', params.buscar)
  if (params?.page) qs.set('page', String(params.page))
  const query = qs.toString()
  const resp = await apiFetch<{ ok: boolean; data: ComercioDirectorio[]; paginacion: PaginacionDirectorio }>(
    `/directorio${query ? `?${query}` : ''}`,
    { auth: false },
  )
  return { data: resp.data, paginacion: resp.paginacion }
}

export async function obtenerComercioDirectorio(id: number): Promise<ComercioDirectorioDetalle> {
  const resp = await apiFetch<{ ok: boolean; data: ComercioDirectorioDetalle }>(
    `/directorio/${id}`,
    { auth: false },
  )
  return resp.data
}
