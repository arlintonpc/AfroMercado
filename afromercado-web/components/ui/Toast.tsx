'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  mensaje: string
  visible: boolean
}

export function Toast({ mensaje, visible }: ToastProps) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
    }`}>
      <div className="bg-[#1A1A1A] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg">
        {mensaje}
      </div>
    </div>
  )
}

export function useToast(duracion = 2000) {
  const [mensaje, setMensaje] = useState('')
  const [visible, setVisible] = useState(false)

  function mostrar(msg: string) {
    setMensaje(msg)
    setVisible(true)
  }

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), duracion)
    return () => clearTimeout(t)
  }, [visible, duracion])

  return { mostrar, toastProps: { mensaje, visible } }
}
