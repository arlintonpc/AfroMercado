import { API_URL, obtenerToken } from './client'

/** Descarga el recibo PDF de un pedido y lo abre en una pestaña nueva. */
export async function descargarReciboPedido(pedidoId: number): Promise<void> {
  const token = obtenerToken()
  const res = await fetch(`${API_URL}/pedidos/${pedidoId}/recibo.pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    throw new Error('No pudimos generar el recibo. Intenta de nuevo.')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
