'use client'

import { useState, useRef, useEffect } from 'react'

interface RecortadorVideoModalProps {
  archivo: File
  duracionMaxima?: number
  onConfirmar: (recorte: { inicioSegundos: number; finSegundos: number }) => void
  onCancelar: () => void
}

export default function RecortadorVideoModal({
  archivo,
  duracionMaxima = 45,
  onConfirmar,
  onCancelar,
}: RecortadorVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string>(() => (archivo ? URL.createObjectURL(archivo) : ''))
  const [duracionTotal, setDuracionTotal] = useState<number>(0)

  const [inicio, setInicio] = useState<number>(0)
  const [fin, setFin] = useState<number>(duracionMaxima)

  useEffect(() => {
    if (!archivo) return
    const url = URL.createObjectURL(archivo)
    setVideoUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [archivo])

  function handleLoadedMetadata() {
    if (videoRef.current) {
      const dur = Math.floor(videoRef.current.duration) || 0
      setDuracionTotal(dur)
      const durInicial = Math.min(dur, duracionMaxima)
      setInicio(0)
      setFin(durInicial)
    }
  }

  const duracionSeleccionada = Math.max(0, fin - inicio)
  const esValido = duracionSeleccionada > 0 && duracionSeleccionada <= duracionMaxima

  function handleInicioChange(v: number) {
    const nuevoInicio = Math.min(v, duracionTotal - 1)
    setInicio(nuevoInicio)
    if (fin - nuevoInicio > duracionMaxima) {
      setFin(Math.min(duracionTotal, nuevoInicio + duracionMaxima))
    } else if (fin <= nuevoInicio) {
      setFin(Math.min(duracionTotal, nuevoInicio + 5))
    }
    if (videoRef.current) {
      videoRef.current.currentTime = nuevoInicio
    }
  }

  function handleFinChange(v: number) {
    const nuevoFin = Math.max(v, inicio + 1)
    setFin(nuevoFin)
    if (nuevoFin - inicio > duracionMaxima) {
      setInicio(Math.max(0, nuevoFin - duracionMaxima))
    }
    if (videoRef.current) {
      videoRef.current.currentTime = nuevoFin
    }
  }

  function formatearTiempo(seg: number) {
    const m = Math.floor(seg / 60)
    const s = Math.floor(seg % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-white font-sans">
      <div className="w-full max-w-lg bg-[#18191A] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✂️</span>
            <h3 className="font-bold text-lg text-white">Recortar Fragmento de Video</h3>
          </div>
          <button
            onClick={onCancelar}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-300">
          Tu video dura <strong className="text-amber-300">{formatearTiempo(duracionTotal)}</strong>. Selecciona el fragmento continuo de máximo <strong className="text-emerald-400">{duracionMaxima} segundos</strong> que deseas subir a la Vitrina:
        </p>

        {/* Reproductor de Vista Previa */}
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/15 shadow-inner flex items-center justify-center">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={handleLoadedMetadata}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-xs text-gray-400">Cargando vista previa de video...</div>
          )}
        </div>

        {/* Controles del Trimmer */}
        <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-gray-300">Fragmento a publicar:</span>
            <span className={esValido ? 'text-emerald-400' : 'text-rose-400'}>
              {duracionSeleccionada}s / máx {duracionMaxima}s
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Punto de Inicio</span>
                <span className="font-mono text-amber-300">{formatearTiempo(inicio)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duracionTotal}
                value={inicio}
                onChange={(e) => handleInicioChange(Number(e.target.value))}
                className="w-full accent-[#2D6A4F] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Punto de Fin</span>
                <span className="font-mono text-amber-300">{formatearTiempo(fin)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duracionTotal}
                value={fin}
                onChange={(e) => handleFinChange(Number(e.target.value))}
                className="w-full accent-[#2D6A4F] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancelar}
            className="px-5 py-2.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar({ inicioSegundos: inicio, finSegundos: fin })}
            disabled={!esValido}
            className="px-6 py-2.5 rounded-full text-xs font-extrabold bg-[#2D6A4F] hover:bg-[#1B4332] text-white shadow-lg transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <span>✂️</span>
            <span>Recortar y Subir Video</span>
          </button>
        </div>
      </div>
    </div>
  )
}
