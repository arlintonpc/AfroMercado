'use client'

import React, { useEffect } from 'react'

export interface ModalAvatarLightboxProps {
  src?: string | null
  nombre: string
  isOpen: boolean
  onClose: () => void
  subtitulo?: string
  iniciales?: string
  editable?: boolean
  onCambiarFoto?: () => void
}

export default function ModalAvatarLightbox({
  src,
  nombre,
  isOpen,
  onClose,
  subtitulo,
  iniciales,
  editable = false,
  onCambiarFoto,
}: ModalAvatarLightboxProps) {
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    // Prevenir scroll en body cuando el modal está abierto
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in-0 duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-avatar-titulo"
    >
      {/* Contenedor central */}
      <div
        className="relative w-full max-w-lg bg-[#1B4332]/95 border border-[#D4A017]/40 rounded-3xl p-6 text-white shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del modal */}
        <div className="w-full flex items-center justify-between border-b border-white/10 pb-4">
          <div className="min-w-0 pr-4">
            <h3 id="modal-avatar-titulo" className="text-lg font-bold text-white truncate">
              {nombre}
            </h3>
            {subtitulo && <p className="text-xs text-[#D4A017] font-semibold truncate">{subtitulo}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista de avatar"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Imagen en HD grande */}
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-[#D4A017] shadow-[0_0_30px_rgba(212,160,23,0.3)] bg-gray-900 flex items-center justify-center">
          {src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt={`Foto de perfil de ${nombre}`}
              className="w-full h-full object-cover select-none"
            />
          ) : (
            <span className="text-6xl sm:text-7xl font-extrabold text-[#D4A017] select-none">
              {iniciales || (nombre ? nombre.charAt(0).toUpperCase() : '?')}
            </span>
          )}
        </div>

        {/* Botón de acción opcional para cambiar foto */}
        {editable && onCambiarFoto && (
          <button
            type="button"
            onClick={() => {
              onClose()
              onCambiarFoto()
            }}
            className="px-6 py-2.5 rounded-full bg-[#D4A017] hover:bg-[#b58813] text-[#1A1A1A] font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>Cambiar foto de perfil</span>
          </button>
        )}
      </div>
    </div>
  )
}
