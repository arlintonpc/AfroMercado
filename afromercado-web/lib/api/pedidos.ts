import { apiFetch } from './client'
import type { Pedido, DatosCheckout } from '@/types/pedido'

function normalizarPedido(datos: unknown): Pedido {
  // El backend envuelve en { ok, data }. Desenvolvemos primero.
  let raw: unknown = datos
  if (raw && typeof raw === 'object' && 'ok' in raw && 'data' in raw) {
    raw = (raw as { data: unknown }).data
  }
  if (raw && typeof raw === 'object' && 'pedido' in raw) {
    return (raw as { pedido: Pedido }).pedido
  }
  return raw as Pedido
}

/**
 * Crea un pedido a partir del carrito actual.
 * POST /api/pedidos/checkout (auth)
 */
export async function checkout(datos: DatosCheckout = {}): Promise<Pedido> {
  return normalizarPedido(
    await apiFetch<unknown>('/pedidos/checkout', {
      method: 'POST',
      body: datos,
    }),
  )
}

/**
 * Lista los pedidos del usuario autenticado.
 * GET /api/pedidos (auth) → { items } o array directo.
 */
export async function listarPedidos(): Promise<Pedido[]> {
  let datos: unknown = await apiFetch<unknown>('/pedidos')
  // Desenvolver { ok, data } si viene envuelto.
  if (datos && typeof datos === 'object' && 'ok' in datos && 'data' in datos) {
    datos = (datos as { data: unknown }).data
  }
  if (Array.isArray(datos)) return datos as Pedido[]
  if (datos && typeof datos === 'object' && 'items' in datos) {
    return (datos as { items: Pedido[] }).items
  }
  if (datos && typeof datos === 'object' && 'pedidos' in datos) {
    return (datos as { pedidos: Pedido[] }).pedidos
  }
  return []
}

/**
 * Obtiene un pedido por id.
 * GET /api/pedidos/:id (auth)
 */
export async function obtenerPedido(id: string): Promise<Pedido> {
  return normalizarPedido(await apiFetch<unknown>(`/pedidos/${id}`))
}
