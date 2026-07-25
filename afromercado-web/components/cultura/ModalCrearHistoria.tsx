'use client'

import React, { useEffect, useRef, useState } from 'react'
import { crearHistoria, subirFotoHistoria, subirVideoHistoria, type TipoMediaHistoria } from '@/lib/api/cultura'
import RecortadorVideoModal from '@/components/comerciante/RecortadorVideoModal'

interface ModalCrearHistoriaProps {
  isOpen: boolean
  onClose: () => void
  onHistoriaCreada: () => void
  nombreComercio?: string | null
}

interface MediaHistoriaBorrador {
  url: string
  tipo: TipoMediaHistoria
  duracion: number
}

const MAX_MEDIAS_POR_HISTORIA = 10

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
  nombreComercio,
}: ModalCrearHistoriaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [medias, setMedias] = useState<MediaHistoriaBorrador[]>([])
  const [indiceVista, setIndiceVista] = useState(0)
  const [texto, setTexto] = useState<string>('')
  const [fondoColor, setFondoColor] = useState<string>('#1B4332')

  const [subiendoMedia, setSubiendoMedia] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recortador de video
  const [archivoVideoRecortar, setArchivoVideoRecortar] = useState<File | null>(null)
  const mediaActual = medias[indiceVista] ?? null

  useEffect(() => {
    if (isOpen) return
    setMedias([])
    setIndiceVista(0)
    setTexto('')
    setError(null)
    setArchivoVideoRecortar(null)
  }, [isOpen])

  if (!isOpen) return null

  async function handleSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    if (archivos.length === 0) return
    if (medias.length + archivos.length > MAX_MEDIAS_POR_HISTORIA) {
      setError(`Puedes publicar hasta ${MAX_MEDIAS_POR_HISTORIA} fotos o videos por secuencia.`)
      e.target.value = ''
      return
    }
    setError(null)
    e.target.value = ''

    setSubiendoMedia(true)
    try {
      for (const file of archivos) {
        if (file.type.startsWith('video/')) {
          await ejecutarSubidaVideo(file)
        } else if (file.type.startsWith('image/')) {
          const res = await subirFotoHistoria(file)
          setMedias((actuales) => [...actuales, { url: res.url, tipo: 'FOTO', duracion: 5 }])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron subir todos los archivos.')
    } finally {
      setSubiendoMedia(false)
    }
  }

  async function ejecutarSubidaVideo(file: File, recorte?: { inicioSegundos: number; finSegundos: number }) {
    setError(null)
    try {
      const res = await subirVideoHistoria(file, recorte)
      const dur = recorte ? Math.max(5, Math.min(15, recorte.finSegundos - recorte.inicioSegundos)) : 15
      setMedias((actuales) => [...actuales, { url: res.url, tipo: 'VIDEO', duracion: dur }])
      setArchivoVideoRecortar(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo subir el video.'
      setError(msg)
      throw new Error(msg)
    }
  }

  async function handlePublicar(e: React.FormEvent) {
    e.preventDefault()
    if (medias.length === 0) {
      setError('Debes subir al menos una foto o video para tu historia.')
      return
    }
    setGuardando(true)
    setError(null)
    let publicadas = 0
    try {
      for (const media of medias) {
        await crearHistoria({
          mediaUrl: media.url,
          mediaTipo: media.tipo,
          duracionSegundos: media.duracion,
          texto: texto.trim() || undefined,
          fondoColor,
          esComercio: true,
        })
        publicadas += 1
      }
      onHistoriaCreada()
      onClose()
    } catch (err) {
      const avance = publicadas > 0 ? `Se publicaron ${publicadas} de ${medias.length} historias. ` : ''
      setError(err instanceof Error ? `${avance}${err.message}` : `${avance}No se pudo publicar la secuencia completa.`)
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
            style={{ backgroundColor: mediaActual ? '#000' : fondoColor }}
          >
            {mediaActual ? (
              mediaActual.tipo === 'VIDEO' ? (
                <video src={mediaActual.url} controls autoPlay loop muted className="w-full h-full object-cover" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaActual.url} alt="Vista previa" className="w-full h-full object-cover" />
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

            {mediaActual && (
              <button
                type="button"
                onClick={() => {
                  setMedias((actuales) => actuales.filter((_, indice) => indice !== indiceVista))
                  setIndiceVista((indice) => Math.max(0, indice - 1))
                }}
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
            multiple
            className="hidden"
            onChange={handleSeleccionarArchivo}
          />

          {/* Opciones de Personalización */}
          {medias.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span className="font-bold">Secuencia ({medias.length}/{MAX_MEDIAS_POR_HISTORIA})</span>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-amber-300 font-bold hover:underline">Agregar archivos</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {medias.map((media, indice) => (
                  <button key={`${media.url}-${indice}`} type="button" onClick={() => setIndiceVista(indice)} className={`relative h-14 w-11 flex-shrink-0 overflow-hidden rounded-lg border-2 ${indice === indiceVista ? 'border-amber-300' : 'border-white/20'}`} aria-label={`Ver historia ${indice + 1}`}>
                    {media.tipo === 'VIDEO' ? <span className="absolute inset-0 grid place-items-center bg-[#1B4332] text-white text-[10px]">Video</span> : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={media.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

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
            {!mediaActual && (
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

            <p className="text-xs font-semibold text-amber-300">
              Se publicará en nombre de {nombreComercio || 'tu tienda'}.
            </p>

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
                disabled={medias.length === 0 || guardando || subiendoMedia}
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
