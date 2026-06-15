import { apiFetch } from './client'
import type { Usuario, TipoDocumento } from '@/types/usuario'

export interface DatosActualizarPerfil {
  nombre?: string
  telefono?: string
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
