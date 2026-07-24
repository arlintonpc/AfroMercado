'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { obtenerMiComercio, listarMisProductos, type Comercio, type ProductoComerciante } from '@/components/comerciante/api'
import {
  listarMisPublicacionesVitrina,
  actualizarMiPublicacionVitrina,
  subirFotoPublicacionCultural,
  subirVideoVitrina,
  type ModuloOrigenVitrina,
  type PublicacionCultural,
} from '@/lib/api/cultura'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import RecortadorVideoModal from '@/components/comerciante/RecortadorVideoModal'

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

export default function EditarVitrinaPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id)

  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [productos, setProductos] = useState<ProductoComerciante[]>([])
  const [publicacion, setPublicacion] = useState<PublicacionCultural | null>(null)

  const [cargando, setCargando] = useState(true)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [moduloOrigen, setModuloOrigen] = useState<ModuloOrigenVitrina | ''>('')
  const [productoId, setProductoId] = useState<string>('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')

  // Media
  const [fotoUrls, setFotoUrls] = useState<string[]>([])
  const [videoPosterUrl, setVideoPosterUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [subiendoFotos, setSubiendoFotos] = useState(0)
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [archivoParaRecortar, setArchivoParaRecortar] = useState<File | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const subiendoAlgo = subiendoFotos > 0 || subiendoVideo

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setErrorGlobal(null)
    try {
      const c = await obtenerMiComercio()
      setComercio(c)
      if (!c) throw new Error('Todavía no tienes una tienda registrada.')

      const [misProds, resPubs] = await Promise.all([
        listarMisProductos(),
        listarMisPublicacionesVitrina({ page: 1 }),
      ])

      setProductos(misProds.filter((p) => p.activo))

      let pub = resPubs.items.find((p) => p.id === id)
      let page = 2
      const tamanoPagina = resPubs.items.length || 20
      const totalPaginas = Math.ceil(resPubs.total / tamanoPagina)
      while (!pub && page <= totalPaginas) {
        const next = await listarMisPublicacionesVitrina({ page })
        pub = next.items.find((p) => p.id === id)
        page++
      }

      if (!pub) {
        throw new Error('Publicación no encontrada.')
      }

      setPublicacion(pub)
      setTitulo(pub.titulo || '')
      setDescripcion(pub.descripcion || '')
      setModuloOrigen((pub.moduloOrigen as ModuloOrigenVitrina) || '')
      setProductoId(pub.producto?.id ? String(pub.producto.id) : '')
      setDepartamento(pub.departamento || c.departamento || '')
      setMunicipio(pub.municipio || c.municipio || '')
      setFotoUrls(pub.fotoUrls || [])
      setVideoPosterUrl(pub.videoPosterUrl || '')
      setVideoUrl(pub.videoUrl || '')
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : 'No pudimos cargar los datos.')
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  async function seleccionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    if (archivos.length === 0) return
    setSubiendoFotos((n) => n + archivos.length)
    for (const archivo of archivos) {
      try {
        const url = await subirFotoPublicacionCultural(archivo)
        setFotoUrls((prev) => [...prev, url])
        if (!videoPosterUrl) setVideoPosterUrl(url)
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

    const tempVideo = document.createElement('video')
    tempVideo.preload = 'metadata'
    tempVideo.src = URL.createObjectURL(archivo)
    tempVideo.onloadedmetadata = () => {
      URL.revokeObjectURL(tempVideo.src)
      if (tempVideo.duration > MAX_SEGUNDOS_VIDEO) {
        setArchivoParaRecortar(archivo)
      } else {
        ejecutarSubidaVideo(archivo)
      }
    }
    tempVideo.onerror = () => {
      ejecutarSubidaVideo(archivo)
    }
    e.target.value = ''
  }

  async function ejecutarSubidaVideo(archivo: File, recorte?: { inicioSegundos: number; finSegundos: number }) {
    setSubiendoVideo(true)
    setError('')
    try {
      const subido = await subirVideoVitrina(archivo, recorte)
      setVideoUrl(subido.url)
      setArchivoParaRecortar(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No pudimos subir el video.'
      setError(msg)
      throw new Error(msg)
    } finally {
      setSubiendoVideo(false)
    }
  }

  async function guardar() {
    if (enviando || subiendoAlgo) return
    if (!titulo.trim()) {
      setError('Escribe un título para tu publicación.')
      return
    }

    setEnviando(true)
    setError('')
    try {
      await actualizarMiPublicacionVitrina(id, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        moduloOrigen: moduloOrigen || undefined,
        productoId: productoId ? Number(productoId) : undefined,
        fotoUrls,
        videoUrl: videoUrl.trim() || undefined,
        videoPosterUrl: videoPosterUrl.trim() || undefined,
        departamento: departamento || undefined,
        municipio: municipio || undefined,
      })
      router.push('/comerciante/vitrina')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos actualizar tu publicación.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (errorGlobal || !publicacion) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div role="alert" className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/5 p-5 text-center text-[#C0392B]">
          {errorGlobal || 'Publicación no encontrada.'}
        </div>
        <div className="mt-4 text-center">
          <Link href="/comerciante/vitrina">
            <Button variant="secondary">Volver a Vitrina</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-5 flex items-center gap-4">
        <Link
          href="/comerciante/vitrina"
          className="rounded-full bg-white p-2 shadow-sm border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-[#1A1A1A]">Editar Publicación</h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Actualiza las imágenes, video, ubicación e información de tu publicación.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 space-y-5">
        {/* 1. SECCIÓN MULTIMEDIA (VIDEO Y FOTOS) */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-[#1A1A1A] border-b pb-1">📷 Archivos y Multimedia</h3>

          {/* Video Actual / Reemplazar */}
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EBE5DA] space-y-2">
            <label className="block text-xs font-bold text-[#1A1A1A]">Video de la publicación</label>
            {videoUrl ? (
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-gray-200">
                <span className="text-xs font-medium text-[#2D6A4F] truncate">{videoUrl}</span>
                <button
                  type="button"
                  onClick={() => setVideoUrl('')}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  Cambiar video
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="video/*"
                  onChange={seleccionarVideo}
                  disabled={subiendoVideo}
                  className="text-xs text-[#1A1A1A] file:mr-3 file:py-1.5 file:px-3.5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#1B4332] file:text-white hover:file:bg-[#2D6A4F] cursor-pointer"
                />
                <div className="text-xs text-gray-500">O pega el enlace directo de un video (Cloudinary, MP4, etc.):</div>
                <CampoTexto
                  label=""
                  name="videoUrl"
                  placeholder="https://ejemplo.com/mi-video.mp4"
                  value={videoUrl}
                  onChange={setVideoUrl}
                />
              </div>
            )}
          </div>

          {/* Galería de Fotos */}
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EBE5DA] space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#1A1A1A]">Fotografías / Miniatura</label>
              <label className="cursor-pointer text-xs font-bold text-[#2D6A4F] hover:underline">
                + Agregar fotos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={seleccionarFotos}
                  disabled={subiendoFotos > 0}
                  className="hidden"
                />
              </label>
            </div>

            {fotoUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {fotoUrls.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-300 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`foto-${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => quitarFoto(url)}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-[10px] hover:bg-rose-600 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No hay fotos asociadas.</p>
            )}
          </div>
        </div>

        {/* 2. SECCIÓN DE INFORMACIÓN BÁSICA */}
        <div className="space-y-3 pt-2">
          <h3 className="font-bold text-sm text-[#1A1A1A] border-b pb-1">✏️ Información General</h3>

          <CampoTexto
            label="Título de la publicación"
            name="titulo"
            placeholder="Ej: Así es un día en nuestra finca agroforestal"
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
          />
        </div>

        {/* 3. SECCIÓN DE UBICACIÓN TERRITORIAL */}
        <div className="space-y-3 pt-2">
          <h3 className="font-bold text-sm text-[#1A1A1A] border-b pb-1">📍 Ubicación Territorial</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoSelect
              label="Departamento"
              name="departamento"
              value={departamento}
              onChange={(v) => {
                setDepartamento(v)
                setMunicipio('')
              }}
              opciones={DEPARTAMENTOS.map((d) => ({ valor: d, etiqueta: d }))}
            />

            <CampoSelect
              label="Municipio"
              name="municipio"
              value={municipio}
              onChange={setMunicipio}
              disabled={!departamento}
              opciones={municipiosDe(departamento).map((m) => ({ valor: m, etiqueta: m }))}
            />
          </div>
        </div>

        {/* 4. SECCIÓN DE MÓDULO Y PRODUCTO VINCULADO */}
        <div className="space-y-3 pt-2">
          <h3 className="font-bold text-sm text-[#1A1A1A] border-b pb-1">🛒 Comercio y Oferta Comercial</h3>

          <CampoSelect
            label="Módulo relacionado"
            name="moduloOrigen"
            value={moduloOrigen}
            onChange={(v) => setModuloOrigen(v as ModuloOrigenVitrina | '')}
            opciones={OPCIONES_MODULO.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
            hint="Ayuda a clasificar tu publicación en las pestañas temáticas."
          />

          {productos.length > 0 && (
            <CampoSelect
              label="Producto asociado (opcional)"
              name="productoId"
              value={productoId}
              onChange={setProductoId}
              opciones={[
                { valor: '', etiqueta: 'Ninguno' },
                ...productos.map((p) => ({ valor: String(p.id), etiqueta: `${p.nombre} - $${p.precio}` })),
              ]}
              hint="Muestra una tarjeta de compra flotante sobre el video o foto."
            />
          )}
        </div>

        {error && <p role="alert" className="text-sm font-semibold text-[#C0392B]">{error}</p>}

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#1A1A1A]/10">
          <Link href="/comerciante/vitrina">
            <Button variant="secondary" type="button" disabled={enviando}>
              Cancelar
            </Button>
          </Link>
          <Button variant="primary" type="button" onClick={guardar} loading={enviando || subiendoAlgo}>
            {subiendoAlgo ? 'Subiendo archivos...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {archivoParaRecortar && (
        <RecortadorVideoModal
          archivo={archivoParaRecortar}
          duracionMaxima={MAX_SEGUNDOS_VIDEO}
          onConfirmar={(recorte) => ejecutarSubidaVideo(archivoParaRecortar, recorte)}
          onCancelar={() => setArchivoParaRecortar(null)}
        />
      )}
    </div>
  )
}
