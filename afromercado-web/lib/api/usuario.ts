import { apiFetch, TOKEN_KEY } from './client'
import type { Usuario, TipoDocumento } from '@/types/usuario'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

export interface DatosActualizarPerfil {
  nombre?: string
  telefono?: string
  municipio?: string
  tipoDocumento?: TipoDocumento
  numeroDocumento?: string
}

export async function obtenerPerfil(): Promise<Usuario> {
  const res = await apiFetch<{ ok: boolean; data: Usuario }>('/usuario/yo')
  return res.data
}

export async function actualizarPerfil(datos: DatosActualizarPerfil): Promise<Usuario> {
  const res = await apiFetch<{ ok: boolean; data: Usuario }>('/usuario/yo', {
    method: 'PATCH',
    body: datos,
  })
  return res.data
}

export async function subirAvatar(archivo: File): Promise<Usuario> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null

  const form = new FormData()
  form.append('avatar', archivo)

  const res = await fetch(`${API_URL}/usuario/yo/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })

  const json = await res.json()
  if (!res.ok || !json.ok) {
    throw new Error(json.mensaje ?? json.error ?? 'Error al subir el avatar.')
  }
  return json.data as Usuario
}
