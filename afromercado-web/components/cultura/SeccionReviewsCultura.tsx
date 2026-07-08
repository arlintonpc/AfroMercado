'use client'

import { useEffect, useState } from 'react'
import {
  reviewsCultura,
  crearReviewCultura,
  subirFotoReviewCultura,
  subirVideoReviewCultura,
  type ReviewCultura,
} from '@/lib/api/review'
import EstrellaRating from '@/components/ui/EstrellaRating'
import { useAuth } from '@/context/AuthContext'

interface Props {
  eventoCulturalId: number
  /** ID de reserva en estado USADA que tiene el usuario actual (si existe) */
  reservaElegibleId?: number
}

const MAX_FOTOS = 6

export default function SeccionReviewsCultura({ eventoCulturalId, reservaElegibleId }: Props) {
  const { usuario } = useAuth()
  const [reviews, setReviews] = useState<ReviewCultura[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [calificacion, setCalificacion] = useState(5)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [fotoUrls, setFotoUrls] = useState<string[]>([])
  const [subiendoFotos, setSubiendoFotos] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [subiendoVideo, setSubiendoVideo] = useState(false)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setCargando(true)
      setErrorCarga(null)
      try {
        const data = await reviewsCultura(eventoCulturalId)
        if (activo) setReviews(data)
      } catch (err) {
        if (!activo) return
        setErrorCarga(err instanceof Error ? err.message : 'No pudimos cargar las reseñas.')
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()
    return () => {
      activo = false
    }
  }, [eventoCulturalId])

  const promedio = reviews.length > 0 ? reviews.reduce((s, r) => s + r.calificacion, 0) / reviews.length : 0
  const yaDejoReview = reviews.some((r) => String(r.clienteId) === String(usuario?.id))
  const subiendoAlgo = subiendoFotos > 0 || subiendoVideo

  async function seleccionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    if (archivos.length === 0) return
    const disponibles = Math.max(0, MAX_FOTOS - fotoUrls.length)
    const aSubir = archivos.slice(0, disponibles)
    setSubiendoFotos((n) => n + aSubir.length)
    for (const archivo of aSubir) {
      try {
        const url = await subirFotoReviewCultura(archivo)
        setFotoUrls((prev) => (prev.length < MAX_FOTOS ? [...prev, url] : prev))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No pudimos subir una foto.')
      } finally {
        setSubiendoFotos((n) => Math.max(0, n - 1))
      }
    }
    e.target.value = ''
  }

  function quitarFoto(url: string) {
    setFotoUrls((prev) => prev.filter((u) => u !== url))
  }

  async function seleccionarVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoVideo(true)
    setError('')
    try {
      const url = await subirVideoReviewCultura(archivo)
      setVideoUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir el video.')
    } finally {
      setSubiendoVideo(false)
      e.target.value = ''
    }
  }

  async function enviarReview() {
    if (!reservaElegibleId) return
    setEnviando(true)
    setError('')
    try {
      const nueva = await crearReviewCultura(reservaElegibleId, calificacion, comentario || undefined, {
        fotoUrls,
        videoUrl,
      })
      setReviews((prev) => [nueva, ...prev])
      setMostrarForm(false)
      setFotoUrls([])
      setVideoUrl(null)
      setComentario('')
      setCalificacion(5)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos publicar tu reseña.')
    } finally {
      setEnviando(false)
    }
  }

  async function reintentarCarga() {
    setCargando(true)
    setErrorCarga(null)
    try {
      const data = await reviewsCultura(eventoCulturalId)
      setReviews(data)
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : 'No pudimos cargar las reseñas.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mt-4 rounded-[1.5rem] border border-[#1A1A1A]/8 bg-white/95 p-5 shadow-[0_10px_30px_rgba(26,26,26,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2D6A4F]">Reseñas</p>
          <h2 className="font-serif text-2xl text-[#1B4332]">Lo que sintió la comunidad</h2>
          {reviews.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <EstrellaRating valor={Math.round(promedio)} tamaño="sm" readonly />
              <span className="text-sm font-bold">{promedio.toFixed(1)}</span>
              <span className="text-xs text-[#1A1A1A]/45">({reviews.length} reseña{reviews.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>
        {reservaElegibleId && !yaDejoReview && usuario && (
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="rounded-full border border-[#2D6A4F]/20 bg-[#EAF3DE] px-4 py-2 text-xs font-semibold text-[#1B4332] transition hover:bg-[#dff0cb]"
          >
            {mostrarForm ? 'Ocultar formulario' : '+ Dejar reseña'}
          </button>
        )}
      </div>

      {mostrarForm && (
        <div className="mb-5 space-y-4 rounded-[1.25rem] border border-[#1A1A1A]/8 bg-[#F8F5F0] p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1A1A1A]/45">
              Tu calificación
            </label>
            <EstrellaRating valor={calificacion} onChange={setCalificacion} tamaño="lg" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1A1A1A]/45">
              Comentario opcional
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              placeholder="Cuéntanos cómo fue tu experiencia en el evento"
              className="w-full resize-none rounded-2xl border border-[#1A1A1A]/10 bg-white px-4 py-3 text-sm text-[#1A1A1A] outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1A1A1A]/45">
              Fotos opcionales, máx. {MAX_FOTOS}
            </label>
            <div className="mb-3 flex flex-wrap gap-2">
              {fotoUrls.map((url) => (
                <div key={url} className="relative h-16 w-16 overflow-hidden rounded-2xl border border-[#1A1A1A]/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Foto de la reseña" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => quitarFoto(url)}
                    className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-black/60 text-[10px] text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {subiendoFotos > 0 &&
                Array.from({ length: subiendoFotos }).map((_, i) => (
                  <div key={`subiendo-${i}`} className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1A1A1A]/10 bg-white">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2D6A4F] border-t-transparent" />
                  </div>
                ))}
            </div>
            {fotoUrls.length < MAX_FOTOS && <input type="file" accept="image/*" multiple onChange={seleccionarFotos} className="text-xs text-[#1A1A1A]/55" />}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1A1A1A]/45">
              Video corto opcional
            </label>
            {videoUrl ? (
              <div className="flex items-center gap-3">
                <video src={videoUrl} controls className="h-24 w-36 rounded-2xl bg-black" />
                <button type="button" onClick={() => setVideoUrl(null)} className="text-xs font-semibold text-[#C0392B] hover:underline">
                  Quitar
                </button>
              </div>
            ) : subiendoVideo ? (
              <div className="flex items-center gap-2 text-xs text-[#1A1A1A]/45">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2D6A4F] border-t-transparent" />
                Subiendo video...
              </div>
            ) : (
              <input type="file" accept="video/*" onChange={seleccionarVideo} className="text-xs text-[#1A1A1A]/55" />
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setMostrarForm(false)}
              className="flex-1 rounded-full border border-[#1A1A1A]/10 py-2.5 text-sm font-semibold text-[#1A1A1A]/60 transition hover:bg-white"
            >
              Cancelar
            </button>
            <button
              onClick={enviarReview}
              disabled={enviando || subiendoAlgo}
              className="flex-1 rounded-full bg-[#2D6A4F] py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42] disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : subiendoAlgo ? 'Subiendo...' : 'Publicar'}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[#1A1A1A]/8 bg-[#F8F5F0] p-4">
              <div className="h-4 w-40 animate-pulse rounded-full bg-[#1A1A1A]/8" />
              <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-[#1A1A1A]/8" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-[#1A1A1A]/8" />
            </div>
          ))}
        </div>
      ) : errorCarga ? (
        <div className="rounded-[1.25rem] border border-[#C0392B]/18 bg-[#C0392B]/6 p-4 text-center">
          <p className="text-sm font-semibold text-[#842029]">No pudimos cargar las reseñas</p>
          <p className="mt-1 text-sm text-[#842029]/80">{errorCarga}</p>
          <button
            type="button"
            onClick={reintentarCarga}
            className="mt-3 rounded-full bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#245a42]"
          >
            Reintentar
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-[1.25rem] border border-dashed border-[#1A1A1A]/10 bg-[#F8F5F0] px-4 py-6 text-center text-sm text-[#1A1A1A]/55">
          Sin reseñas todavía. Sé la primera persona en dejar su experiencia.
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <article key={r.id} className="rounded-[1.25rem] border border-[#1A1A1A]/8 bg-[#F8F5F0] p-4">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2D6A4F]/15 text-xs font-bold text-[#2D6A4F]">
                  {(r.cliente?.nombre?.charAt(0) ?? 'A').toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1A1A1A]">{r.cliente?.nombre ?? 'Asistente'}</p>
                  <EstrellaRating valor={r.calificacion} tamaño="sm" readonly />
                </div>
                <span className="ml-auto text-[10px] text-[#1A1A1A]/40">
                  {new Date(r.creadoAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {r.comentario && <p className="ml-10 text-sm leading-6 text-[#1A1A1A]/72">{r.comentario}</p>}
              {r.fotoUrls && r.fotoUrls.length > 0 && (
                <div className="mt-3 ml-10 flex flex-wrap gap-2">
                  {r.fotoUrls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="Foto de la reseña" className="h-16 w-16 rounded-2xl border border-[#1A1A1A]/8 object-cover" />
                  ))}
                </div>
              )}
              {r.videoUrl && <video src={r.videoUrl} controls className="mt-3 ml-10 h-36 w-full max-w-sm rounded-2xl bg-black" />}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
