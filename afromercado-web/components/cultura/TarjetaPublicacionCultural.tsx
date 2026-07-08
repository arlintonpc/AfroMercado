'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { toggleLikePublicacion, type PublicacionCultural } from '@/lib/api/cultura'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'

function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000)
  if (minutos < 60) return 'Hace un momento'
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Hace ${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `Hace ${dias}d`
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Cierra un menú desplegable al hacer clic fuera de su contenedor. */
function useCerrarAlClicFuera<T extends HTMLElement>(abierto: boolean, cerrar: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!abierto) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [abierto, cerrar])
  return ref
}

function IconoPlaySuperpuesto() {
  return (
    <span className="pointer-events-none absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
    </span>
  )
}

interface FotoCollageProps {
  url: string
  titulo: string
  className?: string
  overlay?: number
  conPlay?: boolean
  onClick: () => void
}

function FotoCollage({ url, titulo, className = '', overlay, conPlay, onClick }: FotoCollageProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ver foto de ${titulo}`}
      className={`relative overflow-hidden bg-[#1B4332] text-left ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={titulo} className="h-full w-full object-cover" />
      {conPlay && <IconoPlaySuperpuesto />}
      {!!overlay && overlay > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
          +{overlay}
        </div>
      )}
    </button>
  )
}

interface ColageMediaProps {
  fotoUrls: string[]
  videoUrl?: string | null
  titulo: string
  onAbrir: (indice: number) => void
}

/** Collage tipo Facebook: el layout cambia según cuántas fotos hay (1 a 5+, con "+N" si sobran).
 *  Cada miniatura abre el lightbox en su propio índice, no siempre en la primera foto. */
function ColageMedia({ fotoUrls, videoUrl, titulo, onAbrir }: ColageMediaProps) {
  const total = fotoUrls.length
  const conVideo = !!videoUrl

  if (total === 0) {
    if (!conVideo) return null
    return (
      <div className="overflow-hidden rounded-xl">
        <ReproductorVideo url={videoUrl as string} />
      </div>
    )
  }

  let contenido: ReactNode
  if (total === 1) {
    contenido = <FotoCollage url={fotoUrls[0]} titulo={titulo} className="aspect-video w-full rounded-xl" conPlay={conVideo} onClick={() => onAbrir(0)} />
  } else if (total === 2) {
    contenido = (
      <div className="grid h-[240px] grid-cols-2 gap-1 overflow-hidden rounded-xl">
        <FotoCollage url={fotoUrls[0]} titulo={titulo} className="h-full" conPlay={conVideo} onClick={() => onAbrir(0)} />
        <FotoCollage url={fotoUrls[1]} titulo={titulo} className="h-full" onClick={() => onAbrir(1)} />
      </div>
    )
  } else if (total === 3) {
    contenido = (
      <div className="flex h-[280px] gap-1 overflow-hidden rounded-xl">
        <FotoCollage url={fotoUrls[0]} titulo={titulo} className="h-full flex-1" conPlay={conVideo} onClick={() => onAbrir(0)} />
        <div className="flex flex-1 flex-col gap-1">
          <FotoCollage url={fotoUrls[1]} titulo={titulo} className="flex-1" onClick={() => onAbrir(1)} />
          <FotoCollage url={fotoUrls[2]} titulo={titulo} className="flex-1" onClick={() => onAbrir(2)} />
        </div>
      </div>
    )
  } else if (total === 4) {
    contenido = (
      <div className="grid h-[300px] grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl">
        {fotoUrls.map((url, i) => (
          <FotoCollage key={url + i} url={url} titulo={titulo} className="h-full w-full" conPlay={conVideo && i === 0} onClick={() => onAbrir(i)} />
        ))}
      </div>
    )
  } else {
    // 5 o 6+ fotos: 2 arriba (mitad y mitad) + 3 abajo (tercios). Si sobran más de 5, la última
    // miniatura de abajo lleva un overlay "+N" con el resto que no cabe en el collage.
    const arriba = fotoUrls.slice(0, 2)
    const abajo = fotoUrls.slice(2, 5)
    const restante = total > 5 ? total - 4 : 0
    contenido = (
      <div className="flex h-[300px] flex-col gap-1 overflow-hidden rounded-xl">
        <div className="flex flex-1 gap-1">
          {arriba.map((url, i) => (
            <FotoCollage key={url + i} url={url} titulo={titulo} className="h-full flex-1" conPlay={conVideo && i === 0} onClick={() => onAbrir(i)} />
          ))}
        </div>
        <div className="flex flex-1 gap-1">
          {abajo.map((url, i) => (
            <FotoCollage
              key={url + i}
              url={url}
              titulo={titulo}
              className="h-full flex-1"
              overlay={i === abajo.length - 1 ? restante : undefined}
              onClick={() => onAbrir(2 + i)}
            />
          ))}
        </div>
      </div>
    )
  }

  return contenido
}

interface TarjetaPublicacionCulturalProps {
  publicacion: PublicacionCultural
  onAbrir: (publicacion: PublicacionCultural, indice: number) => void
  onDenunciar: (publicacionId: number) => void
}

