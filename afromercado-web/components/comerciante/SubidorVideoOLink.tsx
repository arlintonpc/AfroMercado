'use client'

import { useState } from 'react'
import SubidorVideo from './SubidorVideo'
import ReproductorVideo from './ReproductorVideo'
import type { VideoMetaCaptura, VideoEstado } from './api'

interface Props {
  estadoInicial: VideoEstado & { esLink?: boolean }
  onSubir: (file: File, meta: VideoMetaCaptura) => Promise<VideoEstado>
  onEliminar: () => Promise<VideoEstado>
  onGuardarLink: (url: string) => Promise<VideoEstado>
  titulo?: string
  compacto?: boolean
}

type Modo = 'link' | 'subir'

function esLinkExterno(url: string | null | undefined): boolean {
  if (!url) return false
  return url.startsWith('http') && !url.includes('cloudinary.com') && !url.includes('res.cloudinary')
}

export default function SubidorVideoOLink({ estadoInicial, onSubir, onEliminar, onGuardarLink, titulo = 'Video', compacto = false }: Props) {
  const inicialEsLink = esLinkExterno(estadoInicial.videoUrl)
  const [modo, setModo] = useState<Modo>(inicialEsLink ? 'link' : 'subir')
  const [linkInput, setLinkInput] = useState(inicialEsLink ? (estadoInicial.videoUrl ?? '') : '')
  const [videoGuardado, setVideoGuardado] = useState<string | null>(inicialEsLink ? (estadoInicial.videoUrl ?? null) : null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGuardarLink() {
    const url = linkInput.trim()
    if (!url) return
    try {
      setGuardando(true)
      setError(null)
      await onGuardarLink(url)
      setVideoGuardado(url)
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminarLink() {
    try {
      setGuardando(true)
      await onEliminar()
      setVideoGuardado(null)
      setLinkInput('')
    } catch {}
    finally { setGuardando(false) }
  }

  return (
    <div className="space-y-4">
      {/* Selector de modo */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden">
        <button type="button" onClick={() => setModo('link')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${modo === 'link' ? 'bg-[#1B4332] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          🔗 Tengo link de redes
        </button>
        <button type="button" onClick={() => setModo('subir')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${modo === 'subir' ? 'bg-[#1B4332] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          ⬆️ Subir mi video
        </button>
      </div>

      {modo === 'link' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Pega el link de YouTube, Facebook, TikTok, Vimeo o Instagram.</p>
          {videoGuardado ? (
            <div className="space-y-3">
              <ReproductorVideo url={videoGuardado} />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setVideoGuardado(null); setLinkInput(videoGuardado) }}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  Cambiar link
                </button>
                <button type="button" onClick={handleEliminarLink} disabled={guardando}
                  className="flex-1 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Quitar video
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input type="url" value={linkInput} onChange={e => { setLinkInput(e.target.value); setError(null) }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="button" onClick={handleGuardarLink} disabled={!linkInput.trim() || guardando}
                className="w-full py-2.5 rounded-xl bg-[#2D6A4F] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#1B4332] transition-colors">
                {guardando ? 'Guardando…' : 'Guardar link'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <SubidorVideo
          titulo={titulo}
          descripcion="Sube un clip de hasta 45 segundos. Si el video es más largo, elige el fragmento que quieres mostrar."
          estadoInicial={esLinkExterno(estadoInicial.videoUrl) ? { videoUrl: null, videoPosterUrl: null, videoDuracionSegundos: null, videoMimeType: null } : estadoInicial}
          onSubir={onSubir}
          onEliminar={onEliminar}
          compacto={compacto}
          ocultarEncabezado={compacto}
        />
      )}
    </div>
  )
}
