import { apiFetch } from './client'
import type { Carrito } from '@/types/carrito'

/**
 * Normaliza la respuesta del backend a un Carrito.
 * Acepta tanto { carrito: {...} } como el carrito directo, y recalcula
 * cantidadTotal/subtotal si el backend no los devuelve.
 */
function normalizarCarrito(datos: unknown): Carrito {
  // El backend envuelve la respuesta en { ok, data: {...} }. Desenvolvemos.
  let raw: unknown = datos
  if (raw && typeof raw === 'object' && 'ok' in raw && 'data' in raw) {
    raw = (raw as { data: unknown }).data
  }
  // Compatibilidad con formas antiguas: { carrito: {...} } o un array de items.
  if (raw && typeof raw === 'object' && 'carrito' in raw) {
    raw = (raw as { carrito: unknown }).carrito
  }
  if (Array.isArray(raw)) {
    raw = { items: raw }
  }

  const fuente = (raw ?? {}) as Partial<Carrito>
  const items = Array.isArray(fuente.items) ? fuente.items : []

  const cantidadTotal =
    typeof fuente.cantidadTotal === 'number'
      ? fuente.cantidadTotal
      : items.reduce((acc, it) => acc + (it.cantidad ?? 0), 0)

  const subtotal =
    typeof fuente.subtotal === 'number'
      ? fuente.subtotal
      : items.reduce(
          (acc, it) => acc + (it.producto?.precio ?? 0) * (it.cantidad ?? 0),
          0,
        )

  return { items, cantidadTotal, subtotal }
}

/** GET /api/carrito (auth) */
export async function obtenerCarrito(): Promise<Carrito> {
  return normalizarCarrito(await apiFetch<unknown>('/carrito'))
}

/** POST /api/carrito/items (auth) */
export async function agregarAlCarrito(
  productoId: string,
  cantidad: number,
): Promise<Carrito> {
  return normalizarCarrito(
    await apiFetch<unknown>('/carrito/items', {
      method: 'POST',
      body: { productoId, cantidad },
    }),
  )
}

/** PUT /api/carrito/items/:productoId (auth) */
export async function actualizarCantidad(
  productoId: string,
  cantidad: number,
): Promise<Carrito> {
  return normalizarCarrito(
    await apiFetch<unknown>(`/carrito/items/${productoId}`, {
      method: 'PUT',
      body: { cantidad },
    }),
  )
}

/** DELETE /api/carrito/items/:productoId (auth) */
export async function eliminarDelCarrito(productoId: string): Promise<Carrito> {
  return normalizarCarrito(
    await apiFetch<unknown>(`/carrito/items/${productoId}`, {
      method: 'DELETE',
    }),
  )
}

/** DELETE /api/carrito (auth) */
export async function vaciarCarrito(): Promise<Carrito> {
  return normalizarCarrito(
    await apiFetch<unknown>('/carrito', { method: 'DELETE' }),
  )
}
