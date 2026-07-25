'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { obtenerVitrina, type PublicacionCultural } from '@/lib/api/cultura'
import { normalizarUrlMedia } from '@/lib/api/client'
import { useVitrinaQuery } from '@/hooks/useCulturaQuery'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import {
  CulturaHero,
  CulturaPageContainer,
  CulturaShell,
  CulturaSkeletonGrid,
  CulturaStateCard,
  CulturaToolbar,
} from '@/components/cultura/CulturaUI'
import TerritoryPostCard from '@/components/cultura/TerritoryPostCard'
import ModalTeatroPublicacion from '@/components/cultura/ModalTeatroPublicacion'
import ModalDenunciarPublicacion from '@/components/cultura/ModalDenunciarPublicacion'
import BannerDisplay from '@/components/publicidad/BannerDisplay'
import VitrinaReelsFeed from '@/components/cultura/VitrinaReelsFeed'
import HistoriasCarrusel from '@/components/cultura/HistoriasCarrusel'

interface ItemLightbox {
  publicacion: PublicacionCultural
  indiceInicial?: number
}

interface ItemVitrina extends PublicacionCultural {
  esBannerDisplay?: boolean
  subtitulo?: string | null
  mediaUrl?: string | null
}

type PestañaVitrina = 'EXPLORAR' | 'SIGUIENDO' | 'GUARDADOS'

