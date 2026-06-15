'use client'

import { useState } from 'react'

/**
 * Botón que copia `texto` al portapapeles y muestra "¡Copiado!" 2s.
 * Pensado para los números Nequi/Daviplata y la referencia de pago.
 */
export function BotonCopiar({
  texto,
  etiqueta = 'Copiar',
  className = '',
}: {
  texto: string
  etiqueta?: string
  className?: string
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // Fallback para navegadores sin permiso de clipboard.
      try {
        const el = document.createElement('textarea')
        el.value = texto
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      } catch {
        return
      }
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
        copiado
          ? 'bg-[#2D6A4F] text-white'
          : 'bg-[#2D6A4F]/10 text-[#2D6A4F] hover:bg-[#2D6A4F]/20',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${etiqueta}: ${texto}`}
    >
      {copiado ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          ¡Copiado!
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 012-2h10" />
          </svg>
          {etiqueta}
        </>
      )}
    </button>
  )
}

export default BotonCopiar
