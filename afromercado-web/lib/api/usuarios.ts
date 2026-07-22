import { apiFetch } from './client'
import type { PublicacionCultural } from './cultura'

export interface PerfilPublicoUsuario {
  id: number
  nombre: string
  avatarUrl?: string | null
  bio?: string | null
  municipio?: string | null
  departamento?: string | null
  totalSeguidores: number
  totalSeguidos: number
  sigo: boolean
  publicaciones: PublicacionCultural[]
  totalPublicaciones: number
}

export async function obtenerPerfilPublico(usuarioId: number): Promise<PerfilPublicoUsuario> {
  const r = await apiFetch<{ ok: boolean; data: PerfilPublicoUsuario }>(`/usuario/${usuarioId}/perfil`)
  return r.data
}

export async function toggleSeguirUsuario(usuarioId: number): Promise<{ siguiendo: boolean }> {
  const r = await apiFetch<{ ok: boolean; siguiendo: boolean }>(`/usuario/${usuarioId}/seguir/toggle`, {
    method: 'POST',
    body: {},
  })
  return { siguiendo: r.siguiendo ?? false }
}
