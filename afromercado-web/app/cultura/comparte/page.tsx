'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import {
  crearPublicacionCultural,
  subirFotoPublicacionCultural,
  subirVideoPublicacionCultural,
} from '@/lib/api/cultura'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'

const MAX_FOTOS = 6

export default function CompartePage() {
  const router = useRouter()
  const { usuario, cargando } = useAuth()

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [municipioOtro, setMunicipioOtro] = useState(false)

  const [fotoUrls, setFotoUrls] = useState<string[]>([])
  const [subiendoFotos, setSubiendoFotos] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [modoVideo, setModoVideo] = useState<'subir' | 'link'>('subir')
  const [linkVideo, setLinkVideo] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cargando) return
    if (!usuario) {
      router.replace('/ingresar?redirect=/cultura/comparte')
    }
  }, [cargando, usuario, router])

  const subiendoAlgo = subiendoFotos > 0 || subiendoVideo

  async function seleccionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    if (archivos.length === 0) return
    const disponibles = Math.max(0, MAX_FOTOS - fotoUrls.length)
    const aSubir = archivos.slice(0, disponibles)
    setSubiendoFotos((n) => n + aSubir.length)
    for (const archivo of aSubir) {
      try {
        const url = await subirFotoPublicacionCultural(archivo)
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

  function guardarLinkVideo() {
    const url = linkVideo.trim()
    if (!url) return
    setVideoUrl(url)
  }

  async function seleccionarVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoVideo(true)
    setError('')
    try {
      const url = await subirVideoPublicacionCultural(archivo)
      setVideoUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir el video.')
    } finally {
      setSubiendoVideo(false)
      e.target.value = ''
    }
  }

  async function publicar() {
    if (!titulo.trim()) { setError('Escribe un título para tu publicación.'); return }
    if (!departamento) { setError('Selecciona un departamento.'); return }

    setEnviando(true)
    setError('')
    try {
      await crearPublicacionCultural({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        fotoUrls,
        videoUrl: videoUrl || undefined,
        departamento,
        municipio: municipio.trim() || undefined,
      })
      router.push('/cultura/galeria')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos publicar tu historia.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando || !usuario) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          <header className="mb-6">
            <p className="text-xs font-medium tracking-wide text-[#2D6A4F]">🎭 CULTURA</p>
            <h1 className="font-serif text-3xl leading-tight text-[#1B4332]">📸 Comparte tu Territorio</h1>
            <p className="mt-2 max-w-2xl text-[#1A1A1A]/65">
              Cuéntanos sobre un sitio turístico, una tradición o una historia de tu comunidad. No requiere aprobación previa: se publica de inmediato.
            </p>
          </header>

          <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5" htmlFor="titulo">
                Título
              </label>
              <input
                id="titulo"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: El sonido de la marimba en Quibdó"
                maxLength={150}
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5" htmlFor="descripcion">
                Descripción <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
              </label>
              <textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                placeholder="Cuéntanos la historia detrás de este lugar o tradición…"
                maxLength={2000}
                className="w-full resize-none rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5" htmlFor="departamento">
                  Departamento
                </label>
                <select
                  id="departamento"
                  value={departamento}
                  onChange={(e) => { setDepartamento(e.target.value); setMunicipio(''); setMunicipioOtro(false) }}
                  className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                >
                  <option value="">Selecciona un departamento</option>
                  {DEPARTAMENTOS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5" htmlFor="municipio">
                  Municipio <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
                </label>
                {(() => {
                  const muniOpciones = municipiosDe(departamento)
                  const usarTexto = !!departamento && (muniOpciones.length === 0 || municipioOtro)
                  if (usarTexto) {
                    return (
                      <>
                        <input
                          id="municipio"
                          type="text"
                          value={municipio}
                          onChange={(e) => setMunicipio(e.target.value)}
                          placeholder="Ej: Quibdó"
                          maxLength={100}
                          className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                        />
                        {muniOpciones.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { setMunicipioOtro(false); setMunicipio('') }}
                            className="mt-1 text-xs text-[#2D6A4F] hover:underline"
                          >
                            Elegir de la lista
                          </button>
                        )}
                      </>
                    )
                  }
                  return (
                    <select
                      id="municipio"
                      value={municipio}
                      disabled={!departamento}
                      onChange={(e) => {
                        if (e.target.value === '__OTRO__') { setMunicipioOtro(true); setMunicipio('') }
                        else setMunicipio(e.target.value)
                      }}
                      className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 disabled:opacity-50"
                    >
                      <option value="">{departamento ? 'Elige tu municipio…' : 'Primero elige departamento'}</option>
                      {muniOpciones.map((m) => <option key={m} value={m}>{m}</option>)}
                      {departamento && <option value="__OTRO__">Otro (escribir)…</option>}
                    </select>
                  )
                })()}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">
                Fotos <span className="text-[#1A1A1A]/40 font-normal">(opcional, máx. {MAX_FOTOS})</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {fotoUrls.map((url) => (
                  <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#1A1A1A]/12">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Foto de la publicación" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => quitarFoto(url)}
                      className="absolute top-0 right-0 bg-black/60 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-bl"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {subiendoFotos > 0 && Array.from({ length: subiendoFotos }).map((_, i) => (
                  <div key={`subiendo-${i}`} className="w-16 h-16 rounded-lg border border-[#1A1A1A]/12 flex items-center justify-center bg-white">
                    <div className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                  </div>
                ))}
              </div>
              {fotoUrls.length < MAX_FOTOS && (
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={seleccionarFotos}
                  className="text-xs text-[#1A1A1A]/55"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">
                Video corto <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
              </label>

              {videoUrl ? (
                <div className="space-y-2">
                  <ReproductorVideo url={videoUrl} className="max-w-xs" />
                  <button
                    type="button"
                    onClick={() => { setVideoUrl(null); setLinkVideo('') }}
                    className="text-xs text-[#C0392B]"
                  >
                    Quitar video
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex rounded-xl border border-[#1A1A1A]/12 overflow-hidden w-fit">
                    <button
                      type="button"
                      onClick={() => setModoVideo('link')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${modoVideo === 'link' ? 'bg-[#1B4332] text-white' : 'bg-white text-[#1A1A1A]/60 hover:bg-[#F8F5F0]'}`}
                    >
                      🔗 Tengo link
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoVideo('subir')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${modoVideo === 'subir' ? 'bg-[#1B4332] text-white' : 'bg-white text-[#1A1A1A]/60 hover:bg-[#F8F5F0]'}`}
                    >
                      ⬆️ Subir video
                    </button>
                  </div>

                  {modoVideo === 'link' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={linkVideo}
                        onChange={(e) => setLinkVideo(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                      />
                      <button
                        type="button"
                        onClick={guardarLinkVideo}
                        disabled={!linkVideo.trim()}
                        className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </div>
                  ) : subiendoVideo ? (
                    <div className="flex items-center gap-2 text-xs text-[#1A1A1A]/45">
                      <div className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                      Subiendo video…
                    </div>
                  ) : (
                    <input type="file" accept="video/*" onChange={seleccionarVideo} className="text-xs text-[#1A1A1A]/55" />
                  )}
                  <p className="mt-1 text-xs text-[#1A1A1A]/40">
                    {modoVideo === 'link'
                      ? 'Pega el link de YouTube, Facebook, TikTok, Vimeo o Instagram — no ocupa espacio de almacenamiento.'
                      : 'Sube el archivo de video directamente (usa más espacio de almacenamiento).'}
                  </p>
                </>
              )}
            </div>

            {error && <p className="text-sm text-[#C0392B]">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.push('/cultura/galeria')}
                className="flex-1 rounded-xl border border-[#1A1A1A]/12 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={publicar}
                disabled={enviando || subiendoAlgo}
                className="flex-1 rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando ? 'Publicando…' : subiendoAlgo ? 'Subiendo…' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
