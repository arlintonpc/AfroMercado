import { apiFetch } from './client'
import type { DatosRegistro, RespuestaAuth } from '@/types/usuario'

/**
 * Registra un nuevo usuario.
 * POST /api/auth/registro → { usuario, token }
 */
export function registro(datos: DatosRegistro): Promise<RespuestaAuth> {
  return apiFetch<RespuestaAuth>('/auth/registro', {
    method: 'POST',
    auth: false,
    body: datos,
  })
}

/**
 * Inicia sesión.
 * POST /api/auth/login → { usuario, token }
 */
export function login(email: string, password: string): Promise<RespuestaAuth> {
  return apiFetch<RespuestaAuth>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
}

export function logoutApi(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    auth: false,
  })
}

export function yoApi(): Promise<{ ok: boolean; usuario: import('@/types/usuario').Usuario }> {
  return apiFetch<{ ok: boolean; usuario: import('@/types/usuario').Usuario }>('/auth/yo', {
    method: 'GET',
    auth: false,
  })
}
