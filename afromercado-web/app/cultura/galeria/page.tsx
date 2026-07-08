'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { listarPublicacionesCulturales, type PublicacionCultural } from '@/lib/api/cultura'
import { galeriaCultura, type ReviewGaleria } from '@/lib/api/review'
import { DEPARTAMENTOS } from '@/lib/data/colombia'
import {
  CulturaHero,
  CulturaPageContainer,
  CulturaShell,
  CulturaSkeletonGrid,
  CulturaStateCard,
  CulturaToolbar,
} from '@/components/cultura/CulturaUI'
import TarjetaPublicacionCultural from '@/components/cultura/TarjetaPublicacionCultural'
import ModalGaleriaHistoria from '@/components/cultura/ModalGaleriaHistoria'
import ModalDenunciarPublicacion from '@/components/cultura/ModalDenunciarPublicacion'

type Pestana = 'publicaciones' | 'resenas'

interface ItemLightbox {
  titulo: string
  fotoUrls: string[]
  videoUrl?: string | null
  indiceInicial?: number
}

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

function Estrellas({ calificacion }: { calificacion: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${calificacion} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i < calificacion ? '#D4A017' : 'none'} stroke="#D4A017" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  )
}

function TarjetaResenaGaleria({ resena, onAbrir }: { resena: ReviewGaleria; onAbrir: (item: ItemLightbox) => void }) {
  const miniatura = resena.fotoUrls[0] || ''
  const soloVideo = !miniatura && !!resena.videoUrl
  const titulo = resena.evento?.titulo || 'Evento cultural'
  const ubicacion = resena.evento ? `${resena.evento.municipio}, ${resena.evento.departamento}` : 'Chocó'

  function handleAbrir() {
    onAbrir({ titulo, fotoUrls: resena.fotoUrls, videoUrl: resena.videoUrl })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white shadow-sm">
      <div
        role="button"
        tabIndex={0}
        onClick={handleAbrir}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAbrir() } }}
        className="group relative aspect-video cursor-pointer overflow-hidden bg-[#1B4332] text-left text-white"
      >
        {miniatura ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={miniatura} alt={titulo} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(212,160,23,0.18),_transparent_62%),linear-gradient(135deg,_#1B4332,_#2D6A4F)] text-3xl" aria-hidden="true">
            {soloVideo ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" opacity="0.35" />
                <path d="M10 8l6 4-6 4V8z" fill="white" stroke="none" />
              </svg>
            ) : (
              '⭐'
            )}
          </div>
        )}

        <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] font-semibold uppercase tracking-wide text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]">
          {fechaCorta(resena.creadoAt)}
        </span>
      </div>

      <div className="p-4">
        <Estrellas calificacion={resena.calificacion} />
        <p className="mt-2 font-serif text-base font-semibold text-[#1A1A1A]">{titulo}</p>
        <p className="mt-1 text-xs text-[#1A1A1A]/55">{ubicacion} · {resena.cliente?.nombre || 'un viajero'}</p>
        {resena.comentario && (
          <p className="mt-2 whitespace-pre-line text-sm text-[#1A1A1A]/75">{resena.comentario}</p>
        )}
      </div>
    </div>
  )
}

