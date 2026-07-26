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
    },
    {
      nombre: 'Telegram',
      color: 'bg-[#229ED9] text-white',
      icono: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
        </svg>
      ),
      onClick: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(textoCompartir)}`, '_blank')
    },
    {
      nombre: 'LinkedIn',
      color: 'bg-[#0A66C2] text-white',
      icono: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
        </svg>
      ),
      onClick: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank')
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

        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {opciones.map((opcion) => (
            <button
              key={opcion.nombre}
              onClick={() => {
                opcion.onClick()
                onCompartir()
                onClose()
              }}
              className="flex flex-col items-center gap-2 group w-16"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${opcion.color} shadow-md transition-transform group-hover:scale-110 group-hover:-translate-y-0.5 group-active:scale-95`}>
                {opcion.icono}
              </div>
              <span className="text-xs font-semibold text-gray-700 text-center truncate w-full">{opcion.nombre}</span>
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
