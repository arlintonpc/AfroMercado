'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import { CATEGORIAS_CULTURA } from '@/lib/data/culturaCategorias'
import {
  misEventosCultura,
  crearEventoCultura,
  actualizarEventoCultura,
  crearEntradaCultura,
  eliminarEntradaCultura,
  subirFotoEvento,
  subirVideoEvento,
  type EventoCultural,
} from '@/lib/api/cultura'

const SelectorUbicacionMapa = dynamic(() => import('@/components/cultura/SelectorUbicacionMapa'), { ssr: false })

const MAX_FOTOS_GALERIA = 8

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Gestión de boletería de un evento ───────────────────────── */
function GestionEntradas({ evento, onCambio }: { evento: EventoCultural; onCambio: () => void }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [cupo, setCupo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function agregar(ev: React.FormEvent) {
    ev.preventDefault()
    if (guardando) return
    setError(null)
    if (!nombre.trim() || precio === '') {
      setError('Escribe el nombre y el precio de la entrada.')
      return
    }
    setGuardando(true)
    try {
      await crearEntradaCultura(evento.id, {
        nombre: nombre.trim(),
        precio: Number(precio),
        cupo: cupo === '' ? null : Number(cupo),
      })
      setNombre(''); setPrecio(''); setCupo('')
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear la entrada.')
    } finally {
      setGuardando(false)
    }
  }

  async function quitar(id: number) {
    await eliminarEntradaCultura(id)
    onCambio()
  }

  return (
    <div className="mt-3 rounded-xl bg-[#F7F5F2] p-3">
      <p className="text-sm font-semibold text-[#1B4332]">Boletería</p>
      {(evento.entradas ?? []).length === 0 ? (
        <p className="mt-1 text-xs text-[#1A1A1A]/55">Sin entradas. El evento es solo informativo hasta que agregues una.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {(evento.entradas ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
              <span className="text-[#1A1A1A]/80">
                {e.nombre} · {Number(e.precio) === 0 ? 'Gratis' : `$${Number(e.precio).toLocaleString('es-CO')}`}
                {e.cupo != null && <span className="text-[#1A1A1A]/45"> · cupo {e.cupo} (vendidas {e.vendidas})</span>}
              </span>
              <button onClick={() => quitar(e.id)} className="text-xs text-[#C0392B] hover:underline" aria-label={`Eliminar ${e.nombre}`}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={agregar} className="mt-2 flex flex-wrap items-end gap-2">
        <input
          type="text" placeholder="Nombre de la entrada" value={nombre} onChange={(e) => setNombre(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
        />
        <input
          type="number" min={0} placeholder="Precio" value={precio} onChange={(e) => setPrecio(e.target.value)}
          className="w-28 rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
        />
        <input
          type="number" min={1} placeholder="Cupo (opc.)" value={cupo} onChange={(e) => setCupo(e.target.value)}
          className="w-28 rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={guardando} className="rounded-full bg-[#2D6A4F] px-4 py-2 text-sm text-white disabled:opacity-60">
          {guardando ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
      {error && <p role="alert" className="mt-1 text-xs text-[#C0392B]">{error}</p>}
    </div>
  )
}

export default function ComercianteCulturaPage() {
  const [eventos, setEventos] = useState<EventoCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const formRef = useRef<HTMLFormElement>(null)

  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [titulo, setTitulo] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [lugar, setLugar] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  // Media
  const [portadaUrl, setPortadaUrl] = useState<string | null>(null)
  const [subiendoPortada, setSubiendoPortada] = useState(false)
  const [fotos, setFotos] = useState<string[]>([])
  const [subiendoFotos, setSubiendoFotos] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [modoVideo, setModoVideo] = useState<'subir' | 'link'>('subir')
  const [linkVideo, setLinkVideo] = useState('')

  // Ubicación
  const [latitud, setLatitud] = useState<number | null>(null)
  const [longitud, setLongitud] = useState<number | null>(null)

  // Patrimonio
  const [patrimonio, setPatrimonio] = useState(false)
  const [patrimonioNota, setPatrimonioNota] = useState('')

  const subiendoAlgo = subiendoPortada || subiendoFotos > 0 || subiendoVideo

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setEventos(await misEventosCultura())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar tus eventos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function limpiarFormulario() {
    setEditandoId(null)
    setTitulo(''); setDepartamento(''); setMunicipio(''); setCategoria('')
    setFechaInicio(''); setFechaFin(''); setLugar(''); setDescripcion('')
    setPortadaUrl(null)
    setFotos([])
    setVideoUrl(null); setModoVideo('subir'); setLinkVideo('')
    setLatitud(null); setLongitud(null)
    setPatrimonio(false); setPatrimonioNota('')
    setErrorForm(null)
  }

  function iniciarEdicion(evento: EventoCultural) {
    setEditandoId(evento.id)
    setTitulo(evento.titulo)
    setDepartamento(evento.departamento)
    setMunicipio(evento.municipio)
    setCategoria(evento.categoria ?? '')
    setFechaInicio(evento.fechaInicio ? evento.fechaInicio.slice(0, 10) : '')
    setFechaFin(evento.fechaFin ? evento.fechaFin.slice(0, 10) : '')
    setLugar(evento.lugar ?? '')
    setDescripcion(evento.descripcion ?? '')
    setPortadaUrl(evento.portadaUrl ?? null)
    setFotos(Array.isArray(evento.fotos) ? evento.fotos : [])
    setVideoUrl(evento.videoUrl ?? null)
    setModoVideo('link')
    setLinkVideo(evento.videoUrl ?? '')
    setLatitud(evento.latitud ?? null)
    setLongitud(evento.longitud ?? null)
    setPatrimonio(Boolean(evento.patrimonio))
    setPatrimonioNota(evento.patrimonioNota ?? '')
    setErrorForm(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function seleccionarPortada(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoPortada(true)
    setErrorForm(null)
    try {
      const url = await subirFotoEvento(archivo)
      setPortadaUrl(url)
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No pudimos subir la portada.')
    } finally {
      setSubiendoPortada(false)
      e.target.value = ''
    }
  }

  async function seleccionarFotosGaleria(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    if (archivos.length === 0) return
    const disponibles = Math.max(0, MAX_FOTOS_GALERIA - fotos.length)
    const aSubir = archivos.slice(0, disponibles)
    setSubiendoFotos((n) => n + aSubir.length)
    for (const archivo of aSubir) {
      try {
        const url = await subirFotoEvento(archivo)
        setFotos((prev) => (prev.length < MAX_FOTOS_GALERIA ? [...prev, url] : prev))
      } catch (err) {
        setErrorForm(err instanceof Error ? err.message : 'No pudimos subir una foto.')
      } finally {
        setSubiendoFotos((n) => Math.max(0, n - 1))
      }
    }
    e.target.value = ''
  }

  function quitarFotoGaleria(url: string) {
    setFotos((prev) => prev.filter((u) => u !== url))
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
    setErrorForm(null)
    try {
      const url = await subirVideoEvento(archivo)
      setVideoUrl(url)
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No pudimos subir el video.')
    } finally {
      setSubiendoVideo(false)
      e.target.value = ''
    }
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault()
    if (creando) return
    setErrorForm(null)
    if (!titulo.trim() || !departamento || !municipio || !fechaInicio) {
      setErrorForm('Completa título, departamento, municipio y fecha de inicio.')
      return
    }
    if (patrimonio && !patrimonioNota.trim()) {
      setErrorForm('Cuéntanos por qué es patrimonio cultural (ej: Patrimonio Inmaterial de la Humanidad UNESCO).')
      return
    }
    setCreando(true)
    try {
      const datos = {
        titulo: titulo.trim(),
        departamento,
        municipio,
        fechaInicio,
        categoria: categoria || undefined,
        fechaFin: fechaFin || undefined,
        lugar: lugar || undefined,
        descripcion: descripcion || undefined,
        portadaUrl: portadaUrl || undefined,
        fotos,
        videoUrl: videoUrl || undefined,
        latitud: latitud ?? undefined,
        longitud: longitud ?? undefined,
        patrimonio,
        patrimonioNota: patrimonio ? (patrimonioNota.trim() || undefined) : undefined,
      }
      if (editandoId) {
        await actualizarEventoCultura(editandoId, datos)
      } else {
        await crearEventoCultura(datos)
      }
      limpiarFormulario()
      await cargar()
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'No pudimos guardar el evento.')
    } finally {
      setCreando(false)
    }
  }

  async function togglePublicar(evento: EventoCultural) {
    const nuevo = evento.estado === 'PUBLICADO' ? 'BORRADOR' : 'PUBLICADO'
    await actualizarEventoCultura(evento.id, { estado: nuevo })
    await cargar()
  }

  async function posponerEvento(evento: EventoCultural) {
    if (!window.confirm(`¿Posponer "${evento.titulo}"? Avisaremos a los compradores con reserva activa.`)) return
    await actualizarEventoCultura(evento.id, { estado: 'POSPUESTO' })
    await cargar()
  }

  async function cancelarEvento(evento: EventoCultural) {
    if (!window.confirm(`¿Cancelar "${evento.titulo}"? Avisaremos a los compradores con reserva activa.`)) return
    await actualizarEventoCultura(evento.id, { estado: 'CANCELADO' })
    await cargar()
  }

  async function reactivarEvento(evento: EventoCultural) {
    await actualizarEventoCultura(evento.id, { estado: 'PUBLICADO' })
    await cargar()
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-5">
        <h1 className="font-serif text-3xl text-[#2D6A4F]">🎭 Cultura</h1>
        <p className="mt-1 text-[#1A1A1A]/65">Publica las fiestas y eventos de tu comunidad, y vende entradas.</p>
      </header>

      <form ref={formRef} onSubmit={guardar} className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-[#1B4332]">{editandoId ? 'Editar evento' : 'Nuevo evento'}</p>
          {editandoId && (
            <button type="button" onClick={limpiarFormulario} className="text-xs font-semibold text-[#1A1A1A]/50 hover:underline">
              Cancelar edición
            </button>
          )}
        </div>
        <CampoTexto label="Nombre del evento" name="titulo" placeholder="Ej: Fiestas de San Pacho" value={titulo} onChange={setTitulo} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoSelect
            label="Departamento" name="departamento" placeholder="Elige"
            value={departamento}
            onChange={(v) => { setDepartamento(v); setMunicipio('') }}
            opciones={DEPARTAMENTOS.map((d) => ({ valor: d, etiqueta: d }))}
          />
          <CampoSelect
            label="Municipio" name="municipio" placeholder={departamento ? 'Elige' : 'Primero el departamento'}
            value={municipio} onChange={setMunicipio}
            opciones={municipiosDe(departamento).map((m) => ({ valor: m, etiqueta: m }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto label="Fecha de inicio" name="fechaInicio" type="date" value={fechaInicio} onChange={setFechaInicio} />
          <CampoTexto label="Fecha de fin (opcional)" name="fechaFin" type="date" value={fechaFin} onChange={setFechaFin} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoSelect
            label="Categoría" name="categoria" placeholder="Opcional"
            value={categoria} onChange={setCategoria}
            opciones={CATEGORIAS_CULTURA.map((c) => ({ valor: c, etiqueta: c }))}
          />
          <CampoTexto label="Lugar (opcional)" name="lugar" placeholder="Ej: Plaza central" value={lugar} onChange={setLugar} />
        </div>
        <CampoArea label="Descripción" name="descripcion" rows={3} placeholder="Cuenta de qué se trata la fiesta." value={descripcion} onChange={setDescripcion} hint="Opcional." />

        {/* Portada */}
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">
            Portada <span className="text-[#1A1A1A]/40 font-normal">(opcional, una sola imagen)</span>
          </label>
          {portadaUrl ? (
            <div className="relative w-full max-w-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portadaUrl} alt="Portada del evento" className="w-full h-40 rounded-xl object-cover border border-[#1A1A1A]/12" />
              <button
                type="button"
                onClick={() => setPortadaUrl(null)}
                className="absolute top-2 right-2 bg-black/60 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full"
                aria-label="Quitar portada"
              >
                ×
              </button>
            </div>
          ) : subiendoPortada ? (
            <div className="flex items-center gap-2 text-xs text-[#1A1A1A]/45">
              <div className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
              Subiendo portada…
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={seleccionarPortada} className="text-xs text-[#1A1A1A]/55" />
          )}
        </div>

        {/* Galería de fotos */}
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">
            Galería de fotos <span className="text-[#1A1A1A]/40 font-normal">(opcional, máx. {MAX_FOTOS_GALERIA})</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {fotos.map((url) => (
              <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#1A1A1A]/12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Foto del evento" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => quitarFotoGaleria(url)}
                  className="absolute top-0 right-0 bg-black/60 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-bl"
                  aria-label="Quitar foto"
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
          {fotos.length < MAX_FOTOS_GALERIA && (
            <input type="file" accept="image/*" multiple onChange={seleccionarFotosGaleria} className="text-xs text-[#1A1A1A]/55" />
          )}
        </div>

        {/* Video */}
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">
            Video <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
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

        {/* Ubicación */}
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">
            Ubicación en el mapa <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
          </label>
          <SelectorUbicacionMapa
            latitud={latitud}
            longitud={longitud}
            onCambiar={(lat, lon) => { setLatitud(lat); setLongitud(lon) }}
          />
        </div>

        {/* Patrimonio */}
        <div className="rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/5 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={patrimonio}
              onChange={(e) => setPatrimonio(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#D4A017] flex-shrink-0"
            />
            <span className="text-sm text-[#1A1A1A]/80">Es patrimonio cultural</span>
          </label>
          {patrimonio && (
            <div className="mt-2">
              <CampoTexto
                label="Nota de patrimonio"
                name="patrimonioNota"
                placeholder="Ej: Patrimonio Inmaterial de la Humanidad UNESCO"
                value={patrimonioNota}
                onChange={setPatrimonioNota}
              />
            </div>
          )}
        </div>

        {errorForm && <p role="alert" className="text-sm text-[#C0392B]">{errorForm}</p>}
        <button type="submit" disabled={creando || subiendoAlgo} className="w-full rounded-full bg-[#1B4332] py-2.5 text-sm text-white disabled:opacity-60">
          {creando ? 'Guardando…' : subiendoAlgo ? 'Subiendo…' : editandoId ? 'Guardar cambios' : 'Crear evento'}
        </button>
      </form>

      <h2 className="mb-3 font-serif text-xl text-[#1B4332]">Tus eventos</h2>

      {cargando ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#1A1A1A]/5" />)}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/5 p-5 text-center text-[#C0392B]">
          {error}
        </div>
      ) : eventos.length === 0 ? (
        <p className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-8 text-center text-[#1A1A1A]/60">
          Aún no has creado eventos. ¡Crea el primero arriba!
        </p>
      ) : (
        <div className="space-y-4">
          {eventos.map((ev) => (
            <div key={ev.id} className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex gap-3">
                  {ev.portadaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.portadaUrl} alt="" className="hidden sm:block w-16 h-16 rounded-lg object-cover border border-[#1A1A1A]/8 flex-shrink-0" />
                  )}
                  <div>
                    <h3 className="font-serif text-lg text-[#1B4332]">{ev.titulo}</h3>
                    <p className="text-sm text-[#1A1A1A]/60">
                      {fmtFecha(ev.fechaInicio)} · {ev.municipio}, {ev.departamento}
                    </p>
                    {ev.patrimonio && (
                      <p className="mt-0.5 text-xs font-medium text-[#8A5A00]">🏛️ Patrimonio cultural</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    ev.estado === 'PUBLICADO' ? 'bg-[#EAF3DE] text-[#3B6D11]'
                    : ev.estado === 'POSPUESTO' ? 'bg-[#FCEFCB] text-[#8A5A00]'
                    : ev.estado === 'CANCELADO' ? 'bg-[#F8D7DA] text-[#842029]'
                    : 'bg-[#1A1A1A]/8 text-[#1A1A1A]/60'
                  }`}>
                    {ev.estado === 'PUBLICADO' ? 'Publicado'
                      : ev.estado === 'BORRADOR' ? 'Borrador'
                      : ev.estado === 'POSPUESTO' ? 'Pospuesto'
                      : ev.estado === 'CANCELADO' ? 'Cancelado'
                      : ev.estado === 'FINALIZADO' ? 'Finalizado'
                      : ev.estado}
                  </span>
                  <button
                    onClick={() => iniciarEdicion(ev)}
                    className="rounded-full border border-[#1B4332] px-3 py-1 text-xs text-[#1B4332] hover:bg-[#1B4332]/10"
                  >
                    Editar
                  </button>
                  {(ev.estado === 'BORRADOR' || ev.estado === 'PUBLICADO') && (
                    <button
                      onClick={() => togglePublicar(ev)}
                      className="rounded-full border border-[#2D6A4F] px-3 py-1 text-xs text-[#2D6A4F] hover:bg-[#2D6A4F]/10"
                    >
                      {ev.estado === 'PUBLICADO' ? 'Despublicar' : 'Publicar'}
                    </button>
                  )}
                  {ev.estado === 'PUBLICADO' && (
                    <button
                      onClick={() => posponerEvento(ev)}
                      className="rounded-full border border-[#8A5A00] px-3 py-1 text-xs text-[#8A5A00] hover:bg-[#FCEFCB]"
                    >
                      Posponer
                    </button>
                  )}
                  {ev.estado === 'POSPUESTO' && (
                    <button
                      onClick={() => reactivarEvento(ev)}
                      className="rounded-full border border-[#2D6A4F] px-3 py-1 text-xs text-[#2D6A4F] hover:bg-[#2D6A4F]/10"
                    >
                      Reactivar
                    </button>
                  )}
                  {(ev.estado === 'BORRADOR' || ev.estado === 'PUBLICADO' || ev.estado === 'POSPUESTO') && (
                    <button
                      onClick={() => cancelarEvento(ev)}
                      className="rounded-full border border-[#842029] px-3 py-1 text-xs text-[#842029] hover:bg-[#F8D7DA]"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
              <GestionEntradas evento={ev} onCambio={cargar} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