export default function VitrinaPage() {
  const { usuario } = useAuth()
  const esComerciante = usuario?.rol === 'COMERCIANTE'

  const [pestaña, setPestaña] = useState<PestañaVitrina>('EXPLORAR')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [modulo, setModulo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data: vitrinaData, isLoading: cargando, error: queryError, refetch: cargar } = useVitrinaQuery({
    departamento: departamento || undefined,
    municipio: municipio || undefined,
    modulo: modulo || undefined,
    search: search || undefined,
    page: 1,
  })

  const [publicacionesExtra, setPublicacionesExtra] = useState<ItemVitrina[]>([])
  const [pagina, setPagina] = useState(1)
  const [cargandoMas, setCargandoMas] = useState(false)

  const publicaciones = useMemo(() => {
    const base = vitrinaData?.items || []
    if (pagina === 1) return base
    return [...base, ...publicacionesExtra]
  }, [vitrinaData, publicacionesExtra, pagina])

  const total = vitrinaData?.total ?? 0
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'No pudimos cargar la vitrina.') : null

  const [lightbox, setLightbox] = useState<ItemLightbox | null>(null)
  const [denunciandoId, setDenunciandoId] = useState<number | null>(null)
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null)
  const [reelsVideoInicialId, setReelsVideoInicialId] = useState<number | null>(null)
  const [modoReels, setModoReels] = useState(false)
  const enlaceProcesado = useRef<string | null>(null)

  // Reset extra cuando cambian los filtros
  useEffect(() => {
    setPublicacionesExtra([])
    setPagina(1)
  }, [departamento, municipio, modulo, search])

  // Los enlaces compartidos deben abrir exactamente la foto o el video elegido.
  // Se conserva ?video= como compatibilidad con enlaces compartidos anteriormente.
  useEffect(() => {
    if (cargando) return
    const parametros = new URLSearchParams(window.location.search)
    const parametro = parametros.get('publicacion') ?? parametros.get('video')
    if (!parametro || enlaceProcesado.current === parametro) return
    const id = Number(parametro)
    const publicacion = publicaciones.find((p) => p.id === id)
    if (!publicacion) return

    enlaceProcesado.current = parametro
    if (publicacion.videoUrl) {
      setReelsVideoInicialId(publicacion.id)
      setModoReels(true)
    } else {
      setLightbox({ publicacion, indiceInicial: 0 })
    }
  }, [cargando, publicaciones])

  // Filtrado según la pestaña activa (Explorar, Siguiendo, Guardados)
  const publicacionesFiltradas = useMemo(() => {
    if (pestaña === 'SIGUIENDO') {
      return publicaciones.filter((p) => p.comercio?.siguiendo)
    }
    if (pestaña === 'GUARDADOS') {
      return publicaciones.filter((p) => p.esFavorito)
    }
    return publicaciones
  }, [pestaña, publicaciones])

  async function cargarMas() {
    setCargandoMas(true)
    try {
      const siguiente = pagina + 1
      const r = await obtenerVitrina({
        departamento: departamento || undefined,
        municipio: municipio || undefined,
        modulo: modulo || undefined,
        search: search || undefined,
        page: siguiente,
      })
      setPublicacionesExtra((prev) => [...prev, ...r.items])
      setPagina(siguiente)
    } finally {
      setCargandoMas(false)
    }
  }

  function handleDenunciaExito() {
    setDenunciandoId(null)
    setMensajeConfirmacion('Gracias, tu denuncia fue enviada y será revisada por un administrador.')
    setTimeout(() => setMensajeConfirmacion(null), 4500)
  }

  const hayMas = publicaciones.length < total

  const comerciantes = useMemo(() => {
    const vistos = new Set<number>()
    const lista: { id: number; nombre: string; logoUrl?: string | null; fondoUrl?: string | null }[] = []
    for (const p of publicaciones) {
      const c = p.comercio
      if (c && !vistos.has(c.id)) {
        vistos.add(c.id)
        lista.push({ id: c.id, nombre: c.nombre, logoUrl: c.logoUrl || (c as any).usuario?.avatarUrl || p.autor?.avatarUrl || null, fondoUrl: p.fotoUrls?.[0] || p.videoPosterUrl || null })
      }
    }
    return lista
  }, [publicaciones])

  return (
    <CulturaShell>
      <CulturaPageContainer className="space-y-6">
        <CulturaHero
          eyebrow="Vitrina"
          title="Descubre tu territorio"
          description="La Vitrina Digital de la Economía Territorial — conecta todo lo que un territorio produce, ofrece y vive."
          actions={
            <button
              onClick={() => {
                const primerVideo = publicaciones.find((p) => !!p.videoUrl)
                setReelsVideoInicialId(primerVideo?.id || null)
                setModoReels(true)
              }}
              className="inline-flex items-center gap-2 bg-[#D4A017] hover:bg-[#b88a14] text-[#1B4332] font-extrabold text-sm px-5 py-2.5 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Vitrina Videos 🎬
            </button>
          }
        />

        {/* Pestañas Principales de Descubrimiento */}
        <div className="flex items-center justify-center gap-1.5 p-1.5 bg-white border border-[#1A1A1A]/8 rounded-full max-w-md mx-auto shadow-sm">
          <button
            onClick={() => setPestaña('EXPLORAR')}
            className={`flex-1 py-2.5 px-4 rounded-full text-xs font-bold transition-all duration-300 ${
              pestaña === 'EXPLORAR'
                ? 'bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20'
                : 'text-[#1A1A1A]/70 hover:text-[#1B4332] hover:bg-[#F8F5F0]'
            }`}
          >
            🧭 Explorar
          </button>
          <button
            onClick={() => setPestaña('SIGUIENDO')}
            className={`flex-1 py-2.5 px-4 rounded-full text-xs font-bold transition-all duration-300 ${
              pestaña === 'SIGUIENDO'
                ? 'bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20'
                : 'text-[#1A1A1A]/70 hover:text-[#1B4332] hover:bg-[#F8F5F0]'
            }`}
          >
            ✨ Siguiendo
          </button>
          <button
            onClick={() => setPestaña('GUARDADOS')}
            className={`flex-1 py-2.5 px-4 rounded-full text-xs font-bold transition-all duration-300 ${
              pestaña === 'GUARDADOS'
                ? 'bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20'
                : 'text-[#1A1A1A]/70 hover:text-[#1B4332] hover:bg-[#F8F5F0]'
            }`}
          >
            🔖 Guardados
          </button>
        </div>

        {mensajeConfirmacion && (
          <div className="rounded-2xl border border-[#2D6A4F]/18 bg-[#EAF3DE]/70 px-4 py-3 text-sm font-semibold text-[#1B4332]">
            {mensajeConfirmacion}
          </div>
        )}

        {/* Carrusel de Historias Efímeras (24h) — Estilo Facebook / WhatsApp / IG */}
        <HistoriasCarrusel />

        {esComerciante && (
          <Link
            href="/comerciante/vitrina/nueva"
            className="flex items-center justify-between rounded-2xl border border-[#1A1A1A]/8 bg-white px-5 py-3.5 shadow-sm transition-all duration-300 hover:border-[#2D6A4F]/30 hover:shadow-md"
          >
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#1B4332] overflow-hidden border-2 border-[#D4A017] shadow-sm">
                {(() => {
                  const avatarCrear = normalizarUrlMedia(usuario?.avatarUrl || (usuario as any)?.comercio?.logoUrl)
                  return avatarCrear ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatarCrear} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-sm">🎥</span>
                  )
                })()}
              </div>
              <span className="text-sm font-semibold text-[#1A1A1A]/60 truncate">¿Qué quieres compartir hoy de tu oferta?</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#1B4332] bg-[#2D6A4F]/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-[#2D6A4F]/20 transition-colors">
                📷 Foto
              </span>
              <span className="text-xs font-bold text-[#9C6F0F] bg-[#D4A017]/15 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-[#D4A017]/25 transition-colors">
                🎥 Video Clip
              </span>
              <span className="text-xs font-bold text-[#1B4332] bg-[#1B4332]/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-[#1B4332]/20 transition-colors">
                🏷️ Publicar
              </span>
            </div>
          </Link>
        )}

        <CulturaToolbar>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput)
            }}
            className="flex flex-wrap items-center gap-3 w-full"
          >
            <div className="flex flex-1 min-w-[200px] items-center rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 transition focus-within:border-[#2D6A4F] focus-within:ring-2 focus-within:ring-[#2D6A4F]/15">
              <span className="mr-2 text-[#1A1A1A]/40">🔍</span>
              <input
                type="text"
                placeholder="Buscar productos, experiencias o comercios..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-transparent text-sm outline-none text-[#1A1A1A] placeholder:text-[#1A1A1A]/40"
              />
            </div>

            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              className="rounded-full border border-[#1A1A1A]/12 bg-white text-[#1A1A1A] px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
            >
              <option value="">Todas las categorías</option>
              <option value="HOTEL">Hoteles</option>
              <option value="TOUR">Tours</option>
              <option value="EXPRESS">Express</option>
              <option value="TRANSPORTE">Transporte</option>
              <option value="PEDIDO">Productos</option>
              <option value="AGRO">Agro</option>
            </select>

            <select
              value={departamento}
              onChange={(e) => { setDepartamento(e.target.value); setMunicipio('') }}
              className="rounded-full border border-[#1A1A1A]/12 bg-white text-[#1A1A1A] px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
            >
              <option value="">Todo Colombia</option>
              {DEPARTAMENTOS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              disabled={!departamento}
              className="rounded-full border border-[#1A1A1A]/12 bg-white text-[#1A1A1A] px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 disabled:opacity-50"
            >
              <option value="">{departamento ? 'Todo el departamento' : 'Elige departamento'}</option>
              {municipiosDe(departamento).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </form>
        </CulturaToolbar>

        {cargando ? (
          <CulturaSkeletonGrid />
        ) : error ? (
          <CulturaStateCard
            tone="error"
            icon="⚠️"
            title="No pudimos cargar la vitrina"
            description={error}
            action={
              <button
                onClick={() => cargar()}
                className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]"
              >
                Reintentar
              </button>
            }
          />
        ) : publicacionesFiltradas.length === 0 ? (
          <CulturaStateCard
            icon="🎬"
            title="No hay publicaciones en esta sección"
            description={
              pestaña === 'SIGUIENDO'
                ? 'Sigue a tus comercios favoritos para ver sus novedades aquí.'
                : pestaña === 'GUARDADOS'
                ? 'Guarda publicaciones de tu interés para verlas más tarde.'
                : `Los comercios aún no han publicado en ${departamento || 'esta ubicación'}.`
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-6 max-w-xl mx-auto w-full">
              {publicacionesFiltradas.map((p: any) =>
                p.esBannerDisplay ? (
                  <BannerDisplay
                    key={p.id}
                    banner={{
                      id: String(p.id),
                      esBannerDisplay: true,
                      titulo: p.titulo,
                      subtitulo: p.subtitulo,
                      mediaUrl: p.mediaUrl,
                      urlDestino: p.urlDestino,
                      ctaTexto: p.ctaTexto,
                      etiqueta: p.etiqueta,
                    }}
                  />
                ) : (
                  <TerritoryPostCard
                    key={p.id}
                    publicacion={p}
                    onAbrirFoto={(pub, index) => setLightbox({ publicacion: pub, indiceInicial: index })}
                    onAbrirVideoReels={(id) => {
                      setReelsVideoInicialId(id)
                      setModoReels(true)
                    }}
                    onDenunciar={(id) => setDenunciandoId(id)}
                  />
                )
              )}
            </div>
            {hayMas && pestaña === 'EXPLORAR' && (
              <button
                type="button"
                onClick={cargarMas}
                disabled={cargandoMas}
                className="self-center rounded-xl border border-[#1A1A1A]/15 bg-white px-6 py-3 text-sm font-bold text-[#1B4332] hover:bg-gray-50 shadow-sm disabled:opacity-50 mt-4"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar más ofertas del territorio'}
              </button>
            )}
          </div>
        )}
      </CulturaPageContainer>

      {lightbox && (
        <ModalTeatroPublicacion
          publicacion={lightbox.publicacion}
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

      {modoReels && (
        <VitrinaReelsFeed
          publicaciones={publicaciones}
          publicacionInicialId={reelsVideoInicialId || undefined}
          onCerrar={() => {
            setModoReels(false)
            setReelsVideoInicialId(null)
          }}
        />
      )}
    </CulturaShell>
  )
}
