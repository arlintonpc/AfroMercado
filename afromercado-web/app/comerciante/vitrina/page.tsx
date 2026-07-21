'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { obtenerMiComercio, type Comercio } from '@/components/comerciante/api'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'
import {
  crearPublicacionCultural,
  subirFotoPublicacionCultural,
  subirVideoVitrina,
  type ModuloOrigenVitrina,
  type VideoVitrinaSubido,
} from '@/lib/api/cultura'

const MAX_FOTOS = 6
const MAX_SEGUNDOS_VIDEO = 45

const OPCIONES_MODULO: Array<{ valor: ModuloOrigenVitrina | ''; etiqueta: string }> = [
  { valor: '', etiqueta: 'Ninguno en particular' },
  { valor: 'PEDIDO', etiqueta: 'Marketplace (productos)' },
  { valor: 'EXPRESS', etiqueta: 'Express / Sabores' },
  { valor: 'HOTEL', etiqueta: 'Hoteles' },
  { valor: 'TOUR', etiqueta: 'Tours' },
  { valor: 'TRANSPORTE', etiqueta: 'Transporte' },
  { valor: 'AGRO', etiqueta: 'Agro' },
]

export default function ComercianteVitrinaPage() {
  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [cargandoComercio, setCargandoComercio] = useState(true)
  const [errorComercio, setErrorComercio] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [moduloOrigen, setModuloOrigen] = useState<ModuloOrigenVitrina | ''>('')

  const [fotoUrls, setFotoUrls] = useState<string[]>([])
  const [subiendoFotos, setSubiendoFotos] = useState(0)
  const [video, setVideo] = useState<VideoVitrinaSubido | null>(null)
  const [videoExternoUrl, setVideoExternoUrl] = useState('')
  const [subiendoVideo, setSubiendoVideo] = useState(false)

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  const subiendoAlgo = subiendoFotos > 0 || subiendoVideo

  const cargarComercio = useCallback(async () => {
    setCargandoComercio(true)
    setErrorComercio(null)
    try {
      const c = await obtenerMiComercio()
      setComercio(c)
      if (!c) setErrorComercio('Todavía no tienes una tienda registrada.')
    } catch (e) {
      setErrorComercio(e instanceof Error ? e.message : 'No pudimos cargar los datos de tu tienda.')
    } finally {
      setCargandoComercio(false)
    }
  }, [])

  useEffect(() => {
    cargarComercio()
  }, [cargarComercio])

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

  async function seleccionarVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoVideo(true)
    setError('')
    try {
      const subido = await subirVideoVitrina(archivo)
      setVideo(subido)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir el video.')
    } finally {
      setSubiendoVideo(false)
      e.target.value = ''
    }
  }

  function quitarVideo() {
    setVideo(null)
  }

  function limpiarFormulario() {
    setTitulo('')
    setDescripcion('')
    setModuloOrigen('')
    setFotoUrls([])
    setVideo(null)
    setVideoExternoUrl('')
    setError('')
  }

  async function publicar() {
    if (enviando || subiendoAlgo) return
    if (!comercio) { setError('No pudimos identificar tu tienda. Recarga la página.'); return }
    if (!titulo.trim()) { setError('Escribe un título para tu publicación.'); return }
    const departamentoComercio = comercio.departamento
    if (!departamentoComercio) {
      setError('Tu tienda no tiene departamento registrado. Actualízalo en "Mi tienda" antes de publicar.')
      return
    }
    const comercioId = comercio.id
    const municipioComercio = comercio.municipio

    const finalVideoUrl = videoExternoUrl.trim() || video?.url || undefined

    setEnviando(true)
    setError('')
    setExito(false)
    try {
      await crearPublicacionCultural({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        fotoUrls,
        videoUrl: finalVideoUrl,
        videoPosterUrl: video?.posterUrl || undefined,
        videoDuracionSegundos: video?.duracionSegundos || undefined,
        videoPublicId: video?.publicId || undefined,
        departamento: departamentoComercio,
        municipio: municipioComercio || undefined,
        comercioId,
        moduloOrigen: moduloOrigen || undefined,
      })
      limpiarFormulario()
      setExito(true)
      setTimeout(() => setExito(false), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos publicar tu video.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargandoComercio) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="h-40 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-5">
        <h1 className="font-serif text-3xl text-[#2D6A4F]">🎥 Vitrina de video</h1>
        <p className="mt-1 text-[#1A1A1A]/65">
          Comparte un video corto o fotos de tu negocio — aparece en la Vitrina pública que ven todos los usuarios de Teravia,
          con un botón directo hacia tu tienda o tu WhatsApp.
        </p>
      </header>

      {errorComercio && !comercio ? (
        <div role="alert" className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/5 p-5 text-center text-[#C0392B]">
          {errorComercio}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 space-y-4">
          {exito && (
            <div className="rounded-xl border border-[#2D6A4F]/20 bg-[#EAF3DE] px-4 py-3 text-sm font-semibold text-[#1B4332]">
              ¡Publicado! Ya está visible en la{' '}
              <Link href="/vitrina" className="underline">
                Vitrina de video
              </Link>
              .
            </div>
          )}

          <CampoTexto
            label="Título"
            name="titulo"
            placeholder="Ej: Así es una noche en nuestro hotel"
            value={titulo}
            onChange={setTitulo}
          />

          <CampoArea
            label="Descripción"
            name="descripcion"
            placeholder="Cuéntales a tus clientes qué van a ver…"
            value={descripcion}
            onChange={setDescripcion}
            rows={4}
            hint="Opcional."
          />

          <CampoSelect
            label="Módulo relacionado"
            name="moduloOrigen"
            value={moduloOrigen}
            onChange={(v) => setModuloOrigen(v as ModuloOrigenVitrina | '')}
            opciones={OPCIONES_MODULO.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
            hint="Opcional — ayuda a los usuarios a saber de qué servicio se trata."
          />

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
              Video corto <span className="text-[#1A1A1A]/40 font-normal">(opcional, máx. {MAX_SEGUNDOS_VIDEO} segundos)</span>
            </label>

            {video ? (
              <div className="space-y-2">
                <ReproductorVideo url={video.url} className="max-w-xs" />
                <button type="button" onClick={quitarVideo} className="text-xs text-[#C0392B]">
                  Quitar video
                </button>
              </div>
            ) : subiendoVideo ? (
              <div className="flex items-center gap-2 text-xs text-[#1A1A1A]/45">
                <div className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                Subiendo video…
              </div>
            ) : (
              <>
                <input type="file" accept="video/*" onChange={seleccionarVideo} className="text-xs text-[#1A1A1A]/55 mb-2 block w-full" disabled={!!videoExternoUrl} />
                {!videoExternoUrl && (
                  <p className="mb-4 text-xs text-[#1A1A1A]/40">
                    Sube un video de hasta {MAX_SEGUNDOS_VIDEO} segundos y 45MB.
                  </p>
                )}
                
                <div className="flex items-center gap-4 my-2">
                  <div className="h-px bg-[#1A1A1A]/10 flex-1"></div>
                  <span className="text-xs text-[#1A1A1A]/40 font-medium uppercase tracking-wider">o pega un enlace</span>
                  <div className="h-px bg-[#1A1A1A]/10 flex-1"></div>
                </div>

                <CampoTexto
                  label="Enlace del video"
                  name="videoExternoUrl"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoExternoUrl}
                  onChange={setVideoExternoUrl}
                  hint="Copia el enlace de un video de YouTube, TikTok, Instagram o Facebook."
                />
              </>
            )}
          </div>

          {error && <p role="alert" className="text-sm text-[#C0392B]">{error}</p>}

          <button
            type="button"
            onClick={publicar}
            disabled={enviando || subiendoAlgo || !comercio}
            className="w-full rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? 'Publicando…' : subiendoAlgo ? 'Subiendo…' : 'Publicar en la Vitrina'}
          </button>
        </div>
      )}
    </div>
  )
}
