import { apiFetch } from './client'

export interface MensajeChat {
  id: number
  autorId: number
  contenido: string
  leido: boolean
  createdAt: string
  autor: { nombre: string }
}

export interface ConversacionChat {
  id: number
  compradorId: number
  comercioId: number
  ultimoMensAt: string | null
  comprador: { nombre: string }
  comercio: { nombre: string }
  mensajes: MensajeChat[]
  _count: { mensajes: number }
}

export interface MensajesChatPagina {
  items: MensajeChat[]
  hasMore: boolean
  oldestId: number | null
  newestId: number | null
}

export async function listarConversaciones(): Promise<ConversacionChat[]> {
  const res = await apiFetch<{ ok: boolean; data: ConversacionChat[] }>('/chat/conversaciones')
  return res.data
}

export async function obtenerMensajes(
  conversacionId: number,
  opciones?: { antesDe?: number; limite?: number },
): Promise<MensajesChatPagina> {
  const params = new URLSearchParams()
  if (typeof opciones?.antesDe === 'number' && Number.isFinite(opciones.antesDe)) {
    params.set('antesDe', String(opciones.antesDe))
  }
  if (typeof opciones?.limite === 'number' && Number.isFinite(opciones.limite)) {
    params.set('limite', String(opciones.limite))
  }
  const sufijo = params.toString() ? `?${params.toString()}` : ''
  const res = await apiFetch<{ ok: boolean; data: MensajesChatPagina | MensajeChat[] }>(`/chat/conversaciones/${conversacionId}/mensajes${sufijo}`)
  if (Array.isArray(res.data)) {
    const items = res.data
    return {
      items,
      hasMore: items.length >= (opciones?.limite ?? 50),
      oldestId: items[0]?.id ?? null,
      newestId: items[items.length - 1]?.id ?? null,
    }
  }
  return res.data
}

export async function iniciarConversacion(comercioId: number): Promise<ConversacionChat> {
  const res = await apiFetch<{ ok: boolean; data: ConversacionChat }>('/chat/conversaciones', {
    method: 'POST',
    body: { comercioId },
  })
  return res.data
}

export async function enviarMensaje(conversacionId: number, contenido: string): Promise<MensajeChat> {
  const res = await apiFetch<{ ok: boolean; data: MensajeChat }>(`/chat/conversaciones/${conversacionId}/mensajes`, {
    method: 'POST',
    body: { contenido },
  })
  return res.data
}

export async function contarNoLeidos(): Promise<number> {
  const res = await apiFetch<{ ok: boolean; data: number }>('/chat/no-leidos')
  return res.data
}
