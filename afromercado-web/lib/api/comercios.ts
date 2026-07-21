import { apiFetch } from './client'

/**
 * Activa/desactiva el "seguir" de un comercio (usado en la Vitrina de video,
 * botón "Seguir"/"Siguiendo" sobre la franja superior de la tarjeta inmersiva).
 * Mismo patrón de respuesta que `toggleFavoritoPublicacionCultural`.
 */
export async function toggleSeguirComercio(comercioId: number): Promise<{ siguiendo: boolean }> {
  const r = await apiFetch<{ ok: boolean; siguiendo: boolean }>(`/comercios/${comercioId}/seguir/toggle`, {
    method: 'POST',
    body: {},
  })
  return { siguiendo: r.siguiendo ?? false }
}
