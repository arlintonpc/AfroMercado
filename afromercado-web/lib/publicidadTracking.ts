import { API_URL, obtenerToken } from '@/lib/api/client'
import { obtenerAfmSesionId } from '@/lib/afmSession'

export type EventoPatrocinado = 'clic' | 'carrito'

export function registrarEventoPatrocinado(productoId: string | number, evento: EventoPatrocinado) {
  const sesionId = obtenerAfmSesionId()
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  if (sesionId) headers.set('X-AFM-Session-Id', sesionId)

  const token = obtenerToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  fetch(`${API_URL}/productos/${productoId}/${evento}-patrocinado`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sesionId }),
  }).catch(() => {})
}
