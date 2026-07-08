'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'

interface Props {
  titulo: string
  fotoUrls: string[]
  videoUrl?: string | null
  indiceInicial?: number
  onCerrar: () => void
}

type Item = { tipo: 'foto'; url: string } | { tipo: 'video'; url: string }

export default function ModalGaleriaHistoria({ titulo, fotoUrls, videoUrl, indiceInicial = 0, onCerrar }: Props) {
  const items: Item[] = [
    ...fotoUrls.map((url) => ({ tipo: 'foto' as const, url })),
    ...(videoUrl ? [{ tipo: 'video' as const, url: videoUrl }] : []),
  ]
  const [activo, setActivo] = useState(indiceInicial)
  const indiceValido = Math.min(activo, Math.max(0, items.length - 1))
  const actual = items[indiceValido]

  const ir = useCallback((delta: number) => {
    setActivo((i) => (i + delta + items.length) % items.length)
  }, [items.length])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
      else if (e.key === 'ArrowRight') ir(1)
      else if (e.key === 'ArrowLeft') ir(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onCerrar, ir])

  if (!actual) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Galería de ${titulo}`}
    >
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>

      <span className="absolute left-1/2 top-5 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 backdrop-blur-sm">
        {titulo}{items.length > 1 ? ` · ${indiceValido + 1}/${items.length}` : ''}
      </span>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); ir(-1) }}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 md:left-6"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); ir(1) }}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 md:right-6"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}

      <div className="relative flex h-screen w-screen items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {actual.tipo === 'foto' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={actual.url} alt={titulo} className="max-h-screen max-w-full object-contain" />
        ) : (
          <div className="w-full max-w-4xl px-4">
            <ReproductorVideo url={actual.url} />
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
