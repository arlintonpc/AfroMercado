/**
 * Cliente HTTP base para la API de AfroMercado.
 *
 * - Usa NEXT_PUBLIC_API_URL como base.
 * - Adjunta Content-Type: application/json.
 * - Adjunta Authorization: Bearer {token} si hay token en localStorage.
 * - Parsea JSON y lanza Error con el message del backend ({ error }) si !ok.
 */

export const TOKEN_KEY = 'afromercado_token'
export const USUARIO_KEY = 'afromercado_usuario'

// URL del backend. Si NEXT_PUBLIC_API_URL está definida, manda. Si no, el
// valor por defecto depende del entorno de compilación: en producción apunta
// al backend en Render; en desarrollo, al backend local.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afro-mercado.vercel.app'

// URL del backend. Si NEXT_PUBLIC_API_URL está definida, manda. Si no, el
// valor por defecto apunta al backend público en Render para garantizar que SSR en Vercel responda.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'

/**
 * Lee el token guardado en localStorage. Devuelve null en SSR o si no existe.
 */
export function obtenerToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/**
 * Normaliza cualquier URL de imagen/media (ej. avatares, fotos local o Cloudinary).
 * Convierte rutas relativas como '/uploads/avatares/...' en URLs absolutas del backend.
 */
export function normalizarUrlMedia(url?: string | null): string | null {
  if (!url) return null
  const u = url.trim()
  if (!u) return null
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) {
    return u
  }
  const baseBackend = API_URL.replace(/\/api\/?$/, '')
  return `${baseBackend}${u.startsWith('/') ? '' : '/'}${u}`
}

/**
 * Normaliza cualquier URL de imagen/media asegurando que siempre devuelva una URL absoluta
 * válida para metadatos Open Graph (WhatsApp, Facebook, Twitter, iMessage, etc.).
 */
export function normalizarUrlMediaAbsoluta(url?: string | null, fallback?: string): string {
  const norm = normalizarUrlMedia(url)
  if (norm) return norm
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'
  return fallback ?? `${site}/og-logo.png`
}

/**
 * Extrae un mensaje de error legible del cuerpo de la respuesta.
 * El backend devuelve { error: string }; admitimos también { message }.
 */
function extraerMensajeError(datos: unknown, status: number): string {
  if (datos && typeof datos === 'object') {
    const obj = datos as Record<string, unknown>
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.message === 'string') return obj.message
  }
  return `Error ${status}`
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Cuerpo de la petición. Si es un objeto se serializa a JSON. */
  body?: unknown
  /** Si es false, no adjunta el header Authorization aunque exista token. */
  auth?: boolean
}

/**
 * Realiza una petición a la API y devuelve la respuesta parseada como T.
 * Lanza Error con el mensaje del backend si la respuesta no es ok.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, auth = true, headers, ...rest } = options
  const esFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const finalHeaders = new Headers(headers)
  if (!esFormData) {
    finalHeaders.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = obtenerToken()
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`)
    }
  }

  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`

  let response: Response
  try {
    response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      credentials: 'include',
      body: body !== undefined ? (esFormData ? body : JSON.stringify(body)) : undefined,
    })
  } catch {
    // Error de red / backend caído.
    throw new Error('No se pudo conectar con el servidor.')
  }

  // 204 No Content u otras respuestas sin cuerpo.
  const texto = await response.text()
  let datos: unknown = null
  if (texto) {
    try {
      datos = JSON.parse(texto)
    } catch {
      datos = texto
    }
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('afm:session-expired'))
    }
    throw new Error(extraerMensajeError(datos, response.status))
  }

  return datos as T
}
