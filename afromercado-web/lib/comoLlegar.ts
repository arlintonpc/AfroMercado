export function urlComoLlegar(lat?: number | null, lon?: number | null, direccionTexto?: string): string {
  if (lat != null && lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`
  }
  const destino = encodeURIComponent(direccionTexto || 'Colombia')
  return `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`
}
