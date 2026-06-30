import ReproductorVideo from '@/components/comerciante/ReproductorVideo'

interface VideoDestacadoProps {
  titulo: string
  descripcion?: string
  src: string
  poster?: string | null
  duracionSegundos?: number | null
  mimeType?: string | null
  className?: string
}

function formatearDuracion(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return ''
  const total = Math.max(0, Math.round(segundos))
  const min = Math.floor(total / 60)
  const seg = String(total % 60).padStart(2, '0')
  return `${min}:${seg}`
}

function esLinkExterno(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace('www.', '')
    return ['youtube.com','youtu.be','vimeo.com','facebook.com','fb.watch','tiktok.com','instagram.com'].includes(h)
  } catch { return false }
}

export default function VideoDestacado({
  titulo,
  descripcion,
  src,
  poster,
  duracionSegundos,
  mimeType,
  className = '',
}: VideoDestacadoProps) {
  const externo = esLinkExterno(src)

  return (
    <section className={['rounded-3xl border border-[#1A1A1A]/8 bg-white p-4 shadow-sm', className].join(' ')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#2D6A4F]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2D6A4F]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Video
          </p>
          <h3 className="mt-2 text-base font-bold text-[#1A1A1A]">{titulo}</h3>
          {descripcion && (
            <p className="mt-1 text-sm text-[#1A1A1A]/60 leading-relaxed">{descripcion}</p>
          )}
        </div>
        {!externo && duracionSegundos != null && (
          <span className="flex-shrink-0 rounded-full bg-[#1A1A1A]/5 px-3 py-1 text-xs font-semibold text-[#1A1A1A]/70">
            {formatearDuracion(duracionSegundos)}
          </span>
        )}
      </div>

      {externo ? (
        <ReproductorVideo url={src} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-black">
          <video
            className="block w-full max-h-[520px] aspect-video object-contain bg-black"
            controls
            playsInline
            preload="metadata"
            poster={poster ?? undefined}
          >
            <source src={src} type={mimeType ?? undefined} />
            Tu navegador no soporta el reproductor de video.
          </video>
        </div>
      )}
    </section>
  )
}
