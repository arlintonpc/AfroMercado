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
