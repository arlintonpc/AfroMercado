import { apiFetch } from './client'

export interface EntregaDetalle {
  id: number
  estado: string
  direccion: string
  notas: string | null
  repartidorId: number | null
  createdAt: string
  subPedido: {
    id: number
    comercio: { nombre: string }
    pedido: {
      id: number
      direccionTexto: string
      comprador: { nombre: string; telefono: string | null }
    }
    items: Array<{ cantidad: number; producto: { nombre: string } }>
  }
}

export async function misEntregas(): Promise<EntregaDetalle[]> {
  const res = await apiFetch<{ ok: boolean; data: EntregaDetalle[] }>('/repartidor/entregas')
  return res.data
}

export async function historialEntregas(): Promise<EntregaDetalle[]> {
  const res = await apiFetch<{ ok: boolean; data: EntregaDetalle[] }>('/repartidor/entregas')
  return res.data.filter((e) => e.estado === 'ENTREGADA' || e.estado === 'FALLIDA')
}

export interface EntregasDisponibles {
  items: EntregaDetalle[]
  /** Municipio base del repartidor por el que se filtró (null = todas las zonas). */
  municipioBase: string | null
}

export async function entregasDisponibles(todos = false): Promise<EntregasDisponibles> {
  const qs = todos ? '?todos=1' : ''
  const res = await apiFetch<{ ok: boolean; data: EntregaDetalle[]; municipioBase: string | null }>(
    `/repartidor/entregas/disponibles${qs}`,
  )
  return { items: res.data, municipioBase: res.municipioBase ?? null }
}

export async function tomarEntrega(id: number): Promise<EntregaDetalle> {
  const res = await apiFetch<{ ok: boolean; data: EntregaDetalle }>(`/repartidor/entregas/${id}/tomar`, {
    method: 'PATCH',
  })
  return res.data
}

export async function actualizarEstadoEntrega(
  id: number,
  estado: string,
  notas?: string,
): Promise<EntregaDetalle> {
  const res = await apiFetch<{ ok: boolean; data: EntregaDetalle }>(`/repartidor/entregas/${id}/estado`, {
    method: 'PATCH',
    body: { estado, notas },
  })
  return res.data
}
