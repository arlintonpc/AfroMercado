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
    const nuevoInicio = Math.max(0, Math.min(v, duracionTotal - 1))
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
    const nuevoFin = Math.max(inicio + 1, Math.min(v, duracionTotal))
    setFin(nuevoFin)
    if (nuevoFin - inicio > duracionMaxima) {
      setInicio(Math.max(0, nuevoFin - duracionMaxima))
    }
    if (videoRef.current) {
      videoRef.current.currentTime = nuevoFin
    }
  }

  function marcarInicioActual() {
    if (videoRef.current) {
      const actual = Math.floor(videoRef.current.currentTime)
      handleInicioChange(actual)
    }
  }

  function marcarFinActual() {
    if (videoRef.current) {
      const actual = Math.floor(videoRef.current.currentTime)
      handleFinChange(actual)
    }
  }

  function formatearTiempo(seg: number) {
    const m = Math.floor(seg / 60)
    const s = Math.floor(seg % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // Componente auxiliar para min:seg
  const inicioMin = Math.floor(inicio / 60)
  const inicioSeg = Math.floor(inicio % 60)
  const finMin = Math.floor(fin / 60)
  const finSeg = Math.floor(fin % 60)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 text-white font-sans overflow-y-auto">
      <div className="w-full max-w-lg bg-[#18191A] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 my-auto">
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
          Tu video dura <strong className="text-amber-300">{formatearTiempo(duracionTotal)}</strong>. Elige el minuto y segundo de inicio y fin (máximo <strong className="text-emerald-400">{duracionMaxima} segundos</strong>):
        </p>

        {/* Reproductor de Vista Previa */}
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/15 shadow-inner flex flex-col items-center justify-center">
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

        {/* Botones de Captura Rápida en Vivo */}
        <div className="flex items-center justify-between gap-2 bg-white/5 p-2.5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={marcarInicioActual}
            className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <span>📍</span>
            <span>Marcar Inicio aquí</span>
          </button>
          <button
            type="button"
            onClick={marcarFinActual}
            className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <span>🏁</span>
            <span>Marcar Fin aquí</span>
          </button>
        </div>

        {/* Controles del Trimmer (Campos Minuto:Segundo + Sliders) */}
        <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-gray-300">Duración elegida:</span>
            <span className={esValido ? 'text-emerald-400 text-sm font-mono' : 'text-rose-400 text-sm font-mono'}>
              {duracionSeleccionada}s / máx {duracionMaxima}s
            </span>
          </div>

          {/* Campo Punto de Inicio */}
          <div className="space-y-2 border-b border-white/10 pb-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <span>📍 Punto de Inicio</span>
              </label>
              {/* Escribir Minutos : Segundos directamente */}
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  min={0}
                  max={Math.floor(duracionTotal / 60)}
                  value={inicioMin}
                  onChange={(e) => handleInicioChange(Number(e.target.value) * 60 + inicioSeg)}
                  className="w-12 bg-black/60 border border-white/20 rounded-md px-1.5 py-1 text-center font-mono text-amber-300 text-xs outline-none focus:border-amber-400"
                />
                <span className="text-gray-400 font-bold">m</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={inicioSeg}
                  onChange={(e) => handleInicioChange(inicioMin * 60 + Number(e.target.value))}
                  className="w-12 bg-black/60 border border-white/20 rounded-md px-1.5 py-1 text-center font-mono text-amber-300 text-xs outline-none focus:border-amber-400"
                />
                <span className="text-gray-400 font-bold">s</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={duracionTotal}
              value={inicio}
              onChange={(e) => handleInicioChange(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Campo Punto de Fin */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <span>🏁 Punto de Fin</span>
              </label>
              {/* Escribir Minutos : Segundos directamente */}
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  min={0}
                  max={Math.floor(duracionTotal / 60)}
                  value={finMin}
                  onChange={(e) => handleFinChange(Number(e.target.value) * 60 + finSeg)}
                  className="w-12 bg-black/60 border border-white/20 rounded-md px-1.5 py-1 text-center font-mono text-emerald-300 text-xs outline-none focus:border-emerald-400"
                />
                <span className="text-gray-400 font-bold">m</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={finSeg}
                  onChange={(e) => handleFinChange(finMin * 60 + Number(e.target.value))}
                  className="w-12 bg-black/60 border border-white/20 rounded-md px-1.5 py-1 text-center font-mono text-emerald-300 text-xs outline-none focus:border-emerald-400"
                />
                <span className="text-gray-400 font-bold">s</span>
              </div>
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
            <span>Recortar ({formatearTiempo(inicio)} ➔ {formatearTiempo(fin)}) y Subir</span>
          </button>
        </div>
      </div>
    </div>
  )
}
