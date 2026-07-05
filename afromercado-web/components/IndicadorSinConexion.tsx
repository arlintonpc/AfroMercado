'use client'

import { useEffect, useState } from 'react'

/** Banner discreto cuando el navegador detecta que no hay conexión — avisa que
 * el contenido visible puede ser una copia guardada por el service worker,
 * no necesariamente la versión más reciente. */
export default function IndicadorSinConexion() {
  const [sinConexion, setSinConexion] = useState(false)

  useEffect(() => {
    setSinConexion(!navigator.onLine)
    const onOffline = () => setSinConexion(true)
    const onOnline = () => setSinConexion(false)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  if (!sinConexion) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-[#1A1A1A] px-4 py-2 text-center text-xs font-medium text-white">
      📡 Sin conexión — mostrando la última versión guardada de esta página.
    </div>
  )
}
