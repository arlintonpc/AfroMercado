'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'
import ModalComentarios from './ModalComentarios'
import { PublicacionCultural } from '@/lib/api/cultura'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

interface Props {
  publicacion: PublicacionCultural
  indiceInicial?: number
  onCerrar: () => void
}

type Item = { tipo: 'foto'; url: string } | { tipo: 'video'; url: string }

export default function ModalTeatroPublicacion({ publicacion, indiceInicial = 0, onCerrar }: Props) {
  const { usuario } = useAuth()
  const fotoUrls = publicacion.fotoUrls || []
  const videoUrl = publicacion.videoUrl

  const items: Item[] = [
    ...fotoUrls.map((url) => ({ tipo: 'foto' as const, url })),
    ...(videoUrl ? [{ tipo: 'video' as const, url: videoUrl }] : []),
  ]
  const [activo, setActivo] = useState(indiceInicial)
  const [mostrarComentariosMovil, setMostrarComentariosMovil] = useState(false)
  const [montado, setMontado] = useState(false)

  const indiceValido = Math.min(activo, Math.max(0, items.length - 1))
  const actual = items[indiceValido]

  const ir = useCallback((delta: number) => {
    setActivo((i) => (i + delta + items.length) % items.length)
  }, [items.length])

  useEffect(() => {
    setMontado(true)
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

  if (!actual || !montado) return null

  const esPropiaPublicacion = !!usuario && String(usuario.id) === String(publicacion.autor?.id ?? '')

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col md:flex-row bg-black md:bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Publicación de ${publicacion.titulo}`}
    >
      {/* Botón Cerrar (Móvil) */}
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="md:hidden absolute left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>

      {/* ÁREA IZQUIERDA (MULTIMEDIA) */}
      <div className="relative flex h-[100dvh] md:h-screen flex-1 items-center justify-center bg-black">
        {/* Controles del Carrusel (Escritorio) */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); ir(-1) }}
              aria-label="Anterior"
              className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hidden md:flex"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); ir(1) }}
              aria-label="Siguiente"
              className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hidden md:flex"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>

            {/* Indicadores en Móvil */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1 z-20 md:hidden">
              {items.map((_, idx) => (
                <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === indiceValido ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>

            {/* Controles del Carrusel invisibles (touch zones) en Móvil */}
            <div className="absolute inset-y-0 left-0 w-1/4 z-10 md:hidden" onClick={(e) => { e.stopPropagation(); ir(-1) }} />
            <div className="absolute inset-y-0 right-0 w-1/4 z-10 md:hidden" onClick={(e) => { e.stopPropagation(); ir(1) }} />
          </>
        )}

        {actual.tipo === 'foto' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={actual.url} alt={publicacion.titulo} className="max-h-[100dvh] md:max-h-screen w-full md:max-w-full object-contain md:p-8" />
        ) : (
          <div className="w-full h-[100dvh] md:h-screen md:p-8 flex items-center justify-center">
            <div className="w-full max-w-lg aspect-[4/5] bg-black">
              <ReproductorVideo url={actual.url} autoPlay />
            </div>
          </div>
        )}

        {/* Botones Flotantes en Móvil (Me Gusta, Comentar) */}
        <div className="absolute bottom-8 right-4 flex flex-col gap-6 z-30 md:hidden pointer-events-none">
          <div className="flex flex-col items-center gap-1 pointer-events-auto">
            <button className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <span className="text-white text-xs font-semibold drop-shadow-md">{publicacion.meGusta ?? 0}</span>
          </div>
          <div className="flex flex-col items-center gap-1 pointer-events-auto">
            <button onClick={() => setMostrarComentariosMovil(true)} className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </button>
            <span className="text-white text-xs font-semibold drop-shadow-md">{publicacion.comentarios ?? 0}</span>
          </div>
        </div>
        
        {/* Info del autor en móvil */}
        <div className="absolute bottom-6 left-4 z-30 md:hidden max-w-[70%] drop-shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            {publicacion.autor?.comercio?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicacion.autor.comercio.logoUrl} className="w-10 h-10 rounded-full border-2 border-white object-cover" alt="" />
            ) : (
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1B4332] text-white border-2 border-white font-bold">
                {publicacion.autor?.nombre?.charAt(0) || '?'}
              </div>
            )}
            <span className="text-white font-semibold">{publicacion.autor?.comercio?.nombre || publicacion.autor?.nombre}</span>
          </div>
          <p className="text-white text-sm line-clamp-2">{publicacion.titulo}</p>
        </div>
      </div>

      {/* ÁREA DERECHA (INFO + COMENTARIOS - ESCRITORIO) */}
      <div className="hidden md:flex w-[350px] lg:w-[400px] h-screen bg-white flex-col shrink-0 relative shadow-2xl">
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        {/* Cabecera Info */}
        <div className="flex items-start p-4 border-b">
          <div className="flex items-center gap-3">
             {publicacion.autor?.comercio?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicacion.autor.comercio.logoUrl} className="w-12 h-12 rounded-full border border-[#D4A017] object-cover" alt="" />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-[#1B4332] text-white font-bold text-lg">
                {publicacion.autor?.nombre?.charAt(0) || '?'}
              </div>
            )}
            <div>
              <Link href={publicacion.autor?.comercio ? `/comercios/${publicacion.autor.comercio.id}` : '#'} className="font-bold text-gray-900 hover:underline">
                {publicacion.autor?.comercio?.nombre || publicacion.autor?.nombre}
              </Link>
              {publicacion.esAnuncio && (
                <div className="flex items-center gap-1 text-xs font-semibold text-[#D4A017] mt-0.5">
                  <span>⭐</span> Patrocinado
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[30vh]">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{publicacion.titulo}</p>
        </div>

        <div className="h-2 bg-gray-50 shrink-0" />

        {/* Comentarios Inline */}
        <div className="flex-1 overflow-hidden relative">
          <ModalComentarios 
            publicacionId={publicacion.id} 
            totalComentariosInit={publicacion.comentarios}
            esPropiaPublicacion={esPropiaPublicacion}
            inline={true}
          />
        </div>
      </div>

      {/* Modal de Comentarios en Móvil */}
      {mostrarComentariosMovil && (
        <div className="md:hidden">
          <ModalComentarios 
            publicacionId={publicacion.id} 
            totalComentariosInit={publicacion.comentarios}
            esPropiaPublicacion={esPropiaPublicacion}
            onClose={() => setMostrarComentariosMovil(false)}
            inline={false}
          />
        </div>
      )}
    </div>,
    document.body
  )
}