export default function GaleriaCulturaPage() {
  const [pestana, setPestana] = useState<Pestana>('publicaciones')
  const [departamento, setDepartamento] = useState('')

  const [publicaciones, setPublicaciones] = useState<PublicacionCultural[]>([])
  const [totalPublicaciones, setTotalPublicaciones] = useState(0)
  const [paginaPublicaciones, setPaginaPublicaciones] = useState(1)
  const [cargandoPublicaciones, setCargandoPublicaciones] = useState(true)
  const [cargandoMasPublicaciones, setCargandoMasPublicaciones] = useState(false)
  const [errorPublicaciones, setErrorPublicaciones] = useState<string | null>(null)

  const [resenas, setResenas] = useState<ReviewGaleria[]>([])
  const [totalResenas, setTotalResenas] = useState(0)
  const [paginaResenas, setPaginaResenas] = useState(1)
  const [cargandoResenas, setCargandoResenas] = useState(true)
  const [cargandoMasResenas, setCargandoMasResenas] = useState(false)
  const [errorResenas, setErrorResenas] = useState<string | null>(null)

  const [lightbox, setLightbox] = useState<ItemLightbox | null>(null)
  const [denunciandoId, setDenunciandoId] = useState<number | null>(null)
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null)

  const cargarPublicaciones = useCallback(async () => {
    setCargandoPublicaciones(true)
    setErrorPublicaciones(null)
    try {
      const r = await listarPublicacionesCulturales({ departamento: departamento || undefined, page: 1 })
      setPublicaciones(r.items)
      setTotalPublicaciones(r.total)
      setPaginaPublicaciones(1)
    } catch (e) {
      setErrorPublicaciones(e instanceof Error ? e.message : 'No pudimos cargar las historias de la comunidad.')
    } finally {
      setCargandoPublicaciones(false)
    }
  }, [departamento])

  const cargarResenas = useCallback(async () => {
    setCargandoResenas(true)
    setErrorResenas(null)
    try {
      const r = await galeriaCultura(1, departamento || undefined)
      setResenas(r.items)
      setTotalResenas(r.total)
      setPaginaResenas(1)
    } catch (e) {
      setErrorResenas(e instanceof Error ? e.message : 'No pudimos cargar las reseñas con fotos.')
    } finally {
      setCargandoResenas(false)
    }
  }, [departamento])

  useEffect(() => {
    if (pestana === 'publicaciones') cargarPublicaciones()
    else cargarResenas()
  }, [pestana, cargarPublicaciones, cargarResenas])

  async function cargarMasPublicaciones() {
    setCargandoMasPublicaciones(true)
    try {
      const siguiente = paginaPublicaciones + 1
      const r = await listarPublicacionesCulturales({ departamento: departamento || undefined, page: siguiente })
      setPublicaciones((prev) => [...prev, ...r.items])
      setTotalPublicaciones(r.total)
      setPaginaPublicaciones(siguiente)
    } finally {
      setCargandoMasPublicaciones(false)
    }
  }

  async function cargarMasResenas() {
    setCargandoMasResenas(true)
    try {
      const siguiente = paginaResenas + 1
      const r = await galeriaCultura(siguiente, departamento || undefined)
      setResenas((prev) => [...prev, ...r.items])
      setTotalResenas(r.total)
      setPaginaResenas(siguiente)
    } finally {
      setCargandoMasResenas(false)
    }
  }

  function handleDenunciaExito() {
    setDenunciandoId(null)
    setMensajeConfirmacion('Gracias, tu denuncia fue enviada y será revisada por un administrador.')
    setTimeout(() => setMensajeConfirmacion(null), 4500)
  }

  const hayMasPublicaciones = publicaciones.length < totalPublicaciones
  const hayMasResenas = resenas.length < totalResenas

  const actions = (
    <Link
      href="/cultura/comparte"
      className="rounded-full bg-[#D4A017] px-4 py-2 text-sm font-semibold text-[#1A1A1A] transition hover:bg-[#c59616]"
    >
      Compartir mi historia
    </Link>
  )

  return (
    <CulturaShell>
      <CulturaPageContainer className="space-y-6">
        <CulturaHero
          eyebrow="Galería cultural"
          title="Comparte tu Territorio"
          description="Fotos, videos e historias reales de la comunidad y de quienes viven la agenda cultural. Explora lo que otros comparten o cuenta tu propia historia."
          actions={actions}
        />

        {mensajeConfirmacion && (
          <div className="rounded-2xl border border-[#2D6A4F]/18 bg-[#EAF3DE]/70 px-4 py-3 text-sm font-semibold text-[#1B4332]">
            {mensajeConfirmacion}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPestana('publicaciones')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              pestana === 'publicaciones'
                ? 'bg-[#1B4332] text-white shadow-sm'
                : 'border border-[#1A1A1A]/10 bg-white/80 text-[#1A1A1A]/65 hover:bg-white'
            }`}
          >
            Comparte tu Territorio
          </button>
          <button
            type="button"
            onClick={() => setPestana('resenas')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              pestana === 'resenas'
                ? 'bg-[#1B4332] text-white shadow-sm'
                : 'border border-[#1A1A1A]/10 bg-white/80 text-[#1A1A1A]/65 hover:bg-white'
            }`}
          >
            Reseñas con fotos
          </button>
        </div>

        <CulturaToolbar>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-[#1A1A1A]/70" htmlFor="filtro-depto-galeria">
              Departamento
            </label>
            <select
              id="filtro-depto-galeria"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              className="min-w-[220px] rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
            >
              <option value="">Todo Colombia</option>
              {DEPARTAMENTOS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </CulturaToolbar>

        {pestana === 'publicaciones' ? (
          cargandoPublicaciones ? (
            <CulturaSkeletonGrid />
          ) : errorPublicaciones ? (
            <CulturaStateCard
              tone="error"
              icon="⚠️"
              title="No pudimos cargar las historias"
              description={errorPublicaciones}
              action={
                <button
                  onClick={cargarPublicaciones}
                  className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]"
                >
                  Reintentar
                </button>
              }
            />
          ) : publicaciones.length === 0 ? (
            <CulturaStateCard
              icon="📸"
              title="Todavía no hay historias publicadas"
              description={`Sé la primera persona en compartir una foto o video de tu territorio${departamento ? ` en ${departamento}` : ''}.`}
              action={
                <Link
                  href="/cultura/comparte"
                  className="rounded-full bg-[#1B4332] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#245a42]"
                >
                  Compartir mi historia
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
                {publicaciones.map((p) => (
                  <TarjetaPublicacionCultural
                    key={p.id}
                    publicacion={p}
                    onAbrir={(pub, indice) => setLightbox({ titulo: pub.titulo, fotoUrls: pub.fotoUrls, videoUrl: pub.videoUrl, indiceInicial: indice })}
                    onDenunciar={(id) => setDenunciandoId(id)}
                  />
                ))}
              </div>
              {hayMasPublicaciones && (
                <button
                  type="button"
                  onClick={cargarMasPublicaciones}
                  disabled={cargandoMasPublicaciones}
                  className="self-center rounded-xl border border-[#1A1A1A]/15 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/70 hover:bg-white disabled:opacity-50"
                >
                  {cargandoMasPublicaciones ? 'Cargando…' : 'Cargar más historias'}
                </button>
              )}
            </div>
          )
        ) : cargandoResenas ? (
          <CulturaSkeletonGrid />
        ) : errorResenas ? (
          <CulturaStateCard
            tone="error"
            icon="⚠️"
            title="No pudimos cargar las reseñas"
            description={errorResenas}
            action={
              <button
                onClick={cargarResenas}
                className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]"
              >
                Reintentar
              </button>
            }
          />
        ) : resenas.length === 0 ? (
          <CulturaStateCard
            icon="⭐"
            title="Todavía no hay reseñas con fotos"
            description={`Las reseñas con foto o video de eventos culturales aparecerán aquí${departamento ? ` en ${departamento}` : ''}.`}
            action={
              <Link
                href="/cultura"
                className="rounded-full bg-[#1B4332] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#245a42]"
              >
                Ver agenda cultural
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
              {resenas.map((r) => (
                <TarjetaResenaGaleria key={r.id} resena={r} onAbrir={setLightbox} />
              ))}
            </div>
            {hayMasResenas && (
              <button
                type="button"
                onClick={cargarMasResenas}
                disabled={cargandoMasResenas}
                className="self-center rounded-xl border border-[#1A1A1A]/15 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/70 hover:bg-white disabled:opacity-50"
              >
                {cargandoMasResenas ? 'Cargando…' : 'Cargar más reseñas'}
              </button>
            )}
          </div>
        )}
      </CulturaPageContainer>

      {lightbox && (
        <ModalGaleriaHistoria
          titulo={lightbox.titulo}
          fotoUrls={lightbox.fotoUrls}
          videoUrl={lightbox.videoUrl}
          indiceInicial={lightbox.indiceInicial}
          onCerrar={() => setLightbox(null)}
        />
      )}

      {denunciandoId !== null && (
        <ModalDenunciarPublicacion
          publicacionId={denunciandoId}
          onCerrar={() => setDenunciandoId(null)}
          onExito={handleDenunciaExito}
        />
      )}
    </CulturaShell>
  )
}
