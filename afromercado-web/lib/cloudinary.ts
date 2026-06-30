/**
 * Transforma una URL de Cloudinary para servir imagen optimizada.
 * Si la URL no es de Cloudinary, la devuelve sin cambios.
 */
export function optimizarImagen(url: string | null | undefined, opciones?: {
  ancho?: number
  alto?: number
  calidad?: 'auto' | number
  formato?: 'auto' | 'webp' | 'jpg'
  recorte?: 'fill' | 'limit' | 'thumb'
}): string {
  if (!url) return ''
  if (!url.includes('res.cloudinary.com')) return url

  const { ancho = 800, calidad = 'auto', formato = 'auto', recorte = 'fill', alto } = opciones ?? {}

  const transformacion = [
    recorte === 'fill' ? `c_fill` : `c_${recorte}`,
    `w_${ancho}`,
    alto ? `h_${alto}` : null,
    `q_${calidad}`,
    `f_${formato}`,
  ].filter(Boolean).join(',')

  // Insertar transformación después de /upload/
  return url.replace('/upload/', `/upload/${transformacion}/`)
}

export function optimizarImagenPequena(url: string | null | undefined): string {
  return optimizarImagen(url, { ancho: 400, calidad: 'auto', formato: 'auto' })
}

export function optimizarImagenMediana(url: string | null | undefined): string {
  return optimizarImagen(url, { ancho: 800, calidad: 'auto', formato: 'auto' })
}

export function optimizarImagenGrande(url: string | null | undefined): string {
  return optimizarImagen(url, { ancho: 1200, calidad: 'auto', formato: 'auto' })
}
