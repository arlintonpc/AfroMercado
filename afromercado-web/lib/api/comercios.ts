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

// ── Denuncias de comercio ──────────────────────────────────────
// Canal de protección adicional: hasta ahora solo se podía denunciar
// productos/inmuebles/ofertas de empleo/publicaciones culturales, pero no
// al comercio en sí (ej. suplantación de identidad, documentos falsos).

export type MotivoDenunciaComercio = 'SUPLANTACION_IDENTIDAD' | 'DOCUMENTOS_FALSOS' | 'COMERCIO_INEXISTENTE' | 'ESTAFA_REITERADA' | 'OTRO'
export type EstadoDenunciaComercio = 'PENDIENTE' | 'DESESTIMADA' | 'COMERCIO_SUSPENDIDO'
export type AccionResolverDenunciaComercio = 'DESESTIMAR' | 'SUSPENDER_COMERCIO'

export const MOTIVOS_DENUNCIA_COMERCIO: { value: MotivoDenunciaComercio; label: string }[] = [
  { value: 'SUPLANTACION_IDENTIDAD', label: 'Suplanta la identidad de otra persona o negocio' },
  { value: 'DOCUMENTOS_FALSOS', label: 'Documentos de identidad o registro falsos' },
  { value: 'COMERCIO_INEXISTENTE', label: 'El comercio no existe o no opera realmente' },
  { value: 'ESTAFA_REITERADA', label: 'Estafas repetidas a compradores' },
  { value: 'OTRO', label: 'Otro motivo' },
]

export interface DenunciaComercio {
  id: number
  comercioId: number
  denuncianteId: number
  motivo: MotivoDenunciaComercio
  descripcion?: string | null
  estado: EstadoDenunciaComercio
  createdAt: string
  comercio?: { id: number; nombre: string }
  denunciante?: { nombre: string }
}

/**
 * Denuncia un comercio — canal de protección directo al comercio (no a un
 * producto puntual). POST /api/comercios/:id/denunciar
 */
export async function denunciarComercio(
  id: number,
  datos: { motivo: MotivoDenunciaComercio; descripcion?: string },
): Promise<void> {
  await apiFetch(`/comercios/${id}/denunciar`, { method: 'POST', body: datos })
}

/**
 * Lista denuncias de comercios pendientes de revisión (admin).
 * GET /api/comercios/admin/denuncias
 */
export async function adminDenunciasComercios(): Promise<DenunciaComercio[]> {
  const r = await apiFetch<{ ok: boolean; data: DenunciaComercio[] }>('/comercios/admin/denuncias')
  return r.data
}

/**
 * Resuelve una denuncia de comercio (admin).
 * PATCH /api/comercios/admin/denuncias/:id/resolver
 */
export async function adminResolverDenunciaComercio(
  id: number,
  datos: { accion: AccionResolverDenunciaComercio; motivo?: string },
): Promise<DenunciaComercio> {
  const r = await apiFetch<{ ok: boolean; data: DenunciaComercio }>(
    `/comercios/admin/denuncias/${id}/resolver`,
    { method: 'PATCH', body: datos },
  )
  return r.data
}
