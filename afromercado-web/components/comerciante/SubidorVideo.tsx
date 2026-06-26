'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import type { VideoEstado, VideoMetaCaptura } from './api'

interface SubidorVideoProps {
  titulo: string
  descripcion: string
  estadoInicial: VideoEstado
  onSubir: (file: File, meta: VideoMetaCaptura) => Promise<VideoEstado>
  onEliminar: () => Promise<VideoEstado>
}

function formatearDuracion(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) {
    return ''
  }
  const total = Math.max(0, Math.round(segundos))
  const min = Math.floor(total / 60)
  const seg = String(total % 60).padStart(2, '0')
  return `${min}:${seg}`
}

function leerMetadatosVideo(file: File): Promise<VideoMetaCaptura> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url

    video.onloadedmetadata = () => {
      const duracion = Number.isFinite(video.duration) ? video.duration : 0
      URL.revokeObjectURL(url)
      resolve({
        duracionSegundos: duracion,
        ancho: video.videoWidth || 0,
        alto: video.videoHeight || 0,
        bytes: file.size,
        mimeType: file.type || 'video/mp4',
        formato: file.name.split('.').pop()?.toLowerCase() || 'mp4',
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No pudimos leer ese video. Intenta con otro archivo.'))
    }
  })
}

export default function SubidorVideo({
  titulo,
  descripcion,
  estadoInicial,
  onSubir,
  onEliminar,
}: SubidorVideoProps) {
  const [estado, setEstado] = useState<VideoEstado>(estadoInicial)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function seleccionarArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setOcupado(true)

    try {
      const meta = await leerMetadatosVideo(file)
      if (meta.duracionSegundos > 45) {
        throw new Error('El video no puede superar 45 segundos.')
      }
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('El video supera el peso maximo permitido.')
      }
      const nuevo = await onSubir(file, meta)
      setEstado(nuevo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir el video.')
    } finally {
      setOcupado(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function borrarVideo() {
    if (ocupado || !estado.videoUrl) return
    setError(null)
    setOcupado(true)
    try {
      const nuevo = await onEliminar()
      setEstado(nuevo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos quitar el video.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#1A1A1A]">{titulo}</h3>
          <p className="mt-1 text-sm text-[#1A1A1A]/60 leading-relaxed">
            {descripcion}
          </p>
        </div>
        {estado.videoUrl && (
          <span className="rounded-full bg-[#2D6A4F]/10 px-3 py-1 text-xs font-semibold text-[#2D6A4F]">
            Video activo
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#1A1A1A]/10 bg-[#0F0F0F]">
        {estado.videoUrl ? (
          <>
            <video
              className="w-full aspect-video max-h-[420px] object-contain bg-black"
              controls
              playsInline
              preload="metadata"
              poster={estado.videoPosterUrl ?? undefined}
            >
              <source src={estado.videoUrl} type={estado.videoMimeType ?? undefined} />
              Tu navegador no soporta video HTML5.
            </video>
            {estado.videoDuracionSegundos !== null && estado.videoDuracionSegundos !== undefined && (
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                {formatearDuracion(estado.videoDuracionSegundos)}
              </span>
            )}
          </>
        ) : (
          <div className="flex aspect-video min-h-[220px] items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#2D6A4F] px-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Aun no hay video</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-white/70">
                  Sube un clip corto para contar mejor la historia del producto o de la finca.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={ocupado}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245a42] disabled:opacity-60"
        >
          {estado.videoUrl ? 'Cambiar video' : 'Subir video'}
        </button>
        {estado.videoUrl && (
          <button
            type="button"
            onClick={borrarVideo}
            disabled={ocupado}
            className="inline-flex items-center gap-2 rounded-xl border border-[#C0392B]/25 bg-[#C0392B]/5 px-4 py-2.5 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-[#C0392B]/10 disabled:opacity-60"
          >
            Quitar video
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={seleccionarArchivo}
        aria-label="Subir video"
      />

      <p className="text-xs leading-relaxed text-[#1A1A1A]/50">
        Se aceptan distintos formatos de video y la plataforma los optimiza automaticamente.
        El clip debe durar 45 segundos o menos.
      </p>

      {error && (
        <p role="alert" className="text-sm text-[#C0392B]">
          {error}
        </p>
      )}
    </div>
  )
}
