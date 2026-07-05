import { apiFetch } from './client'

export type ModuloOrigenFactura = 'PEDIDO' | 'EXPRESS' | 'HOTEL' | 'TOUR' | 'TRANSPORTE' | 'CULTURA'
export type EstadoFactura = 'PENDIENTE' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'ERROR' | 'ANULADA' | 'OMITIDA'

export interface FacturaElectronica {
  id: number
  moduloOrigen: ModuloOrigenFactura
  referenciaId: number
  comercioId: number
  compradorId: number
  proveedor: string
  estado: EstadoFactura
  subtotal: string | number
  ivaTotal: string | number
  total: string | number
  cufe: string | null
  numeroFactura: string | null
  pdfUrl: string | null
  xmlUrl: string | null
  errorMensaje: string | null
  intentosFallidos: number
  anuladaAt: string | null
  motivoAnulacion: string | null
  createdAt: string
  updatedAt: string
  comercio?: { id: number; nombre: string }
  comprador?: { id: number; nombre: string }
}

export interface FiltrosFacturasAdmin {
  estado?: EstadoFactura
  moduloOrigen?: ModuloOrigenFactura
  comercioId?: number
}

interface RespuestaApi<T> {
  ok: boolean
  data: T
}

export async function obtenerFactura(moduloOrigen: ModuloOrigenFactura, referenciaId: number): Promise<FacturaElectronica | null> {
  try {
    const res = await apiFetch<RespuestaApi<FacturaElectronica>>(`/facturas/${moduloOrigen}/${referenciaId}`)
    return res.data
  } catch {
    return null
  }
}

export async function facturasAdmin(filtros: FiltrosFacturasAdmin = {}): Promise<FacturaElectronica[]> {
  const params = new URLSearchParams()
  if (filtros.estado) params.set('estado', filtros.estado)
  if (filtros.moduloOrigen) params.set('moduloOrigen', filtros.moduloOrigen)
  if (filtros.comercioId) params.set('comercioId', String(filtros.comercioId))
  const query = params.toString()
  const res = await apiFetch<RespuestaApi<FacturaElectronica[]>>(`/admin/facturas${query ? `?${query}` : ''}`)
  return res.data
}

export async function reintentarFacturaAdmin(moduloOrigen: ModuloOrigenFactura, referenciaId: number): Promise<FacturaElectronica> {
  const res = await apiFetch<RespuestaApi<FacturaElectronica>>('/admin/facturas/reintentar', {
    method: 'POST',
    body: { moduloOrigen, referenciaId },
  })
  return res.data
}

export async function anularFacturaAdmin(id: number, motivo: string): Promise<FacturaElectronica> {
  const res = await apiFetch<RespuestaApi<FacturaElectronica>>(`/admin/facturas/${id}/anular`, {
    method: 'PATCH',
    body: { motivo },
  })
  return res.data
}
