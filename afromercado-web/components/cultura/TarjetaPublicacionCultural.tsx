'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useVitrinaAudio } from '@/context/VitrinaAudioContext'
import { toggleLikePublicacion, toggleFavoritoPublicacionCultural, registrarVistaPublicacion, registrarCompartidoPublicacion, type PublicacionCultural } from '@/lib/api/cultura'
import ModalComentarios from './ModalComentarios'
import { toggleSeguirComercio } from '@/lib/api/comercios'
import { toggleSeguirUsuario } from '@/lib/api/usuarios'
import ReproductorVideo, { detectar } from '@/components/comerciante/ReproductorVideo'
import { ModalCompartir } from './ModalCompartir'

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

/** Mismo criterio de detección de plataforma que ReproductorVideo.tsx (no exportado ahí),
 *  duplicado a propósito: solo necesitamos saber si es un archivo propio (Cloudinary/mp4)
 *  para decidir si podemos usar <video autoPlay muted loop> como fondo del cuadro inmersivo,
 *  o si es un link externo (YouTube/TikTok/etc.) que debe abrir en el lightbox existente. */
function esVideoDirecto(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    return !['youtube.com', 'youtu.be', 'vimeo.com', 'facebook.com', 'fb.watch', 'tiktok.com', 'instagram.com'].includes(host)
  } catch {
    return true
  }
}

function IconoPlaySuperpuesto() {
  return (
    <span className="pointer-events-none absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
    </span>
  )
}

