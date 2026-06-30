'use client'

interface Props {
  url: string
  className?: string
}

type Plataforma = 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'vimeo' | 'directo'

function detectar(url: string): { plataforma: Plataforma; embedUrl: string | null } {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')

    // YouTube
    if (host === 'youtube.com' || host === 'youtu.be') {
      let vid = ''
      if (host === 'youtu.be') vid = u.pathname.slice(1)
      else vid = u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? ''
      if (vid) return { plataforma: 'youtube', embedUrl: `https://www.youtube.com/embed/${vid}?rel=0` }
    }

    // Vimeo
    if (host === 'vimeo.com') {
      const vid = u.pathname.slice(1)
      if (vid) return { plataforma: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vid}` }
    }

    // Facebook
    if (host === 'facebook.com' || host === 'fb.watch') {
      const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&width=500&show_text=false`
      return { plataforma: 'facebook', embedUrl }
    }

    // TikTok
    if (host === 'tiktok.com') {
      const match = url.match(/\/video\/(\d+)/)
      if (match) return { plataforma: 'tiktok', embedUrl: `https://www.tiktok.com/embed/${match[1]}` }
    }

    // Instagram (no permite embed anónimo, mostramos link)
    if (host === 'instagram.com') {
      return { plataforma: 'instagram', embedUrl: null }
    }

    return { plataforma: 'directo', embedUrl: null }
  } catch {
    return { plataforma: 'directo', embedUrl: null }
  }
}

const ICONOS: Record<Plataforma, string> = {
  youtube: '▶️ YouTube', facebook: '📘 Facebook', instagram: '📸 Instagram',
  tiktok: '🎵 TikTok', vimeo: '🎬 Vimeo', directo: '🎥 Video',
}

export default function ReproductorVideo({ url, className = '' }: Props) {
  const { plataforma, embedUrl } = detectar(url)

  if (plataforma === 'directo') {
    return (
      <video src={url} controls playsInline className={`w-full rounded-2xl bg-black ${className}`}
        style={{ maxHeight: 360 }} />
    )
  }

  if (plataforma === 'instagram' || !embedUrl) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className={`flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-semibold py-10 ${className}`}>
        <span className="text-2xl">📸</span>
        <span>Ver en Instagram</span>
      </a>
    )
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}
      style={{ paddingBottom: plataforma === 'tiktok' ? '177%' : '56.25%' }}>
      <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen frameBorder="0" title={ICONOS[plataforma]} />
    </div>
  )
}
