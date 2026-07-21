'use client'

import React, { useEffect, useState } from 'react'

interface ModalCompartirProps {
  abierto: boolean
  onClose: () => void
  url: string
  titulo: string
  onCompartir: () => void
}

export function ModalCompartir({ abierto, onClose, url, titulo, onCompartir }: ModalCompartirProps) {
  const [montado, setMontado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    setMontado(true)
  }, [])

  if (!montado || !abierto) return null

  const textoCompartir = `Mira este video en Teravia: "${titulo}"`

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      onCompartir()
      setTimeout(() => {
        setCopiado(false)
        onClose()
      }, 2000)
    } catch (e) {
      console.error('Error al copiar', e)
    }
  }

  const opciones = [
    {
      nombre: 'WhatsApp',
      color: 'bg-[#25D366] text-white',
      icono: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.15h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 012.42 5.83c0 4.55-3.7 8.23-8.25 8.23z" />
        </svg>
      ),
      onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(textoCompartir + ' ' + url)}`, '_blank')
    },
    {
      nombre: 'Facebook',
      color: 'bg-[#1877F2] text-white',
      icono: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')
    },
    {
      nombre: 'X (Twitter)',
      color: 'bg-black text-white',
      icono: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      onClick: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(textoCompartir)}&url=${encodeURIComponent(url)}`, '_blank')
    }
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Compartir publicación</h3>
          <button
            onClick={onClose}
            className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex justify-center gap-6 mb-8">
          {opciones.map((opcion) => (
            <button
              key={opcion.nombre}
              onClick={() => {
                opcion.onClick()
                onCompartir()
                onClose()
              }}
              className="flex flex-col items-center gap-3 group"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-full ${opcion.color} shadow-lg transition-transform group-hover:scale-110 group-hover:-translate-y-1 group-active:scale-95`}>
                {opcion.icono}
              </div>
              <span className="text-sm font-semibold text-gray-600">{opcion.nombre}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <div className="flex items-center rounded-2xl border-2 border-gray-100 bg-gray-50 p-1.5 focus-within:border-gray-200 transition-colors">
            <input 
              type="text" 
              readOnly 
              value={url} 
              className="w-full bg-transparent px-3 py-2 text-sm text-gray-600 outline-none"
            />
            <button
              onClick={copiarEnlace}
              className="shrink-0 rounded-xl bg-[#1B4332] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#245a42] active:scale-95"
            >
              {copiado ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
