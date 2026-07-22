'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { obtenerVitrina, type PublicacionCultural } from '@/lib/api/cultura'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import {
  CulturaHero,
  CulturaPageContainer,
  CulturaShell,
  CulturaSkeletonGrid,
  CulturaStateCard,
  CulturaToolbar,
} from '@/components/cultura/CulturaUI'
import TarjetaPublicacionCultural from '@/components/cultura/TarjetaPublicacionCultural'
import ModalTeatroPublicacion from '@/components/cultura/ModalTeatroPublicacion'
import ModalDenunciarPublicacion from '@/components/cultura/ModalDenunciarPublicacion'
import BannerDisplay from '@/components/publicidad/BannerDisplay'

interface ItemLightbox {
  publicacion: PublicacionCultural
  indiceInicial?: number
}

export default function VitrinaPage() {
  const { usuario } = useAuth()
  const esComerciante = usuario?.rol === 'COMERCIANTE'

  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [modulo, setModulo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [publicaciones, setPublicaciones] = useState<PublicacionCultural[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [lightbox, setLightbox] = useState<ItemLightbox | null>(null)
  const [denunciandoId, setDenunciandoId] = useState<number | null>(null)
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const r = await obtenerVitrina({
        departamento: departamento || undefined,
        municipio: municipio || undefined,
        modulo: modulo || undefined,
        search: search || undefined,
        page: 1,
      })
      let items = r.items
      if (typeof window !== 'undefined') {
        const videoId = new URLSearchParams(window.location.search).get('video')
        if (videoId) {
          const id = Number(videoId)
          const index = items.findIndex((i) => i.id === id)
          if (index > 0) {
            const target = items[index]
            items = [target, ...items.slice(0, index), ...items.slice(index + 1)]
          }
        }
      }
      setPublicaciones(items)
      setTotal(r.total)
      setPagina(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar la vitrina.')
    } finally {
      setCargando(false)
    }
  }, [departamento, municipio, modulo, search])

  useEffect(() => {
    cargar()
  }, [cargar])

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
      setPublicaciones((prev) => [...prev, ...r.items])
      setTotal(r.total)
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

  // Barra de comerciantes (estilo historias de Facebook): una tarjeta por
  // comercio único entre las publicaciones ya cargadas, con la foto o el
  // poster de su publicación más reciente como fondo.
  const comerciantes = useMemo(() => {
    const vistos = new Set<number>()
    const lista: { id: number; nombre: string; logoUrl?: string | null; fondoUrl?: string | null }[] = []
    for (const p of publicaciones) {
      const c = p.comercio
      if (c && !vistos.has(c.id)) {
        vistos.add(c.id)
        lista.push({ id: c.id, nombre: c.nombre, logoUrl: c.logoUrl, fondoUrl: p.fotoUrls?.[0] || p.videoPosterUrl || null })
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
          description="Fotos, videos y novedades de hoteles, tours, transporte, comida y más — contado por los mismos comercios de tu región."
        />

        {mensajeConfirmacion && (
          <div className="rounded-2xl border border-[#2D6A4F]/18 bg-[#EAF3DE]/70 px-4 py-3 text-sm font-semibold text-[#1B4332]">
            {mensajeConfirmacion}
          </div>
        )}

        {comerciantes.length > 0 && (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
            {comerciantes.map((c) => (
              <Link
                key={c.id}
                href={`/comercio/${c.id}`}
                className="group relative h-44 w-28 flex-shrink-0 overflow-hidden rounded-2xl bg-[#1B4332] shadow-sm"
              >
                {c.fondoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.fondoUrl}
                    alt={c.nombre}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#2D6A4F] to-[#1B4332]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logoUrl}
                    alt=""
                    className="absolute left-2 top-2 h-9 w-9 rounded-full border-2 border-[#D4A017] object-cover"
                  />
                ) : (
                  <div className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#D4A017] bg-[#1B4332] text-sm font-bold text-white">
                    {c.nombre[0]?.toUpperCase() || '?'}
                  </div>
                )}

                <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs font-semibold leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
                  {c.nombre}
                </span>
              </Link>
            ))}
          </div>
        )}

        {esComerciante && (
          <Link
            href="/comerciante/vitrina/nueva"
            className="flex items-center gap-3 rounded-2xl border border-[#1A1A1A]/8 bg-white px-4 py-3 shadow-sm transition hover:border-[#2D6A4F]/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1B4332] text-lg">
              🎥
            </div>
            <span className="text-sm font-medium text-[#1A1A1A]/50">¿Qué quieres compartir hoy?</span>
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
                placeholder="Buscar lugares, negocios o títulos..."
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
                onClick={cargar}
                className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]"
              >
                Reintentar
              </button>
            }
          />
        ) : publicaciones.length === 0 ? (
          <CulturaStateCard
            icon="🎬"
            title="Todavía no hay publicaciones"
            description={`Los comercios aún no han compartido videos o fotos${departamento ? ` en ${departamento}` : ''}. Vuelve pronto.`}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="-mx-4 flex w-auto flex-col gap-0 sm:mx-auto sm:w-full sm:max-w-xl sm:gap-4">
              {publicaciones.map((p: any) =>
                p.esBannerDisplay ? (
                  <BannerDisplay key={p.id} banner={p} />
                ) : (
                  <TarjetaPublicacionCultural
                    key={p.id}
                    publicacion={p}
                    forzarClasica
                    onAbrir={(pub, indice) => setLightbox({ publicacion: pub, indiceInicial: indice })}
                    onDenunciar={(id) => setDenunciandoId(id)}
                  />
                )
              )}
            </div>
            {hayMas && (
              <button
                type="button"
                onClick={cargarMas}
                disabled={cargandoMas}
                className="self-center rounded-xl border border-[#1A1A1A]/15 bg-white px-6 py-3 text-sm font-bold text-[#1B4332] hover:bg-gray-50 shadow-sm disabled:opacity-50"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar más historias'}
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
    </CulturaShell>
  )
}
