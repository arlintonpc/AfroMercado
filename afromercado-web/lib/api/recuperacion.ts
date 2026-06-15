import { apiFetch } from './client'

export async function solicitarCodigo(email: string): Promise<{ mensaje: string }> {
  return apiFetch<{ ok: boolean; mensaje: string }>('/auth/recuperar/solicitar', {
    method: 'POST',
    body: { email },
    auth: false,
  }).then((r) => ({ mensaje: r.mensaje }))
}

export async function verificarCodigo(
  email: string,
  codigo: string
): Promise<{ resetToken: string }> {
  return apiFetch<{ ok: boolean; resetToken: string }>('/auth/recuperar/verificar', {
    method: 'POST',
    body: { email, codigo },
    auth: false,
  }).then((r) => ({ resetToken: r.resetToken }))
}

export async function cambiarPassword(
  resetToken: string,
  nuevaPassword: string
): Promise<{ mensaje: string }> {
  return apiFetch<{ ok: boolean; mensaje: string }>('/auth/recuperar/cambiar', {
    method: 'POST',
    body: { resetToken, nuevaPassword },
    auth: false,
  }).then((r) => ({ mensaje: r.mensaje }))
}
