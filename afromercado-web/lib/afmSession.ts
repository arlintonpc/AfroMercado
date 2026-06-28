export function obtenerAfmSesionId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let sesionId = window.sessionStorage.getItem('afm_sid')
    if (!sesionId) {
      sesionId = Math.random().toString(36).slice(2)
      window.sessionStorage.setItem('afm_sid', sesionId)
    }
    return sesionId
  } catch {
    return null
  }
}
