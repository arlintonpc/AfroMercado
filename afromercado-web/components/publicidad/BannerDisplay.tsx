'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { trackMetrica } from '@/components/publicidad/api'

export interface BannerDisplayData {
  id: string
  esBannerDisplay: boolean
  titulo?: string | null
  subtitulo?: string | null
  mediaUrl?: string | null
  urlDestino?: string | null
  ctaTexto?: string | null
  etiqueta?: string
}

export default function BannerDisplay({ banner }: { banner: BannerDisplayData }) {
  const [imgError, setImgError] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [impresionRegistrada, setImpresionRegistrada] = useState(false)

  useEffect(() => {
    if (!ref.current || impresionRegistrada) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          trackMetrica(banner.id, 'IMPRESION')
          setImpresionRegistrada(true)
          observer.disconnect()
        }
      },
      { threshold: 0.5 } // 50% visibility required for an impression
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [banner.id, impresionRegistrada])

  const handleClick = () => {
    trackMetrica(banner.id, 'CLIC')
  }

  const content = (
    <div ref={ref} className="group relative w-full overflow-hidden rounded-2xl bg-[#0d0d0d] shadow-2xl transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:ring-2 hover:ring-[#D4A017]/50 min-h-[240px] sm:min-h-[260px] flex items-stretch">
      
      {/* Imagen de fondo (Ocupa todo, pero se desvanece hacia la izquierda) */}
      {banner.mediaUrl && !imgError && (
        <div className="absolute inset-0 w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={banner.mediaUrl} 
            alt={banner.titulo || 'Anuncio'} 
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105"
          />
        </div>
      )}

      {/* Gradientes de protección para el texto */}
      {/* 1. Capa base oscura para la izquierda */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent w-[70%]" />
      {/* 2. Capa superior general (muy sutil) */}
      <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-700" />
      {/* 3. Sombra radial de apoyo para el texto */}
      <div className="absolute top-0 left-0 h-full w-[40%] bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-black/30 to-transparent blur-sm" />

      {/* Contenido */}
      <div className="relative z-10 flex h-full w-full flex-col justify-center px-6 md:px-10 py-6 md:py-8 w-[90%] md:w-[75%] lg:w-[65%]">
        
        {/* Etiqueta Promocional */}
        <div className="mb-3">
          <span className="inline-block rounded-md bg-[#D4A017] px-3 py-1 text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-[#0d0d0d] shadow-[0_0_15px_rgba(212,160,23,0.4)]">
            {banner.etiqueta || 'Patrocinado'}
          </span>
        </div>
        
        {/* Título Ultra-Legible */}
        <h3 
          className="mb-2 text-2xl md:text-3xl lg:text-4xl font-black leading-[1.1] text-white tracking-tight"
          style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {banner.titulo}
        </h3>
        
        {/* Subtítulo */}
        {banner.subtitulo && (
          <p 
            className="mb-5 text-sm md:text-base font-medium text-gray-200 line-clamp-3 max-w-xl leading-snug"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
          >
            {banner.subtitulo}
          </p>
        )}

        {/* Botón Call to Action */}
        <div className="mt-auto">
          <span className="inline-flex items-center gap-2 rounded-xl bg-white text-[#0d0d0d] px-6 py-2.5 text-sm font-bold shadow-lg transition-all group-hover:bg-[#D4A017] group-hover:text-[#0d0d0d] group-hover:shadow-[0_0_20px_rgba(212,160,23,0.3)] group-hover:-translate-y-1">
            {banner.ctaTexto || 'Descubrir más'}
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )

  if (banner.urlDestino) {
    return (
      <Link href={banner.urlDestino} className="block w-full" onClick={handleClick}>
        {content}
      </Link>
    )
  }

  return <div className="block w-full" onClick={handleClick}>{content}</div>
}
