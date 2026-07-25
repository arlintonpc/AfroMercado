'use client'

import React, { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { crearHistoria, subirFotoHistoria, subirVideoHistoria, type TipoMediaHistoria } from '@/lib/api/cultura'
import RecortadorVideoModal from '@/components/comerciante/RecortadorVideoModal'

interface ModalCrearHistoriaProps {
  isOpen: boolean
  onClose: () => void
  onHistoriaCreada: () => void
}

const COLORES_FONDO = [
  '#1B4332', // Verde Selva Chocó
  '#2D6A4F', // Verde Medio
  '#D4A017', // Dorado Pacífico
  '#18191A', // Oscuro Noche
  '#7209B7', // Violeta Cultura
  '#C1121F', // Rojo Pasión
]

export default function ModalCrearHistoria({
  isOpen,
  onClose,
  onHistoriaCreada,
}: ModalCrearHistoriaProps) {
  const { usuario } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaTipo, setMediaTipo] = useState<TipoMediaHistoria>('FOTO')
  const [duracion, setDuracion] = useState<number>(5)
  const [texto, setTexto] = useState<string>('')
  const [fondoColor, setFondoColor] = useState<string>('#1B4332')
  const [esComercio, setEsComercio] = useState<boolean>(usuario?.rol === 'COMERCIANTE')

  const [subiendoMedia, setSubiendoMedia] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recortador de video
  const [archivoVideoRecortar, setArchivoVideoRecortar] = useState<File | null>(null)

  if (!isOpen) return null

  async function handleSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const esVideo = file.type.startsWith('video/')
    if (esVideo) {
      // Verificar si requiere recorte (> 15s)
      const tempVideo = document.createElement('video')
      tempVideo.preload = 'metadata'
      tempVideo.src = URL.createObjectURL(file)
      tempVideo.onloadedmetadata = () => {
        URL.revokeObjectURL(tempVideo.src)
        if (tempVideo.duration > 15) {
          setArchivoVideoRecortar(file)
        } else {
          ejecutarSubidaVideo(file)
        }
      }
      tempVideo.onerror = () => ejecutarSubidaVideo(file)
    } else {
      // Es foto
      setSubiendoMedia(true)
      try {
        const res = await subirFotoHistoria(file)
        setMediaUrl(res.url)
        setMediaTipo('FOTO')
        setDuracion(5)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo subir la foto.')
      } finally {
        setSubiendoMedia(false)
      }
    }
    e.target.value = ''
  }

  async function ejecutarSubidaVideo(file: File, recorte?: { inicioSegundos: number; finSegundos: number }) {
    setSubiendoMedia(true)
    setError(null)
    try {
      const res = await subirVideoHistoria(file, recorte)
      setMediaUrl(res.url)
      setMediaTipo('VIDEO')
      const dur = recorte ? Math.max(5, Math.min(15, recorte.finSegundos - recorte.inicioSegundos)) : 15
      setDuracion(dur)
      setArchivoVideoRecortar(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo subir el video.'
      setError(msg)
      throw new Error(msg)
    } finally {
      setSubiendoMedia(false)
    }
  }

  async function handlePublicar(e: React.FormEvent) {
    e.preventDefault()
    if (!mediaUrl) {
      setError('Debes subir una foto o video para tu historia.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await crearHistoria({
        mediaUrl,
        mediaTipo,
        duracionSegundos: duracion,
        texto: texto.trim() || undefined,
        fondoColor,
        esComercio: usuario?.rol === 'COMERCIANTE' ? esComercio : false,
      })
      onHistoriaCreada()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al publicar la historia.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 text-white font-sans overflow-y-auto">
        <div className="w-full max-w-lg bg-[#18191A] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 my-auto">
          {/* Encabezado */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h3 className="font-bold text-lg text-white">Crear Historia Efímera (24h)</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-gray-300">
            Tu historia estará visible durante <strong className="text-amber-300">24 horas</strong> para toda la comunidad y desaparecerá automáticamente.
          </p>

          {/* Vista Previa de la Historia */}
          <div
            className="relative w-full aspect-[9/14] max-h-[400px] rounded-2xl overflow-hidden border border-white/20 flex items-center justify-center shadow-inner transition-colors"
            style={{ backgroundColor: mediaUrl ? '#000' : fondoColor }}
          >
            {mediaUrl ? (
              mediaTipo === 'VIDEO' ? (
                <video src={mediaUrl} controls autoPlay loop muted className="w-full h-full object-cover" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaUrl} alt="Vista previa" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="text-center p-6 space-y-3">
                <span className="text-4xl">📸</span>
                <p className="text-sm font-semibold text-gray-200">Sube una foto o video para tu historia</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={subiendoMedia}
                  className="px-5 py-2.5 rounded-full bg-[#D4A017] hover:bg-[#b58813] text-[#1A1A1A] text-xs font-bold transition shadow-lg flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  {subiendoMedia ? 'Subiendo media...' : 'Elegir Foto / Video'}
                </button>
              </div>
            )}

            {/* Texto Superpuesto */}
            {texto && (
              <div className="absolute inset-x-4 bottom-8 bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/20 text-center">
                <p className="text-sm font-bold text-white drop-shadow-md leading-snug">{texto}</p>
              </div>
            )}

            {mediaUrl && (
              <button
                type="button"
                onClick={() => setMediaUrl(null)}
                className="absolute top-3 right-3 bg-black/70 text-white rounded-full p-2 hover:bg-rose-600 transition"
                title="Cambiar archivo"
              >
                ✕
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleSeleccionarArchivo}
          />

          {/* Opciones de Personalización */}
          <form onSubmit={handlePublicar} className="space-y-4">
            {/* Texto Superpuesto */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300">Mensaje o Leyenda (Opcional)</label>
              <input
                type="text"
                maxLength={250}
                placeholder="Escribe un mensaje para tu historia..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>

            {/* Paleta de Colores de Fondo (Solo si no hay media) */}
            {!mediaUrl && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">Color de Fondo Regional</label>
                <div className="flex items-center gap-3">
                  {COLORES_FONDO.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFondoColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${fondoColor === c ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-75 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Publicar como Comercio si aplica */}
            {usuario?.rol === 'COMERCIANTE' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="esComercioCheck"
                  checked={esComercio}
                  onChange={(e) => setEsComercio(e.target.checked)}
                  className="accent-[#D4A017] w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="esComercioCheck" className="text-xs text-amber-300 font-semibold cursor-pointer">
                  Publicar en nombre de mi tienda ({usuario.nombre})
                </label>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold animate-in fade-in">
                ⚠️ {error}
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="px-5 py-2.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!mediaUrl || guardando || subiendoMedia}
                className="px-6 py-2.5 rounded-full text-xs font-extrabold bg-[#2D6A4F] hover:bg-[#1B4332] text-white shadow-lg transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {guardando ? 'Publicando...' : '✨ Publicar Historia (24h)'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Recortador de Video si supera los 15s */}
      {archivoVideoRecortar && (
        <RecortadorVideoModal
          archivo={archivoVideoRecortar}
          duracionMaxima={15}
          onConfirmar={async (recorte) => {
            await ejecutarSubidaVideo(archivoVideoRecortar, recorte)
          }}
          onCancelar={() => setArchivoVideoRecortar(null)}
        />
      )}
    </>
  )
}
