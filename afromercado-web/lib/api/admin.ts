import { apiFetch } from './client'

export interface ComercioAdmin {
  id: number
  nombre: string
  municipio: string
  activo: boolean
  createdAt: string
  calificacion: number | string
  totalReviews: number
  usuario: { id: number; nombre: string; email: string }
  _count: { productos: number }
  configHotel: { id: number } | null
  configTour: { id: number } | null
  configExpress: { id: number } | null
  configTransporte: { id: number } | null
  configFiscal: { ivaActivo: boolean; ivaPorcentaje: number | string; regimenTributario: string | null } | null
}

export interface UsuarioAdmin {
  id: number
  nombre: string
  email: string
  rol: 'COMPRADOR' | 'COMERCIANTE' | 'ADMIN'
  activo: boolean
  createdAt: string
}

export interface CategoriaAdmin {
  id: number
  nombre: string
  slug: string
}

export interface DashboardAdmin {
  totalComercios: number
  comerciosActivos: number
  totalUsuarios: number
  totalProductos: number
  reservasMes: number
  pedidosExpress: number
  comerciosPorSemana: { semana: string; total: number }[]
  alertas: { comerciosSinProductos: number }
}

export async function obtenerDashboard(): Promise<DashboardAdmin> {
  const r = await apiFetch<{ ok: boolean; data: DashboardAdmin }>('/admin/dashboard')
  return r.data
}

export async function listarComerciosAdmin(params?: {
  pagina?: number
  estado?: string
  modulo?: string
  q?: string
}): Promise<{ comercios: ComercioAdmin[]; total: number; totalPaginas: number }> {
  const qs = new URLSearchParams()
  if (params?.estado) qs.set('estado', params.estado)
  if (params?.q) qs.set('q', params.q)
  const r = await apiFetch<{ ok: boolean; data: ComercioAdmin[] }>(`/admin/comercios?${qs}`)
  let lista = r.data ?? []
  // Filtro por módulo en cliente (el backend no lo soporta aún)
  if (params?.modulo) {
    const m = params.modulo
    lista = lista.filter(c =>
      (m === 'hotel' && c.configHotel) ||
      (m === 'tour' && c.configTour) ||
      (m === 'express' && c.configExpress) ||
      (m === 'transporte' && c.configTransporte)
    )
  }
  const POR_PAGINA = 20
  const pagina = params?.pagina ?? 1
  const total = lista.length
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const comercios = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  return { comercios, total, totalPaginas }
}

export async function cambiarEstadoComercio(id: number, activo: boolean): Promise<void> {
  await apiFetch(`/admin/comercios/${id}/estado`, { method: 'PATCH', body: { activo } as any })
}

export async function listarUsuariosAdmin(params?: {
  pagina?: number
  rol?: string
  q?: string
}): Promise<{ usuarios: UsuarioAdmin[]; total: number; totalPaginas: number }> {
  const qs = new URLSearchParams()
  if (params?.pagina) qs.set('pagina', String(params.pagina))
  if (params?.rol) qs.set('rol', params.rol)
  if (params?.q) qs.set('q', params.q)
  return apiFetch(`/admin/usuarios?${qs}`)
}

export async function cambiarRolUsuario(id: number, rol: string): Promise<void> {
  await apiFetch(`/admin/usuarios/${id}/rol`, { method: 'PATCH', body: { rol } as any })
}

export async function cambiarActivoUsuario(id: number, activo: boolean): Promise<void> {
  await apiFetch(`/admin/usuarios/${id}/activo`, { method: 'PATCH', body: { activo } as any })
}

export async function listarCategoriasAdmin(): Promise<CategoriaAdmin[]> {
  const r = await apiFetch<{ ok: boolean; data: CategoriaAdmin[] }>('/admin/categorias')
  return r.data
}

export async function crearCategoriaAdmin(data: Partial<CategoriaAdmin>): Promise<CategoriaAdmin> {
  const r = await apiFetch<{ ok: boolean; data: CategoriaAdmin }>('/admin/categorias', {
    method: 'POST',
    body: data as any,
  })
  return r.data
}

export async function actualizarCategoriaAdmin(
  id: number,
  data: Partial<CategoriaAdmin>,
): Promise<CategoriaAdmin> {
  const r = await apiFetch<{ ok: boolean; data: CategoriaAdmin }>(`/admin/categorias/${id}`, {
    method: 'PATCH',
    body: data as any,
  })
  return r.data
}

export async function eliminarCategoriaAdmin(id: number): Promise<void> {
  await apiFetch(`/admin/categorias/${id}`, { method: 'DELETE' })
}
