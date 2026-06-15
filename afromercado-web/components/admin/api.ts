/**
 * Capa de acceso a los endpoints de administración de AfroMercado.
 *
 * Reutiliza `apiFetch` y `obtenerToken` de lib/api/client. Se ubica en
 * components/admin para no tocar lib/* (reglas de no-conflicto), pero
 * cumple la misma convención: lanza Error con el mensaje del backend.
 */

import { apiFetch, obtenerToken } from '@/lib/api/client'

// ——— Tipos del dominio admin ———

export interface AdminEstadisticas {
  totalPedidos: number
  pedidosPendientesPago: number
  pagosPorVerificar: number
  totalComercios: number
  totalProductos: number
  ventasConfirmadas: number
}

export interface PagoComprador {
  nombre: string
  email: string
  telefono?: string | null
}

export interface PagoPedido {
  id: string
  total: number
  direccionTexto?: string | null
  comprador: PagoComprador
}

export interface PagoPendiente {
  id: string
  monto: number
  metodo: string
  estado: string
  referencia?: string | null
  comprobanteUrl?: string | null
  createdAt: string
  pedido: PagoPedido
}

export type AccionVerificacion = 'APROBAR' | 'RECHAZAR'

interface RespuestaOk<T> {
  ok: boolean
  data: T
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

/**
 * GET /api/admin/estadisticas
 */
export async function obtenerEstadisticas(): Promise<AdminEstadisticas> {
  const res = await apiFetch<RespuestaOk<AdminEstadisticas>>(
    '/admin/estadisticas',
  )
  return res.data
}

/**
 * GET /api/admin/pagos/pendientes
 */
export async function obtenerPagosPendientes(): Promise<PagoPendiente[]> {
  const res = await apiFetch<RespuestaOk<PagoPendiente[]>>(
    '/admin/pagos/pendientes',
  )
  return res.data
}

/**
 * PATCH /api/admin/pagos/:id/verificar
 */
export async function verificarPago(
  id: string,
  accion: AccionVerificacion,
  notas?: string,
): Promise<void> {
  await apiFetch<unknown>(`/admin/pagos/${id}/verificar`, {
    method: 'PATCH',
    body: notas !== undefined && notas !== '' ? { accion, notas } : { accion },
  })
}

/**
 * GET /api/admin/pagos/:id/comprobante
 *
 * El endpoint devuelve la imagen binaria del comprobante y exige el header
 * Authorization, por lo que <img src> directo no funciona (no envía el
 * token). Hacemos un fetch autenticado, leemos el blob y devolvemos un
 * object URL listo para usar en <img src>. Quien lo consuma debe revocar
 * el URL con URL.revokeObjectURL cuando ya no lo necesite.
 */
export async function obtenerComprobanteObjectUrl(
  id: string,
): Promise<string> {
  const token = obtenerToken()
  const url = `${API_URL}/admin/pagos/${id}/comprobante`

  let response: Response
  try {
    response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor.')
  }

  if (!response.ok) {
    // El cuerpo de error puede venir como JSON { error } o texto plano.
    let mensaje = `Error ${response.status}`
    try {
      const texto = await response.text()
      if (texto) {
        try {
          const datos = JSON.parse(texto) as Record<string, unknown>
          if (typeof datos.error === 'string') mensaje = datos.error
          else if (typeof datos.message === 'string') mensaje = datos.message
        } catch {
          mensaje = texto
        }
      }
    } catch {
      // Ignoramos errores al leer el cuerpo; usamos el mensaje por defecto.
    }
    throw new Error(mensaje)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}
