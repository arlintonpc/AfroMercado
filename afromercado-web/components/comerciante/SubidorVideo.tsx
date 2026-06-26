'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { VideoEstado, VideoMetaCaptura } from './api'

const DURACION_MAXIMA_SEGUNDOS = 45
const DURACION_MINIMA_SEGUNDOS = 1
const VIDEO_MAX_BYTES = 100 * 1024 * 1024

interface SubidorVideoProps {
  titulo: string
  descripcion: string
  estadoInicial: VideoEstado
  onSubir: (file: File, meta: VideoMetaCaptura) => Promise<VideoEstado>
  onEliminar: () => Promise<VideoEstado>
}

interface VideoPendiente {
  file: File
  meta: VideoMetaCaptura
  previewUrl: string
}

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

function redondearSegundos(valor: number): number {
  return Math.round(valor * 10) / 10
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
  const [pendiente, setPendiente] = useState<VideoPendiente | null>(null)
  const [recorteInicio, setRecorteInicio] = useState(0)
  const [recorteDuracion, setRecorteDuracion] = useState(DURACION_MAXIMA_SEGUNDOS)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    return () => {
      if (pendiente?.previewUrl) URL.revokeObjectURL(pendiente.previewUrl)
    }
  }, [pendiente?.previewUrl])

  const duracionPendiente = pendiente?.meta.duracionSegundos ?? 0
  const maxInicio = Math.max(0, duracionPendiente - DURACION_MINIMA_SEGUNDOS)
  const maxDuracionDesdeInicio = Math.min(
    DURACION_MAXIMA_SEGUNDOS,
    Math.max(DURACION_MINIMA_SEGUNDOS, duracionPendiente - recorteInicio),
  )
  const duracionSeleccionada = Math.min(recorteDuracion, maxDuracionDesdeInicio)
  const recorteFin = Math.min(duracionPendiente, recorteInicio + duracionSeleccionada)

  function limpiarPendiente() {
    setPendiente(null)
    setRecorteInicio(0)
    setRecorteDuracion(DURACION_MAXIMA_SEGUNDOS)
  }

  async function seleccionarArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setOcupado(true)

    try {
      if (file.size > VIDEO_MAX_BYTES) {
        throw new Error('El video supera el peso maximo permitido.')
      }

      const meta = await leerMetadatosVideo(file)
      if (meta.duracionSegundos > DURACION_MAXIMA_SEGUNDOS) {
        limpiarPendiente()
        setPendiente({
          file,
          meta,
          previewUrl: URL.createObjectURL(file),
        })
        setRecorteInicio(0)
        setRecorteDuracion(DURACION_MAXIMA_SEGUNDOS)
        return
      }

      const nuevo = await onSubir(file, meta)
      setEstado(nuevo)
      limpiarPendiente()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir el video.')
    } finally {
      setOcupado(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function publicarFragmento() {
    if (!pendiente || ocupado) return
    setError(null)
    setOcupado(true)

    try {
      const inicio = redondearSegundos(limitar(recorteInicio, 0, maxInicio))
      const fin = redondearSegundos(limitar(recorteFin, inicio + DURACION_MINIMA_SEGUNDOS, pendiente.meta.duracionSegundos))
      if (fin - inicio > DURACION_MAXIMA_SEGUNDOS) {
        throw new Error('El fragmento no puede superar 45 segundos.')
      }

      const nuevo = await onSubir(pendiente.file, {
        ...pendiente.meta,
        recorteInicioSegundos: inicio,
        recorteFinSegundos: fin,
      })
      setEstado(nuevo)
      limpiarPendiente()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir el fragmento.')
    } finally {
      setOcupado(false)
    }
  }

  function previsualizarFragmento() {
    const video = previewRef.current
    if (!video) return
    video.currentTime = recorteInicio
    void video.play()
  }

  function controlarPreview() {
    const video = previewRef.current
    if (!video || !pendiente) return
    if (video.currentTime >= recorteFin) {
      video.pause()
      video.currentTime = recorteInicio
    }
  }

  async function borrarVideo() {
    if (ocupado || !estado.videoUrl) return
    setError(null)
    setOcupado(true)
    try {
      const nuevo = await onEliminar()
      setEstado(nuevo)
      limpiarPendiente()
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
        {estado.videoUrl && !pendiente && (
          <span className="rounded-full bg-[#2D6A4F]/10 px-3 py-1 text-xs font-semibold text-[#2D6A4F]">
            Video activo
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#1A1A1A]/10 bg-[#0F0F0F]">
        {pendiente ? (
          <>
            <video
              ref={previewRef}
              className="w-full aspect-video max-h-[420px] object-contain bg-black"
              controls
              playsInline
              preload="metadata"
              src={pendiente.previewUrl}
              onTimeUpdate={controlarPreview}
            />
            <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
              Fragmento {formatearDuracion(duracionSeleccionada)}
            </span>
          </>
        ) : estado.videoUrl ? (
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

      {pendiente && (
        <div className="rounded-2xl border border-[#2D6A4F]/15 bg-[#F8F5F0] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-[#1A1A1A]">Selecciona el fragmento</p>
              <p className="mt-1 text-xs text-[#1A1A1A]/60">
                Video original: {formatearDuracion(duracionPendiente)}. Publicaremos solo el tramo elegido.
              </p>
            </div>
            <span className="rounded-full bg-[#2D6A4F]/10 px-3 py-1 text-xs font-semibold text-[#2D6A4F]">
              Maximo 45 segundos
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[#1A1A1A]">
              Inicio: {formatearDuracion(recorteInicio)}
              <input
                type="range"
                min={0}
                max={maxInicio}
                step={0.5}
                value={recorteInicio}
                onChange={(e) => {
                  const nuevoInicio = redondearSegundos(limitar(Number(e.target.value), 0, maxInicio))
                  const nuevoMax = Math.min(
                    DURACION_MAXIMA_SEGUNDOS,
                    Math.max(DURACION_MINIMA_SEGUNDOS, duracionPendiente - nuevoInicio),
                  )
                  setRecorteInicio(nuevoInicio)
                  setRecorteDuracion((actual) => Math.min(actual, nuevoMax))
                }}
                className="accent-[#2D6A4F]"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-[#1A1A1A]">
              Duracion: {formatearDuracion(duracionSeleccionada)}
              <input
                type="range"
                min={DURACION_MINIMA_SEGUNDOS}
                max={maxDuracionDesdeInicio}
                step={0.5}
                value={duracionSeleccionada}
                onChange={(e) => {
                  setRecorteDuracion(redondearSegundos(
                    limitar(Number(e.target.value), DURACION_MINIMA_SEGUNDOS, maxDuracionDesdeInicio),
                  ))
                }}
                className="accent-[#2D6A4F]"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#1A1A1A]/60">
            <span>Fin: {formatearDuracion(recorteFin)}</span>
            <button
              type="button"
              onClick={previsualizarFragmento}
              className="rounded-full border border-[#1A1A1A]/10 bg-white px-3 py-1.5 font-semibold text-[#1A1A1A] hover:bg-[#F2EFE8]"
            >
              Previsualizar fragmento
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {pendiente ? (
          <>
            <button
              type="button"
              onClick={publicarFragmento}
              disabled={ocupado}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245a42] disabled:opacity-60"
            >
              {ocupado ? 'Publicando...' : 'Publicar fragmento'}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={ocupado}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1A1A1A]/10 bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] transition-colors hover:bg-[#F8F5F0] disabled:opacity-60"
            >
              Elegir otro video
            </button>
            <button
              type="button"
              onClick={limpiarPendiente}
              disabled={ocupado}
              className="inline-flex items-center gap-2 rounded-xl border border-[#C0392B]/25 bg-[#C0392B]/5 px-4 py-2.5 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-[#C0392B]/10 disabled:opacity-60"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
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
          </>
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
        Puedes subir un video mas largo y seleccionar un fragmento de hasta 45 segundos.
        La plataforma publica ese tramo optimizado.
      </p>

      {error && (
        <p role="alert" className="text-sm text-[#C0392B]">
          {error}
        </p>
      )}
    </div>
  )
}
