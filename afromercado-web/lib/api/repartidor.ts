import { apiFetch, obtenerToken } from './client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

export interface EntregaDetalle {
  id: number
  estado: string
  direccion: string
  notas: string | null
  repartidorId: number | null
  createdAt: string
  /** Pago al repartidor por esta entrega (según el Centro de Reglas). */
  pagoRepartidor?: number
  /** URL de la foto de prueba de entrega (si se subió). */
  fotoEntrega?: string | null
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

/** Sube una imagen al backend (multipart, campo "foto") y devuelve su URL. */
async function subirImagen(endpoint: string, file: File): Promise<string> {
  const fd = new FormData()
  fd.append('foto', file)
  const token = obtenerToken()
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  if (!res.ok) {
    let msg = 'No se pudo subir la imagen.'
    try { const j = await res.json(); if (j?.error) msg = j.error; else if (j?.mensaje) msg = j.mensaje } catch { /* sin cuerpo */ }
    throw new Error(msg)
  }
  const j = await res.json()
  return j.url
}

/** Sube la foto de prueba de entrega. Devuelve la URL. */
export function subirFotoEntrega(id: number, file: File): Promise<string> {
  return subirImagen(`/repartidor/entregas/${id}/foto`, file)
}

/** Sube un documento de la solicitud de repartidor (cédula, matrícula, etc.). */
export function subirDocumentoSolicitud(file: File): Promise<string> {
  return subirImagen('/repartidor/solicitud/foto', file)
}

export interface EstadisticasRepartidor {
  totalEntregas: number
  totalEntregadas: number
  totalFallidas: number
  totalGanado: number
  gananciasMes: number
  promedioPorEntrega: number
  tasaExito: number
  porMes: Array<{ mes: string; entregas: number; ganancias: number }>
}

export async function estadisticasRepartidor(): Promise<EstadisticasRepartidor> {
  const r = await apiFetch<{ ok: boolean; data: EstadisticasRepartidor }>('/repartidor/estadisticas')
  return r.data
}

export interface PerfilRepartidor {
  vehiculoTipo?: string
  vehiculoMarca?: string
  vehiculoModelo?: string
  vehiculoColor?: string
  vehiculoPlaca?: string
  vehiculoAnio?: number
  municipioBase?: string
  municipiosExtra?: string[]
}

export async function actualizarPerfilRepartidor(datos: PerfilRepartidor): Promise<void> {
  await apiFetch('/repartidor/perfil', { method: 'PATCH', body: datos as any })
}

export async function miSolicitudRepartidor(): Promise<PerfilRepartidor & { estado: string } | null> {
  try {
    const r = await apiFetch<{ ok: boolean; data: any }>('/repartidor/mi-solicitud')
    return r.data
  } catch {
    return null
  }
}
