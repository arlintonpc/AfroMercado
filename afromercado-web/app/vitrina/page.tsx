'use client'

import { useCallback, useEffect, useState } from 'react'
import { obtenerVitrina, type PublicacionCultural } from '@/lib/api/cultura'
import { DEPARTAMENTOS } from '@/lib/data/colombia'
import { VitrinaAudioProvider } from '@/context/VitrinaAudioContext'
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
import BannerDisplay from '@/components/publicidad/BannerDisplay'

interface ItemLightbox {
  titulo: string
  fotoUrls: string[]
  videoUrl?: string | null
  indiceInicial?: number
}

export default function VitrinaPage() {
  const [departamento, setDepartamento] = useState('')
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
        modulo: modulo || undefined, 
        search: search || undefined, 
        page: 1 
      })
      let items = r.items
      if (typeof window !== 'undefined') {
        const videoId = new URLSearchParams(window.location.search).get('video')
        if (videoId) {
          const id = Number(videoId)
          const index = items.findIndex(i => i.id === id)
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
  }, [departamento, modulo, search])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function cargarMas() {
    setCargandoMas(true)
    try {
      const siguiente = pagina + 1
      const r = await obtenerVitrina({ 
        departamento: departamento || undefined, 
        modulo: modulo || undefined,
        search: search || undefined,
        page: siguiente 
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

  return (
    <CulturaShell>
      <CulturaPageContainer className="space-y-6">
        <CulturaHero
          eyebrow="Vitrina de video"
          title="Descubre en video"
          description="Hoteles, tours, transporte, comida y más — contado en video y fotos por los mismos comercios de tu región."
        />

        {mensajeConfirmacion && (
          <div className="rounded-2xl border border-[#2D6A4F]/18 bg-[#EAF3DE]/70 px-4 py-3 text-sm font-semibold text-[#1B4332]">
            {mensajeConfirmacion}
          </div>
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
              <span className="mr-2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Buscar lugares, negocios o títulos..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              className="rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
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
              onChange={(e) => setDepartamento(e.target.value)}
              className="rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
            >
              <option value="">Todo Colombia</option>
              {DEPARTAMENTOS.map((d) => (
                <option key={d} value={d}>
                  {d}
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
          <VitrinaAudioProvider>
            <div className="mx-auto flex w-full max-w-xl flex-col gap-10 pb-10">
              {publicaciones.map((p: any) => (
                <div key={p.id} id={`video-${p.id}`} className="w-full pt-4 flex flex-col justify-center">
                  {p.esBannerDisplay ? (
                    <BannerDisplay banner={p} />
                  ) : (
                    <TarjetaPublicacionCultural
                      publicacion={p}
                      onAbrir={(pub, indice) => setLightbox({ titulo: pub.titulo, fotoUrls: pub.fotoUrls, videoUrl: pub.videoUrl, indiceInicial: indice })}
                      onDenunciar={(id) => setDenunciandoId(id)}
                    />
                  )}
                </div>
              ))}
              {hayMas && (
                <div className="flex justify-center py-10 shrink-0">
                  <button
                    type="button"
                    onClick={cargarMas}
                    disabled={cargandoMas}
                    className="self-center rounded-xl border border-[#1A1A1A]/15 bg-white px-6 py-3 text-sm font-bold text-[#1B4332] hover:bg-gray-50 shadow-sm disabled:opacity-50"
                  >
                    {cargandoMas ? 'Cargando…' : 'Cargar más historias'}
                  </button>
                </div>
              )}
            </div>
          </VitrinaAudioProvider>
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
