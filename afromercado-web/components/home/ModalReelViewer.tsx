'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { X, Volume2, VolumeX, Heart, Share2, ExternalLink } from 'lucide-react'

export interface HistoriaReel {
  id: string
  creadorNombre: string
  creadorAvatar?: string
  creadorRol: string
  municipio: string
  titulo: string
  descripcion: string
  videoUrl: string
  posterUrl?: string
  linkAccion?: string
  textoAccion?: string
  verificadoEtnico?: boolean
}

interface ModalReelViewerProps {
  historias: HistoriaReel[]
  indiceInicial: number
  onClose: () => void
}

export default function ModalReelViewer({ historias, indiceInicial, onClose }: ModalReelViewerProps) {
  const [idxActual, setIdxActual] = useState(indiceInicial)
  const [silenciado, setSilenciado] = useState(false)
  const [meGusta, setMeGusta] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const historia = historias[idxActual]

  useEffect(() => {
    setProgreso(0)
    setMeGusta(false)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [idxActual])

  function manejarTimeUpdate() {
    if (videoRef.current && videoRef.current.duration) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100
      setProgreso(p)
    }
  }

  function siguienteHistoria() {
    if (idxActual < historias.length - 1) {
      setIdxActual(prev => prev + 1)
    } else {
      onClose()
    }
  }

  function anteriorHistoria() {
    if (idxActual > 0) {
      setIdxActual(prev => prev - 1)
    }
  }

  if (!historia) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4">
      {/* Container vertical del Reel */}
      <div className="relative w-full max-w-sm h-full sm:h-[92vh] sm:rounded-3xl overflow-hidden bg-black flex flex-col shadow-2xl border border-white/10">

        {/* Barras de progreso superior estilo Instagram */}
        <div className="absolute top-3 left-3 right-3 z-30 flex gap-1.5">
          {historias.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{
                  width: i === idxActual ? `${progreso}%` : i < idxActual ? '100%' : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Cabecera del Creador */}
        <div className="absolute top-7 left-3 right-3 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#D4A017] to-[#52B788] p-0.5">
              <img
                src={historia.creadorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                alt={historia.creadorNombre}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight flex items-center gap-1">
                {historia.creadorNombre}
                {historia.verificadoEtnico && <span title="Productor Verificado">⭐</span>}
              </p>
              <p className="text-[10px] text-white/70">{historia.creadorRol} · {historia.municipio}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSilenciado(p => !p)}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60"
            >
              {silenciado ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Reproductor de Video */}
        <div className="relative flex-1 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            src={historia.videoUrl}
            poster={historia.posterUrl}
            muted={silenciado}
            playsInline
            autoPlay
            onTimeUpdate={manejarTimeUpdate}
            onEnded={siguienteHistoria}
            className="w-full h-full object-cover"
          />

          {/* Zonas táctiles izquierda / derecha */}
          <div className="absolute inset-y-0 left-0 w-1/3 z-20" onClick={anteriorHistoria} />
          <div className="absolute inset-y-0 right-0 w-1/3 z-20" onClick={siguienteHistoria} />
        </div>

        {/* Pie del Reel / Descripción y Botón de Acción */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black via-black/80 to-transparent pt-12 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">{historia.titulo}</h3>
            <p className="text-xs text-white/80 line-clamp-2 mt-1">{historia.descripcion}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            {historia.linkAccion && (
              <Link
                href={historia.linkAccion}
                onClick={onClose}
                className="flex-1 bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg border border-emerald-400/30 hover:scale-[1.02] transition-transform"
              >
                <span>{historia.textoAccion || 'Ver Publicación'}</span>
                <ExternalLink size={14} />
              </Link>
            )}

            <button
              onClick={() => setMeGusta(p => !p)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                meGusta ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Heart size={18} fill={meGusta ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
