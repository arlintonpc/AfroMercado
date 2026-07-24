'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  registrarCompartidoPublicacion,
  toggleFavoritoPublicacionCultural,
  toggleLikePublicacion,
  type PublicacionCultural,
} from '@/lib/api/cultura'
import { toggleSeguirComercio } from '@/lib/api/comercios'
import { toggleSeguirUsuario } from '@/lib/api/usuarios'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { detectar } from '@/components/comerciante/ReproductorVideo'
import ModalComentarios from './ModalComentarios'
import { ModalCompartir } from './ModalCompartir'

export interface VitrinaReelsFeedProps {
  publicaciones: PublicacionCultural[]
  publicacionInicialId?: number
  onCerrar?: () => void
}

function ReelVideoPlayer({
  videoUrl,
  titulo,
  esActivo,
  silenciado,
  onToggleSilenciado,
}: {
  videoUrl: string
  titulo: string
  esActivo: boolean
  silenciado: boolean
  onToggleSilenciado: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [pausado, setPausado] = useState(false)
  const [animandoIcono, setAnimandoIcono] = useState<'PLAY' | 'PAUSE' | null>(null)

  useEffect(() => {
    if (videoRef.current) {
      if (esActivo) {
        if (videoRef.current.paused) {
          const p = videoRef.current.play()
          if (p !== undefined) {
            p.catch(() => {})
          }
        }
        setPausado(false)
      } else {
        videoRef.current.pause()
      }
    }
  }, [esActivo])

  function togglePlayPause() {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      const p = videoRef.current.play()
      if (p !== undefined) p.catch(() => {})
      setPausado(false)
      setAnimandoIcono('PLAY')
    } else {
      videoRef.current.pause()
      setPausado(true)
      setAnimandoIcono('PAUSE')
    }
    setTimeout(() => setAnimandoIcono(null), 800)
  }

  const { plataforma, embedUrl } = detectar(videoUrl)

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
      {plataforma === 'directo' ? (
        <div className="relative w-full h-full cursor-pointer select-none" onClick={togglePlayPause}>
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            autoPlay={esActivo}
            loop
            muted={silenciado}
            playsInline
          />

          {/* Animación flotante Play/Pausa al tocar (Glassmorphism & Brand Colors) */}
          {animandoIcono && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in zoom-in-50 fade-out-80 duration-500">
              <div className="w-20 h-20 rounded-full bg-[#1B4332]/75 backdrop-blur-md border border-[#D4A017]/40 flex items-center justify-center text-white shadow-2xl">
                {animandoIcono === 'PLAY' ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                )}
              </div>
            </div>
          )}

          {/* Indicador persistente si el video está pausado */}
          {pausado && !animandoIcono && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="w-16 h-16 rounded-full bg-[#1B4332]/70 backdrop-blur-md border border-[#D4A017]/40 flex items-center justify-center text-white shadow-xl">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      ) : embedUrl ? (
        <iframe
          src={esActivo ? embedUrl : undefined}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          frameBorder="0"
          title={titulo}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <span className="text-white/40 text-sm font-medium">Video no disponible para reproducir aquí</span>
        </div>
      )}

      {/* Botón Flotante de Audio (Estilo Premium Teravia: Verde Oscuro + Dorado + SVG Vectorial) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleSilenciado()
        }}
        aria-label={silenciado ? 'Activar sonido' : 'Silenciar'}
        className="absolute top-16 md:top-6 right-4 z-30 px-4 py-2 rounded-full bg-[#1B4332]/80 hover:bg-[#2D6A4F] backdrop-blur-md border border-[#D4A017]/40 text-white text-xs font-extrabold transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer shadow-xl"
      >
        {silenciado ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            <span>Sin sonido</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#D4A017]">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
            <span className="text-[#D4A017]">Sonido ON</span>
          </>
        )}
      </button>
    </div>
  )
}

export default function VitrinaReelsFeed({
  publicaciones,
  publicacionInicialId,
  onCerrar,
}: VitrinaReelsFeedProps) {
  const router = useRouter()
  const { usuario } = useAuth()
  // Filtrar ÚNICAMENTE publicaciones que contengan video
  const videosOnly = publicaciones.filter((p) => !!p.videoUrl)
  
  // Encontrar el índice inicial si se especificó publicacionInicialId
  const initialIndex = publicacionInicialId
    ? Math.max(0, videosOnly.findIndex((p) => p.id === publicacionInicialId))
    : 0

  const [indexActivo, setIndexActivo] = useState(initialIndex)
  const containerRef = useRef<HTMLDivElement>(null)
  const [likesPorId, setLikesPorId] = useState<Record<number, number>>({})
  const [meGustaPorId, setMeGustaPorId] = useState<Record<number, boolean>>({})
  const [favoritoPorId, setFavoritoPorId] = useState<Record<number, boolean>>({})
  const [siguiendoPorId, setSiguiendoPorId] = useState<Record<number, boolean>>({})
  const [comentariosPorId, setComentariosPorId] = useState<Record<number, number>>({})
  const [compartidosPorId, setCompartidosPorId] = useState<Record<number, number>>({})
  const [guardadosPorId, setGuardadosPorId] = useState<Record<number, number>>({})
  const [seguidoresPorId, setSeguidoresPorId] = useState<Record<number, number>>({})
  const [comentando, setComentando] = useState<PublicacionCultural | null>(null)
  const [compartiendo, setCompartiendo] = useState<PublicacionCultural | null>(null)
  const [silenciadoGlobal, setSilenciadoGlobal] = useState<boolean>(true)

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

  // En escritorio las flechas replican el gesto vertical del móvil sin sacar
  // al usuario del feed. La rueda/touch siguen funcionando de forma nativa.
  useEffect(() => {
    function navegarConTeclado(event: KeyboardEvent) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      if (comentando || compartiendo) return
      const contenedor = containerRef.current
      if (!contenedor) return
      event.preventDefault()
      const destino = Math.max(0, Math.min(videosOnly.length - 1, indexActivo + (event.key === 'ArrowDown' ? 1 : -1)))
      contenedor.scrollTo({ top: destino * contenedor.clientHeight, behavior: 'smooth' })
    }
    window.addEventListener('keydown', navegarConTeclado)
    return () => window.removeEventListener('keydown', navegarConTeclado)
  }, [comentando, compartiendo, indexActivo, videosOnly.length])

  if (!videosOnly || videosOnly.length === 0) {
    return null
  }

  function requerirSesion(): boolean {
    if (usuario) return true
    router.push('/ingresar')
    return false
  }

  async function handleToggleLike(pub: PublicacionCultural) {
    if (!requerirSesion()) return
    const estadoPrevio = meGustaPorId[pub.id] ?? pub.meGusta ?? false
    const likesPrevios = likesPorId[pub.id] ?? pub.totalLikes ?? 0
    setMeGustaPorId((prev) => ({ ...prev, [pub.id]: !estadoPrevio }))
    setLikesPorId((prev) => ({ ...prev, [pub.id]: likesPrevios + (estadoPrevio ? -1 : 1) }))
    try {
      const resultado = await toggleLikePublicacion(pub.id)
      setMeGustaPorId((prev) => ({ ...prev, [pub.id]: resultado.meGusta }))
      setLikesPorId((prev) => ({ ...prev, [pub.id]: resultado.totalLikes }))
    } catch {
      setMeGustaPorId((prev) => ({ ...prev, [pub.id]: estadoPrevio }))
      setLikesPorId((prev) => ({ ...prev, [pub.id]: likesPrevios }))
    }
  }

  async function handleToggleFavorito(pub: PublicacionCultural) {
    if (!requerirSesion()) return
    const estadoPrevio = favoritoPorId[pub.id] ?? pub.esFavorito ?? false
    const guardadosPrevios = guardadosPorId[pub.id] ?? pub.totalGuardados ?? 0
    setFavoritoPorId((prev) => ({ ...prev, [pub.id]: !estadoPrevio }))
    setGuardadosPorId((prev) => ({ ...prev, [pub.id]: Math.max(0, guardadosPrevios + (estadoPrevio ? -1 : 1)) }))
    try {
      const resultado = await toggleFavoritoPublicacionCultural(pub.id)
      setFavoritoPorId((prev) => ({ ...prev, [pub.id]: resultado.esFavorito }))
    } catch {
      setFavoritoPorId((prev) => ({ ...prev, [pub.id]: estadoPrevio }))
      setGuardadosPorId((prev) => ({ ...prev, [pub.id]: guardadosPrevios }))
    }
  }

  async function handleToggleSeguir(pub: PublicacionCultural) {
    if (!requerirSesion()) return
    const entidadId = pub.comercio?.id ?? pub.autor?.id
    if (!entidadId) return
    const estadoPrevio = siguiendoPorId[pub.id] ?? pub.comercio?.siguiendo ?? pub.autor?.siguiendo ?? false
    const seguidoresPrevios = seguidoresPorId[pub.id] ?? pub.comercio?.totalSeguidores ?? pub.autor?.totalSeguidores ?? 0
    setSiguiendoPorId((prev) => ({ ...prev, [pub.id]: !estadoPrevio }))
    setSeguidoresPorId((prev) => ({ ...prev, [pub.id]: Math.max(0, seguidoresPrevios + (estadoPrevio ? -1 : 1)) }))
    try {
      const resultado = pub.comercio
        ? await toggleSeguirComercio(entidadId)
        : await toggleSeguirUsuario(entidadId)
      setSiguiendoPorId((prev) => ({ ...prev, [pub.id]: resultado.siguiendo }))
    } catch {
      setSiguiendoPorId((prev) => ({ ...prev, [pub.id]: estadoPrevio }))
      setSeguidoresPorId((prev) => ({ ...prev, [pub.id]: seguidoresPrevios }))
    }
  }

  function registrarComentario(pub: PublicacionCultural) {
    const previos = comentariosPorId[pub.id] ?? pub.totalComentarios ?? 0
    setComentariosPorId((prev) => ({ ...prev, [pub.id]: previos + 1 }))
  }

  function registrarCompartido(pub: PublicacionCultural) {
    const previos = compartidosPorId[pub.id] ?? pub.totalCompartidos ?? 0
    setCompartidosPorId((prev) => ({ ...prev, [pub.id]: previos + 1 }))
    void registrarCompartidoPublicacion(pub.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white font-sans">
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
        className="flex-1 overflow-y-scroll snap-y snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {videosOnly.map((pub, idx) => {
          const esActivo = idx === indexActivo
          const municipio = pub.municipio || 'Chocó'
          const meGusta = meGustaPorId[pub.id] ?? pub.meGusta ?? false
          const likes = likesPorId[pub.id] ?? pub.totalLikes ?? 0
          const esFavorito = favoritoPorId[pub.id] ?? pub.esFavorito ?? false
          const siguiendo = siguiendoPorId[pub.id] ?? pub.comercio?.siguiendo ?? pub.autor?.siguiendo ?? false
          const comentarios = comentariosPorId[pub.id] ?? pub.totalComentarios ?? 0
          const compartidos = compartidosPorId[pub.id] ?? pub.totalCompartidos ?? 0
          const guardados = guardadosPorId[pub.id] ?? pub.totalGuardados ?? 0
          const seguidores = seguidoresPorId[pub.id] ?? pub.comercio?.totalSeguidores ?? pub.autor?.totalSeguidores ?? 0

          return (
            <div
              key={pub.id}
              className="h-[100dvh] w-full snap-start relative flex items-center justify-center bg-black overflow-hidden"
            >
              {/* Fondo Ambiental Desenfocado para Computador (Desktop Ambient Blur Backdrop) */}
              {pub.videoUrl && (
                <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <video
                    src={pub.videoUrl}
                    className="w-full h-full object-cover blur-3xl opacity-35 scale-125"
                    muted
                    loop
                    autoPlay={esActivo}
                  />
                  <div className="absolute inset-0 bg-black/50" />
                </div>
              )}

              {/* Contenedor Principal del Reproductor (Full screen en móvil, Tarjeta vertical 460px centrada en Computador) */}
              <div className="relative w-full h-full md:max-w-[460px] md:h-[94vh] md:rounded-3xl md:border md:border-white/20 md:shadow-2xl overflow-hidden flex items-center justify-center bg-black z-10 my-auto">
                {/* Video Player Interactivo (Tap Play/Pause + Audio Toggle) */}
                <ReelVideoPlayer
                  videoUrl={pub.videoUrl!}
                  titulo={pub.titulo}
                  esActivo={esActivo}
                  silenciado={silenciadoGlobal}
                  onToggleSilenciado={() => setSilenciadoGlobal((s) => !s)}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 pointer-events-none" />

                {/* Badge de Disponibilidad sobrepuesto */}
                <div className="absolute top-16 md:top-6 left-4 z-20">
                  <span className="bg-emerald-600/90 text-white font-bold text-xs px-3.5 py-1.5 rounded-full backdrop-blur-md border border-emerald-400/40 shadow-xl flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    🟢 Disponible ahora en {municipio}
                  </span>
                </div>

                {/* BARRA ACCIONES LATERAL DERECHA (Like, Comentar, Compartir, Guardar) - Estilo Reels */}
                <div className="absolute right-4 bottom-24 z-30 flex flex-col items-center gap-5 text-white">
                  <button type="button" onClick={() => handleToggleLike(pub)} aria-label="Me gusta" className="flex flex-col items-center gap-1 group cursor-pointer">
                    <div className={`w-12 h-12 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center transition-all group-hover:scale-110 ${meGusta ? 'bg-rose-600 text-white' : 'bg-black/40 hover:bg-black/60 text-white'}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={meGusta ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold drop-shadow-md">{likes}</span>
                  </button>

                  <button type="button" onClick={() => setComentando(pub)} aria-label="Ver comentarios" className="flex flex-col items-center gap-1 group cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all group-hover:scale-110">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold drop-shadow-md">{comentarios}</span>
                  </button>

                  <button type="button" onClick={() => setCompartiendo(pub)} aria-label="Compartir" className="flex flex-col items-center gap-1 group cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all group-hover:scale-110">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold drop-shadow-md">{compartidos}</span>
                  </button>

                  <button type="button" onClick={() => handleToggleFavorito(pub)} aria-label="Guardar" className="flex flex-col items-center gap-1 group cursor-pointer">
                    <div className={`w-12 h-12 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center transition-all group-hover:scale-110 ${esFavorito ? 'bg-amber-500 text-black' : 'bg-black/40 hover:bg-black/60 text-white'}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={esFavorito ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold drop-shadow-md">{guardados}</span>
                  </button>
                </div>

                {/* Información del Creador / Comercio abajo a la izquierda */}
                <div className="absolute bottom-28 left-4 right-20 z-20 flex flex-col gap-2 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#D4A017] bg-[#1B4332] flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">
                      {pub.comercio?.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={pub.comercio.logoUrl} alt={pub.comercio.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <span>{pub.comercio?.nombre?.[0] || 'T'}</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm drop-shadow-md">{pub.comercio?.nombre || pub.autor?.nombre}</h3>
                        {(pub.comercio || pub.autor) && (
                          <button type="button" onClick={() => handleToggleSeguir(pub)} className="text-xs font-bold px-3 py-0.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 transition-all cursor-pointer">
                            {siguiendo ? 'Siguiendo' : 'Seguir'}
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-amber-300 font-medium drop-shadow-md">
                        📍 {municipio} • {seguidores} seguidores
                      </span>
                    </div>
                  </div>

                  {pub.descripcion && (
                    <p className="text-xs text-gray-200 line-clamp-2 drop-shadow-md max-w-sm leading-relaxed">
                      {pub.descripcion}
                    </p>
                  )}
                </div>

                {/* TARJETA FLOTANTE DE OFERTA COMERCIAL (Estilo Facebook Reels Ad / Glassmorphism) */}
                <div className="absolute bottom-4 left-4 right-4 z-30 bg-[#18191A]/95 text-white backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {pub.producto?.fotoUrl ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/20 shadow-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pub.producto.fotoUrl} alt={pub.producto.nombre} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#1B4332] text-amber-300 flex items-center justify-center font-bold text-base flex-shrink-0 shadow-md">
                        🛒
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-white truncate tracking-tight">
                        {pub.producto?.nombre || pub.titulo || 'Oferta Territorial'}
                      </h4>
                      <p className="text-[11px] text-gray-300 truncate">
                        {municipio} • Teravia
                      </p>
                      <p className="text-xs font-black text-emerald-400 mt-0.5">
                        {pub.producto ? formatearPrecio(Number(pub.producto.precio)) : 'Ver detalles'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {pub.producto ? (
                      <button
                        onClick={() => router.push(`/producto/${pub.producto!.id}`)}
                        className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>🛒</span>
                        <span>Comprar</span>
                      </button>
                    ) : pub.comercio ? (
                      <button
                        onClick={() => router.push(`/comercio/${pub.comercio!.id}`)}
                        className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver oferta</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {comentando && (
        <ModalComentarios
          publicacionId={comentando.id}
          totalComentariosInit={comentando.totalComentarios}
          onComentarioAgregado={() => registrarComentario(comentando)}
          onClose={() => setComentando(null)}
        />
      )}
      {compartiendo && (
        <ModalCompartir
          abierto
          onClose={() => setCompartiendo(null)}
          url={`${window.location.origin}/vitrina?publicacion=${compartiendo.id}`}
          titulo={compartiendo.titulo || compartiendo.descripcion || 'Teravia'}
          onCompartir={() => registrarCompartido(compartiendo)}
        />
      )}
    </div>
  )
}
