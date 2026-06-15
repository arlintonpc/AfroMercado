import { apiFetch } from './client'
import type { Direccion, CrearDireccionInput } from '@/types/direccion'

export async function listarDirecciones(): Promise<Direccion[]> {
  const r = await apiFetch<{ direcciones: Direccion[] }>('/direcciones')
  return r.direcciones ?? []
}

export async function crearDireccion(datos: CrearDireccionInput): Promise<Direccion> {
  const r = await apiFetch<{ direccion: Direccion }>('/direcciones', {
    method: 'POST',
    body: datos,
  })
  return r.direccion
}

export async function actualizarDireccion(id: number, datos: CrearDireccionInput): Promise<Direccion> {
  const r = await apiFetch<{ direccion: Direccion }>(`/direcciones/${id}`, {
    method: 'PUT',
    body: datos,
  })
  return r.direccion
}

export async function eliminarDireccion(id: number): Promise<void> {
  await apiFetch(`/direcciones/${id}`, { method: 'DELETE' })
}

export async function marcarDireccionPrincipal(id: number): Promise<Direccion> {
  const r = await apiFetch<{ direccion: Direccion }>(`/direcciones/${id}/principal`, {
    method: 'PATCH',
  })
  return r.direccion
}
