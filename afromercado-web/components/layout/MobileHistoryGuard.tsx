'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Guard para dispositivos móviles:
 * Evita que el botón/gesto de "Atrás" del celular cierre la aplicación
 * cuando el usuario entra directamente a una subpágina sin historial previo.
 * Inyecta el estado '/' al inicio de la pila de historial.
 */
export default function MobileHistoryGuard() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Si el usuario entra directo a una subpágina y la pila de historia es 1,
    // insertamos una entrada de inicio (/) antes de la página actual.
    if (pathname !== '/' && window.history.length <= 1) {
      try {
        window.history.replaceState({ teraviaBase: true }, '', '/')
        window.history.pushState({ teraviaPage: true }, '', pathname)
      } catch (err) {
        console.warn('History Guard fallback warning:', err)
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      // Si el historial llega al estado base de inicio inyectado
      if (e.state && e.state.teraviaBase) {
        router.push('/')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [pathname, router])

  return null
}
