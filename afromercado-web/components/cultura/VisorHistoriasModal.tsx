'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  type GrupoHistoria,
  type HistoriaEfimera,
  registrarVistaHistoria,
  eliminarHistoria,
} from '@/lib/api/cultura'
import { useAuth } from '@/context/AuthContext'
import { normalizarUrlMedia } from '@/lib/api/client'

interface VisorHistoriasModalProps {
  grupos: GrupoHistoria[]
  grupoInicialIndex?: number
  onClose: () => void
  onHistoriasActualizadas: () => void
}

export default function VisorHistoriasModal({
  grupos,
  grupoInicialIndex = 0,
  onClose,
  onHistoriasActualizadas,
}: VisorHistoriasModalProps) {
  const { usuario } = useAuth()

  const [grupoIdx, setGrupoIdx] = useState(grupoInicialIndex)
  const [historiaIdx, setHistoriaIdx] = useState(0)

  const [pausado, setPausado] = useState(false)
  const [silenciado, setSilenciado] = useState(true)
  const [progresoMs, setProgresoMs] = useState(0)

  const [mensajeRespuesta, setMensajeRespuesta] = useState('')
  const [mensajeEnviado, setMensajeEnviado] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const vistasRegistradas = useRef(new Set<number>())

  const grupoActual = grupos[grupoIdx]
  const historiaActual: HistoriaEfimera | undefined = grupoActual?.historias[historiaIdx]

  const duracionTotalMs = (historiaActual?.duracionSegundos ?? 5) * 1000

  // Registrar vista de la historia actual
  useEffect(() => {
    if (historiaActual && !historiaActual.visto && !vistasRegistradas.current.has(historiaActual.id)) {
      vistasRegistradas.current.add(historiaActual.id)
      registrarVistaHistoria(historiaActual.id).catch(() => {})
    }
  }, [historiaActual])

  // Reset del progreso al cambiar de historia
  useEffect(() => {
    setProgresoMs(0)
    setPausado(false)
  }, [grupoIdx, historiaIdx])

  // Los navegadores permiten autoplay solamente sin sonido. El usuario puede
  // activar audio después mediante un gesto explícito.
  useEffect(() => {
    const video = videoRef.current
    if (!video || historiaActual?.mediaTipo !== 'VIDEO') return
    if (pausado) {
      video.pause()
      return
    }
    video.play().catch(() => setPausado(true))
  }, [historiaActual?.id, historiaActual?.mediaTipo, pausado, silenciado])

  const avanzarHistoria = useCallback(() => {
    if (!grupoActual) return
    if (historiaIdx < grupoActual.historias.length - 1) {
      setHistoriaIdx((prev) => prev + 1)
    } else if (grupoIdx < grupos.length - 1) {
      setGrupoIdx((prev) => prev + 1)
      setHistoriaIdx(0)
    } else {
      onClose()
    }
  }, [grupoActual, historiaIdx, grupoIdx, grupos.length, onClose])

  const retrocederHistoria = useCallback(() => {
    if (historiaIdx > 0) {
      setHistoriaIdx((prev) => prev - 1)
    } else if (grupoIdx > 0) {
      const prevGrupo = grupos[grupoIdx - 1]
      setGrupoIdx((prev) => prev - 1)
      setHistoriaIdx(prevGrupo ? prevGrupo.historias.length - 1 : 0)
    }
  }, [historiaIdx, grupoIdx, grupos])

  // Timer de progreso automático
  useEffect(() => {
    if (!historiaActual || pausado) return

    const INTERVALO_MS = 50
    timerRef.current = setInterval(() => {
      setProgresoMs((prev) => {
        const siguiente = prev + INTERVALO_MS
        if (siguiente >= duracionTotalMs) {
          clearInterval(timerRef.current!)
          avanzarHistoria()
          return 0
        }
        return siguiente
      })
    }, INTERVALO_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [historiaActual, pausado, duracionTotalMs, avanzarHistoria])

  // Teclas de dirección (Escape, Flecha Izq/Der)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') avanzarHistoria()
      if (e.key === 'ArrowLeft') retrocederHistoria()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, avanzarHistoria, retrocederHistoria])

  if (!grupoActual || !historiaActual) return null

  const esDuenio =
    Boolean(
      usuario &&
        Number(usuario.id) === Number(historiaActual.autorId)
    )

  async function handleEliminar() {
    if (!historiaActual || !confirm('¿Estás seguro de eliminar esta historia?')) return
    try {
      await eliminarHistoria(historiaActual.id)
      onHistoriasActualizadas()
      avanzarHistoria()
    } catch {
      alert('No se pudo eliminar la historia.')
    }
  }

  function handleEnviarRespuesta(e: React.FormEvent) {
    e.preventDefault()
    if (!mensajeRespuesta.trim() || !historiaActual) return

    const comercio = grupoActual.historias[0]?.comercio
    const whatsapp = comercio?.whatsappVisible ? comercio.whatsapp : null
    if (whatsapp) {
      const num = whatsapp.replace(/\D/g, '')
      const text = encodeURIComponent(`Hola ${grupoActual.nombre}, vi tu historia "${historiaActual.texto || ''}": ${mensajeRespuesta}`)
      window.open(`https://wa.me/${num}?text=${text}`, '_blank')
    }
    setMensajeEnviado(true)
    setMensajeRespuesta('')
    setTimeout(() => setMensajeEnviado(false), 3000)
  }

  const avatarUrl = normalizarUrlMedia(grupoActual.avatarUrl)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md text-white font-sans">
      {/* Fondo desenfocado ambiental */}
      <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none z-0">
        {historiaActual.mediaTipo === 'VIDEO' ? (
          <video src={historiaActual.mediaUrl} className="w-full h-full object-cover blur-3xl opacity-30 scale-125" autoPlay loop muted />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={historiaActual.mediaUrl} alt="" className="w-full h-full object-cover blur-3xl opacity-30 scale-125" />
        )}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Contenedor Principal del Visor (Full width en móvil, Tarjeta vertical 420px en Desktop) */}
      <div
        className="relative w-full h-full md:max-w-[420px] md:h-[92vh] md:rounded-3xl md:border md:border-white/20 md:shadow-2xl overflow-hidden flex flex-col justify-between bg-black z-10 my-auto select-none"
        onMouseDown={() => setPausado(true)}
        onMouseUp={() => setPausado(false)}
        onTouchStart={() => setPausado(true)}
        onTouchEnd={() => setPausado(false)}
      >
        {/* Capas táctiles de navegación lateral */}
        <div className="absolute inset-0 z-20 flex pointer-events-auto">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              retrocederHistoria()
            }}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              avanzarHistoria()
            }}
          />
        </div>

        {/* 1. Barras de Progreso Superiores */}
        <div className="absolute top-0 inset-x-0 z-30 p-3 pt-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent space-y-2 pointer-events-none">
          <div className="flex items-center gap-1.5 w-full">
            {grupoActual.historias.map((h, index) => {
              let pct = 0
              if (index < historiaIdx) pct = 100
              else if (index === historiaIdx) pct = Math.min(100, (progresoMs / duracionTotalMs) * 100)
              return (
                <div key={h.id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-75 ease-linear"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )
            })}
          </div>

          {/* Cabecera del Creador / Comercio */}
          <div className="flex items-center justify-between pointer-events-auto pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#D4A017] bg-[#1B4332] flex items-center justify-center font-bold text-white flex-shrink-0 shadow-md">
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUrl} alt={grupoActual.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span>{grupoActual.nombre.charAt(0)}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-white drop-shadow-md truncate">{grupoActual.nombre}</span>
                <span className="text-[10px] text-amber-300 font-semibold drop-shadow-md">
                  {grupoActual.esComercio ? '🏪 Comercio Territorial' : '👤 Miembro'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {historiaActual.mediaTipo === 'VIDEO' && (
                <button
                  type="button"
                  onClick={() => setSilenciado((actual) => !actual)}
                  className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-black/80"
                  aria-label={silenciado ? 'Activar sonido' : 'Silenciar video'}
                >
                  {silenciado ? 'Sonido' : 'Silenciar'}
                </button>
              )}
              {esDuenio && (
                <button
                  type="button"
                  onClick={handleEliminar}
                  className="px-2.5 py-1 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-bold transition shadow-md"
                  title="Eliminar historia"
                >
                  🗑️
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 border border-white/30 text-white flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* 2. Media Principal (Foto / Video) */}
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {historiaActual.mediaTipo === 'VIDEO' ? (
            <video
              ref={videoRef}
              src={historiaActual.mediaUrl}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted={silenciado}
              playsInline
              onEnded={avanzarHistoria}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={historiaActual.mediaUrl} alt="" className="w-full h-full object-cover" />
          )}

          {/* Texto Superpuesto */}
          {historiaActual.texto && (
            <div className="absolute inset-x-4 bottom-24 z-30 bg-black/65 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-center">
              <p className="text-sm font-bold text-white leading-snug drop-shadow-md">{historiaActual.texto}</p>
            </div>
          )}
        </div>

        {/* 3. Pie de Página: Respuesta & Vistas */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto">
          {esDuenio ? (
            <div className="flex items-center justify-between bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <span className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                <span>👀</span>
                <span>{historiaActual.vistasCount} vistas</span>
              </span>
              <span className="text-[10px] text-gray-300">Tu historia caduca en 24h</span>
            </div>
          ) : (
            <form onSubmit={handleEnviarRespuesta} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Responder a ${grupoActual.nombre}...`}
                value={mensajeRespuesta}
                onChange={(e) => setMensajeRespuesta(e.target.value)}
                className="flex-1 bg-white/15 backdrop-blur-md border border-white/30 rounded-full px-4 py-2.5 text-xs text-white placeholder:text-gray-300 outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-bold transition shadow-lg flex items-center justify-center gap-1"
              >
                <span>💬</span>
                <span>Enviar</span>
              </button>
            </form>
          )}

          {mensajeEnviado && (
            <div className="mt-2 text-center text-xs font-bold text-emerald-400 animate-in fade-in">
              ✅ ¡Mensaje enviado!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
