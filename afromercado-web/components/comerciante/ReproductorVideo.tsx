'use client'

import { useState } from 'react'

interface Props {
  url: string
  className?: string
}

type Plataforma = 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'vimeo' | 'directo'

function detectar(url: string): { plataforma: Plataforma; embedUrl: string | null; videoId: string | null } {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')

    // YouTube
    if (host === 'youtube.com' || host === 'youtu.be') {
      let vid = ''
      if (host === 'youtu.be') vid = u.pathname.slice(1)
      else vid = u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? ''
      if (vid) return { plataforma: 'youtube', embedUrl: `https://www.youtube.com/embed/${vid}?rel=0&autoplay=1`, videoId: vid }
    }

    // Vimeo
    if (host === 'vimeo.com') {
      const vid = u.pathname.slice(1)
      if (vid) return { plataforma: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vid}?autoplay=1`, videoId: vid }
    }

    // Facebook
    if (host === 'facebook.com' || host === 'fb.watch') {
      const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&width=500&show_text=false&autoplay=true`
      return { plataforma: 'facebook', embedUrl, videoId: null }
    }

    // TikTok
    if (host === 'tiktok.com') {
      const match = url.match(/\/video\/(\d+)/)
      if (match) return { plataforma: 'tiktok', embedUrl: `https://www.tiktok.com/embed/${match[1]}`, videoId: match[1] }
    }

    // Instagram (no permite embed anónimo, mostramos link)
    if (host === 'instagram.com') {
      return { plataforma: 'instagram', embedUrl: null, videoId: null }
    }

    return { plataforma: 'directo', embedUrl: null, videoId: null }
  } catch {
    return { plataforma: 'directo', embedUrl: null, videoId: null }
  }
}

const ICONOS: Record<Plataforma, string> = {
  youtube: '▶️ YouTube', facebook: '📘 Facebook', instagram: '📸 Instagram',
  tiktok: '🎵 TikTok', vimeo: '🎬 Vimeo', directo: '🎥 Video',
}

function BotонPlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
        <svg viewBox="0 0 24 24" fill="#1B4332" className="w-8 h-8 ml-1">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>
  )
}

export default function ReproductorVideo({ url, className = '' }: Props) {
  const [activado, setActivado] = useState(false)
  const { plataforma, embedUrl, videoId } = detectar(url)

  // Videos directos de Cloudinary u otros: usar <video> nativa, sin lazy loading necesario
  if (plataforma === 'directo') {
    return (
      <video src={url} controls playsInline className={`w-full rounded-2xl bg-black ${className}`}
        style={{ maxHeight: 360 }} />
    )
  }

  // Instagram: solo link externo
  if (plataforma === 'instagram' || !embedUrl) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className={`flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-semibold py-10 ${className}`}>
        <span className="text-2xl">📸</span>
        <span>Ver en Instagram</span>
      </a>
    )
  }

  // Thumbnail URL según plataforma
  const thumbnailUrl = plataforma === 'youtube' && videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null

  // Antes de activar: mostrar thumbnail con botón play
  if (!activado) {
    const esTikTok = plataforma === 'tiktok'
    return (
      <div
        onClick={() => setActivado(true)}
        className={`relative w-full bg-black rounded-2xl overflow-hidden cursor-pointer group ${className}`}
        style={{ aspectRatio: esTikTok ? '9/16' : '16/9' }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Video"
            className="w-full h-full object-cover opacity-80 group-hover:opacity-90 transition-opacity"
          />
        ) : (
          /* Placeholder para plataformas sin thumbnail público */
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <span className="text-white/40 text-sm font-medium">{ICONOS[plataforma]}</span>
          </div>
        )}
        <BotонPlay />
        <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          ▶ Ver video
        </div>
      </div>
    )
  }

  // Con iframe activo
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}
      style={{ paddingBottom: plataforma === 'tiktok' ? '177%' : '56.25%' }}>
      <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen frameBorder="0" title={ICONOS[plataforma]} loading="lazy" />
    </div>
  )
}