function IconoAltavoz({ silenciado }: { silenciado: boolean }) {
  return silenciado ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M4 9v6h4l5 5V4L8 9H4zm14.5 3a4.5 4.5 0 00-2.5-4.03v8.06A4.49 4.49 0 0018.5 12zM16 20.4l1.6-1.6a1 1 0 011.4 1.4L15.4 24 12 20.6l1.4-1.4L16 20.4zM2.1 3.51L3.51 2.1l18.39 18.39-1.41 1.41-4.24-4.24A6.96 6.96 0 0114 19.14v-2.06a5 5 0 001.61-.98L2.1 3.51z" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M4 9v6h4l5 5V4L8 9H4zm11.5 3a4.5 4.5 0 00-2.5-4.03v8.06A4.49 4.49 0 0015.5 12zM14 3.23v2.06a7 7 0 010 13.42v2.06a9 9 0 000-17.54z" /></svg>
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

/** Video propio (Cloudinary/mp4) en la tarjeta clásica: se reproduce solo,
 *  silenciado, mientras está a la vista (igual que Facebook/LinkedIn) — no
 *  se agranda ni se sale de la tarjeta. Un video de plataforma externa
 *  (YouTube, TikTok, etc.) sigue usando el ReproductorVideo genérico de clic
 *  para reproducir, porque esas no se pueden controlar de la misma forma. */
function VideoEnLineaAutoplay({ url }: { url: string }) {
  const { plataforma } = detectar(url)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [silenciado, setSilenciado] = useState(true)

  useEffect(() => {
    if (plataforma !== 'directo') return
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.6 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [plataforma])

  if (plataforma !== 'directo') {
    return <ReproductorVideo url={url} />
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        src={url}
        muted={silenciado}
        loop
        playsInline
        className="w-full rounded-2xl bg-black"
        style={{ maxHeight: 360 }}
      />
      <button
        type="button"
        onClick={() => setSilenciado((v) => !v)}
        aria-label={silenciado ? 'Activar sonido' : 'Silenciar'}
        className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
      >
        <IconoAltavoz silenciado={silenciado} />
      </button>
    </div>
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
        <VideoEnLineaAutoplay url={videoUrl as string} />
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
  /** Fuerza la tarjeta clásica (texto siempre visible arriba, media abajo)
   *  aunque haya comercio+video — usado por /vitrina para que se pueda leer
   *  todo sin necesidad de reproducir el video primero. */
  forzarClasica?: boolean
}

export default function TarjetaPublicacionCultural({ publicacion, onAbrir, onDenunciar, forzarClasica }: TarjetaPublicacionCulturalProps) {
  const { autenticado } = useAuth()
  const router = useRouter()
  const { muted, toggleMuted } = useVitrinaAudio()

  // Publicaciones de la Vitrina de video (comerciantes) traen `comercio`; las
  // de "Comparte tu Territorio" (vecinos) nunca lo traen — este único campo
  // decide la variante visual sin necesitar una prop nueva ni tocar los
  // llamadores existentes de esta tarjeta.
  const comercio = publicacion.comercio ?? null

  const ubicacion = [publicacion.municipio, publicacion.departamento].filter(Boolean).join(', ') || 'Chocó'
  const nombreMostrado = publicacion.esAnuncio ? publicacion.etiqueta || 'Patrocinado' : comercio?.nombre || publicacion.autor?.nombre || 'Un vecino'
  const inicial = publicacion.esAnuncio ? '⭐' : nombreMostrado[0]?.toUpperCase() || '?'

  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useCerrarAlClicFuera<HTMLDivElement>(menuAbierto, () => setMenuAbierto(false))

  const [compartirAbierto, setCompartirAbierto] = useState(false)
  const compartirRef = useCerrarAlClicFuera<HTMLDivElement>(compartirAbierto, () => setCompartirAbierto(false))

  const [comentariosAbierto, setComentariosAbierto] = useState(false)
  const [totalComentarios, setTotalComentarios] = useState(publicacion.totalComentarios ?? 0)
  const [totalCompartidos, setTotalCompartidos] = useState(publicacion.totalCompartidos ?? 0)

  const [meGusta, setMeGusta] = useState(publicacion.meGusta)
  const [totalLikes, setTotalLikes] = useState(publicacion.totalLikes)
  const [enVueloLike, setEnVueloLike] = useState(false)

  const [esFavorito, setEsFavorito] = useState(publicacion.esFavorito ?? false)
  const [enVueloFavorito, setEnVueloFavorito] = useState(false)

  const [siguiendo, setSiguiendo] = useState(comercio?.siguiendo ?? publicacion.autor?.siguiendo ?? false)
  const [enVueloSeguir, setEnVueloSeguir] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)

  const rutaRedirect = comercio ? '/vitrina' : '/cultura/galeria'

  async function manejarLike() {
    if (!autenticado) {
      router.push(`/ingresar?redirect=${encodeURIComponent(rutaRedirect)}`)
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

  async function manejarGuardar() {
    if (!autenticado) {
      router.push(`/ingresar?redirect=${encodeURIComponent(rutaRedirect)}`)
      return
    }
    if (enVueloFavorito) return
    const anterior = esFavorito
    setEsFavorito(!anterior)
    setEnVueloFavorito(true)
    try {
      const r = await toggleFavoritoPublicacionCultural(publicacion.id)
      setEsFavorito(r.esFavorito)
    } catch {
      setEsFavorito(anterior)
    } finally {
      setEnVueloFavorito(false)
    }
  }

  async function manejarSeguir() {
    if (!comercio && !publicacion.autor) return
    if (!autenticado) {
      router.push(`/ingresar?redirect=${encodeURIComponent(rutaRedirect)}`)
      return
    }
    if (enVueloSeguir) return
    const anterior = siguiendo
    setSiguiendo(!anterior)
    setEnVueloSeguir(true)
    try {
      const r = comercio
        ? await toggleSeguirComercio(comercio.id)
        : await toggleSeguirUsuario(publicacion.autor!.id)
      setSiguiendo(r.siguiendo)
    } catch {
      setSiguiendo(anterior)
    } finally {
      setEnVueloSeguir(false)
    }
  }

  const [reproduciendo, setReproduciendo] = useState(true)
  const tiempoVistaRef = useRef<NodeJS.Timeout | null>(null)

  const iniciarConteoVista = () => {
    if (tiempoVistaRef.current) return
    tiempoVistaRef.current = setTimeout(() => {
      const sesionId = typeof window !== 'undefined' ? window.localStorage.getItem('afromercado_sesion_id') || undefined : undefined
      registrarVistaPublicacion(publicacion.id, sesionId, 3)
    }, 3000)
  }

  const pararConteoVista = () => {
    if (tiempoVistaRef.current) {
      clearTimeout(tiempoVistaRef.current)
      tiempoVistaRef.current = null
    }
  }

  const togglePlayPausa = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
      setReproduciendo(true)
      iniciarConteoVista()
    } else {
      video.pause()
      setReproduciendo(false)
      pararConteoVista()
    }
  }

  // Reproduce/pausa el video de la tarjeta inmersiva según su visibilidad en
  // pantalla, para que solo suene/anime el que el usuario tiene enfocado.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {})
          setReproduciendo(true)
          iniciarConteoVista()
        } else {
          video.pause()
          setReproduciendo(false)
          pararConteoVista()
        }
      },
      { threshold: 0.7 }
    )
    observer.observe(video)
    return () => {
      observer.disconnect()
      pararConteoVista()
    }
    // iniciarConteoVista/pararConteoVista se recrean cada render (no son
    // useCallback) — el observer solo debe reconstruirse si cambia la
    // publicación mostrada en esta tarjeta, no en cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicacion.id])

  const urlGaleria = typeof window !== 'undefined' ? `${window.location.origin}${comercio ? `/vitrina?video=${publicacion.id}` : rutaRedirect}` : `https://afromercado.vercel.app${comercio ? `/vitrina?video=${publicacion.id}` : rutaRedirect}`

  const reportarCompartido = async () => {
    try {
      await registrarCompartidoPublicacion(publicacion.id)
      setTotalCompartidos(prev => prev + 1)
    } catch {
      // no interrumpe el flujo de compartir si falla el conteo
    }
  }

  function manejarCompartirNativo() {
    setCompartirAbierto((v) => !v)
  }

  // Botón de acción dinámico, mismo criterio que /producto/[id]: si el comercio
  // vende dentro de la plataforma, lleva a su perfil; si vende por contacto
  // directo, WhatsApp (solo si el comercio decidió mostrar su número).
  const mensajeWaComercio = comercio ? `Hola, vi tu publicación "${publicacion.titulo}" en Teravia` : ''
  const enlaceWaComercio =
    comercio && comercio.comprableEnPlataforma === false && comercio.whatsapp && comercio.whatsappVisible
      ? `https://wa.me/57${comercio.whatsapp}?text=${encodeURIComponent(mensajeWaComercio)}`
      : null

  const [cargandoVideo, setCargandoVideo] = useState(false)
  const [youtubeActivo, setYoutubeActivo] = useState(false)

  let posterUrl = publicacion.videoPosterUrl ?? undefined
  let embedUrlFinal = ''
  let esVerticalMedia = false
  let esExterna = false

  if (publicacion.videoUrl) {
    if (publicacion.videoUrl.includes('res.cloudinary.com')) {
      // Reemplaza extensión y fuerza formato jpg en Cloudinary para evitar que devuelva video/mp4
      if (!posterUrl) posterUrl = publicacion.videoUrl.replace(/\.[^/.]+$/, '.jpg').replace(/f_[^,]+/, 'f_jpg')
    } else {
      const { embedUrl, esVertical, videoId, plataforma } = detectar(publicacion.videoUrl)
      if (embedUrl) {
        embedUrlFinal = embedUrl
        esVerticalMedia = esVertical
        esExterna = true
        if (!posterUrl && plataforma === 'youtube' && videoId) {
          posterUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        }
      }
    }
  }

  // Cuadro inmersivo (formato Reels/TikTok): solo para publicaciones de la
  // Vitrina de video que traen un video propio — las de fotos siguen usando
  // el collage clásico de abajo, y "Comparte tu Territorio" no cambia.
  if (!forzarClasica && comercio && publicacion.videoUrl) {
    const directo = esVideoDirecto(publicacion.videoUrl)
    return (
      <article className="relative mx-auto h-full md:aspect-[9/16] md:max-h-[720px] w-full overflow-hidden md:rounded-2xl bg-black shadow-lg">
        {directo ? (
          <>
            <video
              ref={videoRef}
              src={publicacion.videoUrl}
              poster={posterUrl}
              className="absolute inset-0 h-full w-full object-cover cursor-pointer"
              muted={muted}
              loop
              playsInline
              onClick={togglePlayPausa}
              onWaiting={() => setCargandoVideo(true)}
              onPlaying={() => setCargandoVideo(false)}
              onCanPlay={() => setCargandoVideo(false)}
            />
            {/* Mostrar ícono de carga si el video está pausado por buffering y debería estar reproduciendo */}
            {cargandoVideo && reproduciendo && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
              </div>
            )}
            {!reproduciendo && (
              <button
                type="button"
                onClick={togglePlayPausa}
                className="absolute inset-0 flex items-center justify-center transition-all hover:bg-black/5"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="#1B4332"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 h-full w-full bg-black flex items-center justify-center">
            {!youtubeActivo ? (
              <button
                type="button"
                onClick={() => {
                  if (embedUrlFinal) {
                    setYoutubeActivo(true)
                    iniciarConteoVista()
                  } else {
                    onAbrir(publicacion, 0)
                  }
                }}
                aria-label={`Reproducir video de ${publicacion.titulo}`}
                className="absolute inset-0 block h-full w-full group z-0"
              >
                {posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl} alt={publicacion.titulo} className="h-full w-full object-cover transition-opacity" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#1B4332] to-black" />
                )}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="#1B4332"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </span>
              </button>
            ) : (
              embedUrlFinal ? (
                <iframe
                  src={embedUrlFinal}
                  className="absolute inset-0 w-full h-full"
                  style={{ aspectRatio: esVerticalMedia ? '9/16' : '16/9' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  frameBorder="0"
                />
              ) : null
            )}
          </div>
        )}

        {/* Franja superior: comercio + menú */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 pb-8 pointer-events-none">
          <div className="flex min-w-0 items-center gap-2.5 pointer-events-auto">
            {comercio?.logoUrl || publicacion.imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comercio?.logoUrl || publicacion.imagenUrl || ''} alt={nombreMostrado} className="h-9 w-9 flex-shrink-0 rounded-full border border-white/40 object-cover shadow-sm" />
            ) : (
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/40 text-sm font-bold text-white shadow-sm ${publicacion.esAnuncio ? 'bg-[#9B7300]' : 'bg-[#1B4332]'}`}>
                {inicial}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white" style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}>
                  {publicacion.esAnuncio ? '⭐' : comercio ? '🏪' : '👤'}{' '}
                  {!comercio && publicacion.autor ? (
                    <Link href={`/persona/${publicacion.autor.id}`} className="hover:underline">
                      {nombreMostrado}
                    </Link>
                  ) : (
                    nombreMostrado
                  )}
                </p>
                {!publicacion.esAnuncio && (
                  <button
                    type="button"
                    onClick={manejarSeguir}
                    disabled={enVueloSeguir}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide transition-all ${
                      siguiendo
                        ? 'bg-black/40 text-white border border-white/30 backdrop-blur-sm'
                        : 'bg-[#2D6A4F] text-white shadow-sm hover:bg-[#245a42]'
                    }`}
                    style={{ minHeight: 'auto' }}
                  >
                    {siguiendo ? 'Siguiendo' : 'Seguir'}
                  </button>
                )}
              </div>
              <p className="truncate text-xs text-white/90" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)' }}>
                {publicacion.esAnuncio
                  ? 'Anuncio'
                  : comercio?.totalSeguidores != null
                    ? `${comercio.totalSeguidores} ${comercio.totalSeguidores === 1 ? 'seguidor' : 'seguidores'} • ${ubicacion}`
                    : !comercio && publicacion.autor?.totalSeguidores != null
                      ? `${publicacion.autor.totalSeguidores} ${publicacion.autor.totalSeguidores === 1 ? 'seguidor' : 'seguidores'} • ${ubicacion}`
                      : ubicacion}
              </p>
            </div>
          </div>
          <div ref={menuRef} className="relative flex-shrink-0 pointer-events-auto">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Más opciones"
              aria-expanded={menuAbierto}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-black/20"
              style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            {menuAbierto && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-[#1A1A1A]/10 bg-white text-left shadow-lg">
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

        {/* Riel de acciones a la derecha */}
        <div className="absolute bottom-28 right-3 flex flex-col items-center gap-5 pointer-events-none">
          {directo && (
            <button
              type="button"
              onClick={toggleMuted}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/25 text-white border border-white/20 backdrop-blur-sm shadow-md transition hover:bg-black/40 pointer-events-auto"
              style={{ minHeight: 'auto' }}
            >
              <IconoAltavoz silenciado={muted} />
            </button>
          )}

          {!publicacion.esAnuncio && (
            <>
              <button type="button" onClick={manejarLike} aria-pressed={meGusta} className="flex flex-col items-center gap-1 text-white pointer-events-auto" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill={meGusta ? '#C0392B' : 'rgba(0,0,0,0.4)'} stroke="white" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-semibold">{totalLikes}</span>
              </button>
              <button type="button" onClick={manejarGuardar} aria-pressed={esFavorito} className="flex flex-col items-center gap-1 text-white pointer-events-auto" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill={esFavorito ? '#D4A017' : 'rgba(0,0,0,0.4)'} stroke="white" strokeWidth="1.5">
                  <path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2v16z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" onClick={() => setComentariosAbierto(true)} className="flex flex-col items-center gap-1 text-white pointer-events-auto" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(0,0,0,0.4)" stroke="white" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-semibold">{totalComentarios}</span>
              </button>
              <div className="flex flex-col items-center gap-1 text-white" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(0,0,0,0.4)" stroke="white" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-xs font-semibold">{publicacion.totalVistas || 0}</span>
              </div>
            </>
          )}
          <div ref={compartirRef} className="relative pointer-events-auto">
            <button type="button" onClick={manejarCompartirNativo} aria-expanded={compartirAbierto} className="flex flex-col items-center gap-1 text-white" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(0,0,0,0.4)" stroke="white" strokeWidth="1.5">
                <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-semibold">{totalCompartidos}</span>
            </button>
          </div>
        </div>

        {/* Franja inferior: título/descripción + botón de acción */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-16 pointer-events-none flex flex-col justify-end">
          {publicacion.producto && (
            <Link
              href={publicacion.producto.esExpress ? `/express/${publicacion.producto.comercioId}` : `/producto/${publicacion.producto.id}`}
              className="pointer-events-auto mb-3 flex w-max max-w-[85%] items-center gap-3 rounded-[20px] border border-white/10 bg-[#161616]/95 p-1.5 pr-4 shadow-2xl backdrop-blur-md transition hover:bg-[#1f1f1f] group"
            >
              {publicacion.producto.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={publicacion.producto.fotoUrl} alt={publicacion.producto.nombre} className="h-[60px] w-[60px] flex-shrink-0 rounded-2xl object-cover shadow-md" />
              ) : (
                <div className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-md">📦</div>
              )}
              <div className="flex flex-col overflow-hidden py-1">
                {publicacion.esAnuncio && (
                  <p className="text-[10px] font-bold tracking-widest text-[#52B788] uppercase mb-0.5">
                    DESTACADO
                  </p>
                )}
                <p className="truncate text-[15px] font-bold text-white leading-tight pr-2">{publicacion.producto.nombre}</p>
                <p className="text-[14px] font-black text-[#D4A017] mt-0.5">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(publicacion.producto.precio))}
                </p>
              </div>
              <div className="ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#52B788]/10 text-[#52B788] transition-colors group-hover:bg-[#52B788]/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </Link>
          )}

          <p className="pr-14 font-serif text-lg text-white pointer-events-auto" style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}>{publicacion.titulo}</p>
          {publicacion.descripcion && (
            <p className="mt-1 line-clamp-2 pr-14 text-sm text-white/95 pointer-events-auto" style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}>{publicacion.descripcion}</p>
          )}
          
          {publicacion.esAnuncio ? (
            <div className="mt-3 pointer-events-auto">
              <a
                href={publicacion.urlDestino}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#b08513] shadow-md shadow-[#D4A017]/20"
              >
                {publicacion.ctaTexto || 'Ver más'}
              </a>
            </div>
          ) : (comercio?.comprableEnPlataforma !== false || enlaceWaComercio) ? (
            <div className="mt-3 pointer-events-auto">
              {comercio?.comprableEnPlataforma !== false ? (
                <Link
                  href={`/comercio/${comercio?.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#245a42]"
                >
                  Ver comercio
                </Link>
              ) : (
                <a
                  href={enlaceWaComercio as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1ebe5a]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.15h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 012.42 5.83c0 4.55-3.7 8.23-8.25 8.23z" />
                  </svg>
                  Contactar por WhatsApp
                </a>
              )}
            </div>
          ) : null}
        </div>
        {comentariosAbierto && (
          <ModalComentarios
            publicacionId={publicacion.id}
            totalComentariosInit={totalComentarios}
            onClose={() => setComentariosAbierto(false)}
            onComentarioAgregado={() => setTotalComentarios(prev => prev + 1)}
          />
        )}
        <ModalCompartir
          abierto={compartirAbierto}
          onClose={() => setCompartirAbierto(false)}
          url={urlGaleria}
          titulo={publicacion.titulo}
          onCompartir={reportarCompartido}
        />
      </article>
    )
  }

  return (
    <article className="overflow-hidden border-y border-[#1A1A1A]/8 bg-white transition-all duration-200 sm:rounded-3xl sm:border-x sm:shadow-sm sm:hover:-translate-y-0.5 sm:hover:shadow-md">
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="flex min-w-0 items-center gap-3">
          {comercio?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comercio.logoUrl} alt={comercio.nombre} className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-[#D4A017]/25" />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#1B4332] text-base font-bold text-white ring-2 ring-[#D4A017]/25">
              {inicial}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                {!comercio && publicacion.autor ? (
                  <Link href={`/persona/${publicacion.autor.id}`} className="hover:underline">
                    {nombreMostrado}
                  </Link>
                ) : (
                  nombreMostrado
                )}
              </p>
              {comercio?.verificado && (
                <span title="Comercio verificado" className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#2D6A4F]">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              {(comercio || publicacion.autor) && (
                <button
                  type="button"
                  onClick={manejarSeguir}
                  disabled={enVueloSeguir}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide transition-all ${
                    siguiendo
                      ? 'bg-[#1A1A1A]/10 text-[#1A1A1A]/70 border border-[#1A1A1A]/20'
                      : 'bg-[#2D6A4F] text-white hover:bg-[#245a42]'
                  }`}
                  style={{ minHeight: 'auto' }}
                >
                  {siguiendo ? 'Siguiendo' : 'Seguir'}
                </button>
              )}
            </div>
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
        <p className="font-serif text-lg text-[#1A1A1A]">{publicacion.titulo}</p>
        {publicacion.descripcion && (
          <p className="mt-1 whitespace-pre-line text-sm text-[#1A1A1A]/75">{publicacion.descripcion}</p>
        )}
      </div>

      {(publicacion.fotoUrls.length > 0 || publicacion.videoUrl) && (
        <div className="pb-3 sm:px-4">
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
          aria-label="Me gusta"
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-[#F8F5F0] ${
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
          {totalLikes > 0 && totalLikes}
        </button>

        <button
          type="button"
          onClick={() => setComentariosAbierto(true)}
          aria-label="Comentarios"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#1A1A1A]/65 transition hover:bg-[#F8F5F0]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {totalComentarios > 0 && totalComentarios}
        </button>

        {comercio && (
          <button
            type="button"
            onClick={manejarGuardar}
            aria-pressed={esFavorito}
            aria-label="Guardar"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-[#F8F5F0] ${
              esFavorito ? 'text-[#D4A017]' : 'text-[#1A1A1A]/65'
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={esFavorito ? '#D4A017' : 'none'}
              stroke={esFavorito ? '#D4A017' : 'currentColor'}
              strokeWidth="2"
            >
              <path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2v16z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div ref={compartirRef} className="relative flex-1">
          <button
            type="button"
            onClick={() => setCompartirAbierto((v) => !v)}
            aria-expanded={compartirAbierto}
            aria-label="Compartir"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#1A1A1A]/65 transition hover:bg-[#F8F5F0]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {totalCompartidos > 0 && totalCompartidos}
          </button>

          </div>
      </div>

      {/* Botón de acción dinámico — solo en tarjetas de la Vitrina de video (comercio). */}
      {comercio && (comercio.comprableEnPlataforma !== false || enlaceWaComercio) && (
        <div className="border-t border-[#1A1A1A]/8 px-4 py-3">
          {comercio.comprableEnPlataforma !== false ? (
            <Link
              href={`/comercio/${comercio.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#245a42]"
            >
              Ver comercio
            </Link>
          ) : (
            <a
              href={enlaceWaComercio as string}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1ebe5a]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.15h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 012.42 5.83c0 4.55-3.7 8.23-8.25 8.23z" />
              </svg>
              Contactar por WhatsApp
            </a>
          )}
        </div>
      )}

      {comentariosAbierto && (
        <ModalComentarios
          publicacionId={publicacion.id}
          totalComentariosInit={totalComentarios}
          onClose={() => setComentariosAbierto(false)}
          onComentarioAgregado={() => setTotalComentarios((prev) => prev + 1)}
        />
      )}

      <ModalCompartir
        abierto={compartirAbierto}
        onClose={() => setCompartirAbierto(false)}
        url={urlGaleria} 
        titulo={publicacion.titulo} 
        onCompartir={reportarCompartido} 
      />
    </article>
  )
}
