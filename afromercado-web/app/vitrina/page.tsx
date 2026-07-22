'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { obtenerVitrina, type PublicacionCultural } from '@/lib/api/cultura'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
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
    <CulturaShell modoTeatro={true}>
      <div className="md:mx-auto md:w-full md:max-w-4xl md:px-4 sm:px-6 lg:px-8 h-full flex flex-col">
        
        {/* Filtros solo en Desktop */}
        <div className="hidden md:block py-4 mb-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput)
            }}
            className="flex items-center gap-3 w-full max-w-2xl mx-auto"
          >
            <div className="flex flex-1 items-center rounded-full border border-[#1A1A1A]/12 bg-white px-4 py-2.5 transition focus-within:border-[#2D6A4F] focus-within:ring-2 focus-within:ring-[#2D6A4F]/15">
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
        </div>

        {cargando ? (
          <div className="px-4 md:px-0 mt-20 md:mt-0">
            <CulturaSkeletonGrid />
          </div>
        ) : error ? (
          <div className="px-4 md:px-0 mt-20 md:mt-0">
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
          </div>
        ) : publicaciones.length === 0 ? (
          <div className="px-4 md:px-0 mt-20 md:mt-0">
            <CulturaStateCard
              icon="🎬"
              title="Todavía no hay publicaciones"
              description={`Los comercios aún no han compartido videos o fotos${departamento ? ` en ${departamento}` : ''}. Vuelve pronto.`}
            />
          </div>
        ) : (
          <VitrinaAudioProvider>
            <div 
              className="flex-1 flex flex-col w-full h-full overflow-y-scroll snap-y snap-mandatory bg-black md:bg-transparent"
              style={{ scrollbarWidth: 'none' }}
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                if (hayMas && !cargandoMas && target.scrollHeight - target.scrollTop <= target.clientHeight * 2) {
                  cargarMas();
                }
              }}
            >
              {/* Botón flotante para regresar en móvil */}
              <div className="md:hidden fixed top-0 inset-x-0 p-4 z-50 flex items-center justify-between pointer-events-none">
                <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 pointer-events-auto">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </Link>
                <div className="flex flex-col text-right drop-shadow-md">
                  <span className="text-white font-bold text-sm">Vitrina</span>
                  <span className="text-white/80 text-[10px] uppercase tracking-wider">{departamento || 'Colombia'}</span>
                </div>
              </div>

              {publicaciones.map((p: any) => (
                <div key={p.id} id={`video-${p.id}`} className="w-full h-full md:py-6 flex flex-col justify-center snap-start snap-always shrink-0 relative">
                  {p.esBannerDisplay ? (
                    <div className="h-full flex items-center justify-center p-4">
                      <BannerDisplay banner={p} />
                    </div>
                  ) : (
                    <TarjetaPublicacionCultural
                      publicacion={p}
                      onAbrir={(pub, indice) => setLightbox({ titulo: pub.titulo, fotoUrls: pub.fotoUrls, videoUrl: pub.videoUrl, indiceInicial: indice })}
                      onDenunciar={(id) => setDenunciandoId(id)}
                    />
                  )}
                </div>
              ))}
              
              {/* Infinite Scroll Loader Trigger */}
              {hayMas && (
                <div className="w-full h-32 md:h-20 shrink-0 flex items-center justify-center snap-start">
                  {cargandoMas ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white md:border-[#1B4332]"></div>
                  ) : (
                    <button
                      type="button"
                      onClick={cargarMas}
                      className="md:hidden text-white/50 text-sm"
                    >
                      Desliza para ver más
                    </button>
                  )}
                </div>
              )}
            </div>
          </VitrinaAudioProvider>
        )}
      </div>

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