export default function TarjetaPublicacionCultural({ publicacion, onAbrir, onDenunciar }: TarjetaPublicacionCulturalProps) {
  const { autenticado } = useAuth()
  const router = useRouter()

  const ubicacion = [publicacion.municipio, publicacion.departamento].filter(Boolean).join(', ') || 'Chocó'
  const inicial = publicacion.autor?.nombre?.[0]?.toUpperCase() || '?'

  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useCerrarAlClicFuera<HTMLDivElement>(menuAbierto, () => setMenuAbierto(false))

  const [compartirAbierto, setCompartirAbierto] = useState(false)
  const compartirRef = useCerrarAlClicFuera<HTMLDivElement>(compartirAbierto, () => setCompartirAbierto(false))
  const [copiado, setCopiado] = useState(false)

  const [meGusta, setMeGusta] = useState(publicacion.meGusta)
  const [totalLikes, setTotalLikes] = useState(publicacion.totalLikes)
  const [enVueloLike, setEnVueloLike] = useState(false)

  async function manejarLike() {
    if (!autenticado) {
      router.push(`/ingresar?redirect=${encodeURIComponent('/cultura/galeria')}`)
      return
    }
    if (enVueloLike) return
    const anteriorMeGusta = meGusta
    const anteriorTotal = totalLikes
    const optimista = !anteriorMeGusta
    setMeGusta(optimista)
    setTotalLikes(anteriorTotal + (optimista ? 1 : -1))
    setEnVueloLike(true)
    try {
      const r = await toggleLikePublicacion(publicacion.id)
      setMeGusta(r.meGusta)
      setTotalLikes(r.totalLikes)
    } catch {
      setMeGusta(anteriorMeGusta)
      setTotalLikes(anteriorTotal)
    } finally {
      setEnVueloLike(false)
    }
  }

  async function copiarEnlace() {
    const url = `${window.location.origin}/cultura/galeria`
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard no disponible
    }
  }

  const urlGaleria = typeof window !== 'undefined' ? `${window.location.origin}/cultura/galeria` : 'https://afromercado.vercel.app/cultura/galeria'
  const textoWhatsapp = `Mira esta historia en AfroMercado: "${publicacion.titulo}" — ${urlGaleria}`

  return (
    <article className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1B4332] text-sm font-bold text-white">
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1A1A1A]">{publicacion.autor?.nombre || 'Un vecino'}</p>
            <p className="truncate text-xs text-[#1A1A1A]/55">{ubicacion} · {fechaCorta(publicacion.createdAt)}</p>
          </div>
        </div>

        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label="Más opciones"
            aria-expanded={menuAbierto}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#1A1A1A]/50 transition hover:bg-[#F8F5F0] hover:text-[#1A1A1A]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menuAbierto && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-[#1A1A1A]/10 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => { setMenuAbierto(false); onDenunciar(publicacion.id) }}
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[#C0392B] hover:bg-[#C0392B]/8"
              >
                Denunciar publicación
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className="font-serif text-base font-semibold text-[#1A1A1A]">{publicacion.titulo}</p>
        {publicacion.descripcion && (
          <p className="mt-1 whitespace-pre-line text-sm text-[#1A1A1A]/75">{publicacion.descripcion}</p>
        )}
      </div>

      {(publicacion.fotoUrls.length > 0 || publicacion.videoUrl) && (
        <div className="px-4 pb-3">
          <ColageMedia
            fotoUrls={publicacion.fotoUrls}
            videoUrl={publicacion.videoUrl}
            titulo={publicacion.titulo}
            onAbrir={(indice) => onAbrir(publicacion, indice)}
          />
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-[#1A1A1A]/8 px-2 py-1.5">
        <button
          type="button"
          onClick={manejarLike}
          aria-pressed={meGusta}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-[#F8F5F0] ${
            meGusta ? 'text-[#C0392B]' : 'text-[#1A1A1A]/65'
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={meGusta ? '#C0392B' : 'none'}
            stroke={meGusta ? '#C0392B' : 'currentColor'}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Me gusta{totalLikes > 0 ? ` · ${totalLikes}` : ''}
        </button>

        <div ref={compartirRef} className="relative flex-1">
          <button
            type="button"
            onClick={() => setCompartirAbierto((v) => !v)}
            aria-expanded={compartirAbierto}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#1A1A1A]/65 transition hover:bg-[#F8F5F0]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Compartir
          </button>

          {compartirAbierto && (
            <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[#1A1A1A]/10 bg-white shadow-lg">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(textoWhatsapp)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setCompartirAbierto(false)}
                className="block px-4 py-2.5 text-sm font-medium text-[#128C7E] hover:bg-[#25D366]/10"
              >
                Enviar por WhatsApp
              </a>
              <button
                type="button"
                onClick={copiarEnlace}
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[#1A1A1A]/75 hover:bg-[#F8F5F0]"
              >
                {copiado ? '¡Copiado!' : 'Copiar enlace'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
