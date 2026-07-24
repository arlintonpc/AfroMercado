'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PublicacionCultural } from '@/lib/api/cultura'
import { formatearPrecio } from '@/lib/formatearPrecio'

export interface VitrinaReelsFeedProps {
  publicaciones: PublicacionCultural[]
  publicacionInicialId?: number
  onCerrar?: () => void
}

export default function VitrinaReelsFeed({
  publicaciones,
  publicacionInicialId,
  onCerrar,
}: VitrinaReelsFeedProps) {
  const router = useRouter()
  // Filtrar ÚNICAMENTE publicaciones que contengan video
  const videosOnly = publicaciones.filter((p) => !!p.videoUrl)
  
  // Encontrar el índice inicial si se especificó publicacionInicialId
  const initialIndex = publicacionInicialId
    ? Math.max(0, videosOnly.findIndex((p) => p.id === publicacionInicialId))
    : 0

  const [indexActivo, setIndexActivo] = useState(initialIndex)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll automático al índice inicial en montaje
  useEffect(() => {
    if (initialIndex > 0 && containerRef.current) {
      const height = containerRef.current.clientHeight
      containerRef.current.scrollTop = initialIndex * height
    }
  }, [initialIndex])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function handleScroll() {
      if (!el) return
      const height = el.clientHeight
      const newIndex = Math.round(el.scrollTop / height)
      if (newIndex !== indexActivo && newIndex >= 0 && newIndex < videosOnly.length) {
        setIndexActivo(newIndex)
      }
    }

    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [indexActivo, videosOnly.length])

  if (!videosOnly || videosOnly.length === 0) {
    return null
  }

  const pubActual = videosOnly[indexActivo]

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col font-sans">
      {/* 1. Header Flotante Superior */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
        <div className="flex items-center gap-3">
          {onCerrar ? (
            <button
              onClick={onCerrar}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center transition-all border border-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <Link
              href="/vitrina"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center transition-all border border-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </Link>
          )}
          <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-amber-400 via-emerald-300 to-emerald-400 bg-clip-text text-transparent">
            Vitrina Videos — Teravia
          </span>
        </div>

        <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20">
          {indexActivo + 1} / {videosOnly.length}
        </div>
      </div>

      {/* 2. Contenedor Snap Scroll Vertical */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      >
        {videosOnly.map((pub, idx) => {
          const esActivo = idx === indexActivo
          const municipio = pub.municipio || 'Chocó'

          return (
            <div
              key={pub.id}
              className="h-screen w-full snap-start relative flex items-center justify-center bg-black overflow-hidden"
            >
              {/* Video Player */}
              <video
                src={pub.videoUrl!}
                className="w-full h-full object-cover"
                autoPlay={esActivo}
                loop
                muted
                playsInline
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 pointer-events-none" />

              {/* Badge de Disponibilidad sobrepuesto */}
              <div className="absolute top-20 left-4 z-20">
                <span className="bg-emerald-600/90 text-white font-bold text-xs px-3.5 py-1.5 rounded-full backdrop-blur-md border border-emerald-400/40 shadow-xl flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  🟢 Disponible ahora en {municipio}
                </span>
              </div>

              {/* BARRA ACCIONES LATERAL DERECHA (Like, Comentar, Compartir, Guardar) - Estilo Reels */}
              <div className="absolute right-4 bottom-24 z-30 flex flex-col items-center gap-5 text-white">
                <button className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all group-hover:scale-110">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold drop-shadow-md">{pub.totalLikes || 12}</span>
                </button>

                <button className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all group-hover:scale-110">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold drop-shadow-md">{pub.totalComentarios || 4}</span>
                </button>

                <button className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all group-hover:scale-110">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold drop-shadow-md">Compartir</span>
                </button>

                <button className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all group-hover:scale-110">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold drop-shadow-md">Guardar</span>
                </button>
              </div>

              {/* Información del Creador / Comercio abajo a la izquierda */}
              <div className="absolute bottom-28 left-4 right-20 z-20 flex flex-col gap-2.5 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#D4A017] bg-[#1B4332] flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">
                    {pub.comercio?.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={pub.comercio.logoUrl} alt={pub.comercio.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <span>{pub.comercio?.nombre?.[0] || 'T'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm drop-shadow-md">{pub.comercio?.nombre || pub.autor?.nombre}</h3>
                    <button className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 transition-all">
                      Seguir
                    </button>
                  </div>
                </div>

                {pub.descripcion && (
                  <p className="text-xs text-gray-200 line-clamp-2 drop-shadow-md max-w-sm leading-relaxed">
                    {pub.descripcion}
                  </p>
                )}
              </div>

              {/* TARJETA FLOTANTE DE OFERTA COMERCIAL (Estilo Facebook Reels Ad / Screenshot 2) */}
              <div className="absolute bottom-4 left-4 right-4 z-30 max-w-md bg-[#18191A]/95 text-white backdrop-blur-xl border border-white/20 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {pub.producto?.fotoUrl ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/20 shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pub.producto.fotoUrl} alt={pub.producto.nombre} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#1B4332] text-amber-300 flex items-center justify-center font-bold text-base flex-shrink-0 shadow-md">
                      🛒
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-white truncate tracking-tight">
                      {pub.producto?.nombre || pub.titulo || 'Oferta Territorial'}
                    </h4>
                    <p className="text-xs text-gray-300 truncate mt-0.5">
                      {municipio} • Teravia
                    </p>
                    <p className="text-sm font-black text-emerald-400 mt-0.5">
                      {pub.producto ? formatearPrecio(Number(pub.producto.precio)) : 'Ver detalles'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {pub.producto ? (
                    <button
                      onClick={() => router.push(`/producto/${pub.producto!.id}`)}
                      className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>🛒</span>
                      <span>Comprar</span>
                    </button>
                  ) : pub.comercio ? (
                    <button
                      onClick={() => router.push(`/comercio/${pub.comercio!.id}`)}
                      className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ver oferta</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
