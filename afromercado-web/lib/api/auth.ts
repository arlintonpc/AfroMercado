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
