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

export async function listarConversaciones(): Promise<ConversacionChat[]> {
  const res = await apiFetch<{ ok: boolean; data: ConversacionChat[] }>('/chat/conversaciones')
  return res.data
}

export async function obtenerMensajes(conversacionId: number): Promise<MensajeChat[]> {
  const res = await apiFetch<{ ok: boolean; data: MensajeChat[] }>(`/chat/conversaciones/${conversacionId}/mensajes`)
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
