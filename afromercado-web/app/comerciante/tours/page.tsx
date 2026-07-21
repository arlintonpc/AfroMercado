'use client'

import { useEffect, useRef, useState } from 'react'
import { obtenerMiTour, actualizarMiTour, reservasOperadorTour, cambiarEstadoReservaTour, subirFotosTour, subirVideoTour, quitarVideoTour, guardarVideoLinkTour, listarCuponesTour, crearCuponTour, eliminarCuponTour, obtenerEstadisticasTour, crearLugarTour, actualizarLugarTour, eliminarLugarTour, reordenarLugaresTour, subirFotosLugarTour, eliminarMediaLugarTour, subirVideoLugarTour, quitarVideoLugarTour, guardarVideoLinkLugarTour, type ConfigTour, type ReservaTour, type EstadoReservaTour, type CuponTour, type EstadisticasTour, type TourLugar, type TourLugarMedia } from '@/lib/api/tour'
import { Switch } from '@/components/ui'
import { formatearPrecio } from '@/lib/formatearPrecio'
import SubidorVideoOLink from '@/components/comerciante/SubidorVideoOLink'
import type { VideoMetaCaptura, VideoEstado } from '@/components/comerciante/api'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

const SERVICIOS_OPCIONES = [
  { key: 'transporte', label: '🚐 Transporte' },
  { key: 'almuerzo',   label: '🍱 Almuerzo' },
  { key: 'guia',       label: '🧭 Guía' },
  { key: 'equipo',     label: '🎒 Equipo' },
  { key: 'foto',       label: '📸 Fotografía' },
  { key: 'seguro',     label: '🛡️ Seguro' },
  { key: 'snacks',     label: '🍎 Snacks' },
  { key: 'audio',      label: '🎧 Audioguía' },
]

const IDIOMAS_OPCIONES = ['Español', 'English', 'Français', 'Português', 'Deutsch']
const IMAGEN_MAX_BYTES = 8 * 1024 * 1024

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:  'bg-amber-100 text-amber-700',
  CONFIRMADA: 'bg-green-100 text-green-700',
  COMPLETADA: 'bg-blue-100 text-blue-700',
  CANCELADA:  'bg-red-100 text-red-600',
  RECHAZADA:  'bg-red-100 text-red-600',
}

const ACCIONES: Record<string, { label: string; estado: EstadoReservaTour }[]> = {
  PENDIENTE:  [{ label: '✅ Confirmar', estado: 'CONFIRMADA' }, { label: '🚫 Rechazar', estado: 'RECHAZADA' }],
  CONFIRMADA: [{ label: '🎉 Completar', estado: 'COMPLETADA' }, { label: '❌ Cancelar', estado: 'CANCELADA' }],
}

type TourTab = 'reservas' | 'ruta' | 'config' | 'cupones' | 'estadisticas'

export default function ComercianteTourPage() {
  const [tab, setTab] = useState<TourTab>('reservas')
  const [tour, setTour] = useState<ConfigTour | null>(null)
  const [reservas, setReservas] = useState<ReservaTour[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendoFotos, setSubiendoFotos] = useState(false)
  const [editConfig, setEditConfig] = useState<Partial<ConfigTour>>({})
  const reservasRef = useRef<ReservaTour[]>([])
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const inputFotosLugarRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [lugares, setLugares] = useState<TourLugar[]>([])
  const [lugarAbiertoId, setLugarAbiertoId] = useState<number | null>(null)
  const [guardandoLugarId, setGuardandoLugarId] = useState<number | null>(null)
  const [subiendoLugarId, setSubiendoLugarId] = useState<number | null>(null)
  const [errorLugar, setErrorLugar] = useState('')
  const [cupones, setCupones]             = useState<CuponTour[]>([])
  const [estadisticas, setEstadisticas]   = useState<EstadisticasTour | null>(null)
  const [cargandoStats, setCargandoStats] = useState(false)
  const [desdeFiltro, setDesdeFiltro] = useState('')
  const [hastaFiltro, setHastaFiltro] = useState('')
  const [nuevoCupon, setNuevoCupon]       = useState({
    codigo: '', tipo: 'PORCENTAJE' as 'PORCENTAJE' | 'VALOR_FIJO',
    valor: '', minimoPersonas: '', usosMaximos: '',
    inicio: new Date().toISOString().split('T')[0],
    fin: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  })
  const [guardandoCupon, setGuardandoCupon] = useState(false)
  const [errorCupon, setErrorCupon]         = useState('')
  const [pendienteEliminarLugar, setPendienteEliminarLugar] = useState<TourLugar | null>(null)
  const [pendienteDesactivarCupon, setPendienteDesactivarCupon] = useState<CuponTour | null>(null)
  const [desactivandoCupon, setDesactivandoCupon] = useState(false)
  const [videoEstadoTour, setVideoEstadoTour] = useState<VideoEstado>({
    videoUrl: null,
    videoPosterUrl: null,
    videoDuracionSegundos: null,
    videoMimeType: null,
  })

  const pendientes = reservas.filter(r => r.estado === 'PENDIENTE')

  useEffect(() => {
    (async () => {
      try {
        const [t, rs] = await Promise.all([obtenerMiTour(), reservasOperadorTour()])
        setTour(t)
        setEditConfig(t)
        setLugares(t.lugares ?? [])
        setReservas(rs)
        reservasRef.current = rs
        setVideoEstadoTour({
          videoUrl: (t as any).videoUrl ?? null,
          videoPosterUrl: (t as any).videoPosterUrl ?? null,
          videoDuracionSegundos: null,
          videoMimeType: null,
        })
      } catch (e) {
        setErrorCarga(e instanceof Error ? e.message : 'No se pudo cargar la información del tour.')
      } finally {
        setCargando(false)
      }
    })()
  }, [])

  // Polling de reservas cada 20s
  useEffect(() => {
    const iv = setInterval(() => {
      reservasOperadorTour().then(nuevas => {
        const prev = reservasRef.current
        const hayNuevasPendientes = nuevas.some(n => n.estado === 'PENDIENTE' && !prev.find(p => p.id === n.id))
        if (hayNuevasPendientes) {
          try {
            const ctx = new AudioContext()
            const beep = (t: number) => {
              const osc = ctx.createOscillator(); const g = ctx.createGain()
              osc.connect(g); g.connect(ctx.destination)
              osc.frequency.value = 660; g.gain.setValueAtTime(0.3, t)
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
              osc.start(t); osc.stop(t + 0.35)
            }
            beep(ctx.currentTime); beep(ctx.currentTime + 0.4); beep(ctx.currentTime + 0.8)
          } catch {}
        }
        reservasRef.current = nuevas
        setReservas(nuevas)
      }).catch(err => {
        console.error('Error al refrescar reservas del tour:', err)
      })
    }, 20000)
    return () => clearInterval(iv)
  }, [])

  async function cargarEstadisticasTour(params?: { desde?: string; hasta?: string }) {
    setCargandoStats(true)
    try {
      const data = await obtenerEstadisticasTour(params)
      setEstadisticas(data)
    } catch {}
    finally { setCargandoStats(false) }
  }

  async function cambiarEstado(id: number, estado: EstadoReservaTour) {
    try {
      await cambiarEstadoReservaTour(id, estado)
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r))
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function confirmarDesactivarCupon() {
    const cupon = pendienteDesactivarCupon
    if (!cupon) return
    setDesactivandoCupon(true)
    try {
      await eliminarCuponTour(cupon.id)
      setCupones(prev => prev.map(x => x.id === cupon.id ? { ...x, activo: false } : x))
    } finally {
      setDesactivandoCupon(false)
      setPendienteDesactivarCupon(null)
    }
  }

  async function eliminarFotoTour(url: string) {
    if (!tour) return
    const fotosAntes = tour.fotos
    const nuevasFotos = fotosAntes.filter(f => f !== url)
    setTour(prev => prev ? { ...prev, fotos: nuevasFotos } : prev)
    setEditConfig(prev => ({ ...prev, fotos: nuevasFotos }))
    try {
      await actualizarMiTour({ fotos: nuevasFotos } as any)
    } catch (e: any) {
      setTour(prev => prev ? { ...prev, fotos: fotosAntes } : prev)
      setEditConfig(prev => ({ ...prev, fotos: fotosAntes }))
      alert(e.message)
    }
  }

  async function subirFotos(archivos: FileList) {
    const files = Array.from(archivos)
    setSubiendoFotos(true)
    try {
      const noImagen = files.find(file => !file.type.startsWith('image/'))
      if (noImagen) throw new Error('Solo puedes subir imagenes.')
      const pesada = files.find(file => file.size > IMAGEN_MAX_BYTES)
      if (pesada) throw new Error(`"${pesada.name}" supera 8 MB. Usa una imagen mas liviana.`)
      const t = await subirFotosTour(archivos)
      setTour(t)
      setEditConfig(prev => ({ ...prev, fotos: t.fotos }))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSubiendoFotos(false)
      if (inputFotoRef.current) inputFotoRef.current.value = ''
    }
  }

  async function guardarConfig() {
    setGuardando(true)
    try {
      const t = await actualizarMiTour(editConfig)
      setTour(t)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleSubirVideoTour(file: File, meta: VideoMetaCaptura): Promise<VideoEstado> {
    const r = await subirVideoTour(file, meta)
    const nuevo: VideoEstado = { videoUrl: r.videoUrl, videoPosterUrl: r.videoPosterUrl ?? null, videoDuracionSegundos: meta.duracionSegundos, videoMimeType: file.type }
    setVideoEstadoTour(nuevo)
    setEditConfig(prev => ({ ...prev, videoUrl: r.videoUrl as any, videoPosterUrl: (r.videoPosterUrl ?? null) as any }))
    return nuevo
  }

  async function handleQuitarVideoTour(): Promise<VideoEstado> {
    await quitarVideoTour()
    const vacio: VideoEstado = { videoUrl: null, videoPosterUrl: null, videoDuracionSegundos: null, videoMimeType: null }
    setVideoEstadoTour(vacio)
    setEditConfig(prev => ({ ...prev, videoUrl: undefined, videoPosterUrl: undefined }))
    return vacio
  }

  async function handleGuardarLinkTour(url: string): Promise<VideoEstado> {
    await guardarVideoLinkTour(url)
    const nuevo: VideoEstado = { videoUrl: url, videoPosterUrl: null, videoDuracionSegundos: null, videoMimeType: null }
    setVideoEstadoTour(nuevo)
    setEditConfig(prev => ({ ...prev, videoUrl: url as any, videoPosterUrl: undefined }))
    return nuevo
  }

  function reemplazarLugares(nuevos: TourLugar[]) {
    setLugares(nuevos)
    setTour(prev => prev ? { ...prev, lugares: nuevos } : prev)
  }

  function actualizarLugarLocal(lugar: TourLugar) {
    reemplazarLugares(lugares.map(item => item.id === lugar.id ? lugar : item))
  }

  function mediaLugar(lugar: TourLugar, tipo: TourLugarMedia['tipo']) {
    return (lugar.media ?? []).filter(m => m.tipo === tipo)
  }

  function videoEstadoLugar(lugar: TourLugar): VideoEstado {
    const video = mediaLugar(lugar, 'VIDEO')[0]
    if (video) {
      return {
        videoUrl: video.url,
        videoPosterUrl: video.posterUrl ?? null,
        videoDuracionSegundos: video.duracionSegundos ?? null,
        videoMimeType: video.mimeType ?? null,
      }
    }
    // fallback: primer VIDEO_LINK (guardado desde tab "Pegar link")
    const link = mediaLugar(lugar, 'VIDEO_LINK')[0]
    return {
      videoUrl: link?.url ?? null,
      videoPosterUrl: null,
      videoDuracionSegundos: null,
      videoMimeType: null,
    }
  }

  async function handleCrearLugar() {
    setGuardandoLugarId(-1)
    setErrorLugar('')
    try {
      const lugar = await crearLugarTour({ titulo: `Parada ${lugares.length + 1}`, orden: lugares.length })
      reemplazarLugares([...lugares, lugar])
      setLugarAbiertoId(lugar.id)
    } catch (e: any) {
      setErrorLugar(e?.message ?? 'No se pudo crear el lugar')
    } finally {
      setGuardandoLugarId(null)
    }
  }

  async function handleGuardarLugar(lugar: TourLugar) {
    setGuardandoLugarId(lugar.id)
    setErrorLugar('')
    try {
      const actualizado = await actualizarLugarTour(lugar.id, lugar)
      actualizarLugarLocal(actualizado)
    } catch (e: any) {
      setErrorLugar(e?.message ?? 'No se pudo guardar el lugar')
    } finally {
      setGuardandoLugarId(null)
    }
  }

  async function handleEliminarLugar(lugar: TourLugar) {
    setPendienteEliminarLugar(lugar)
  }

  async function confirmarEliminarLugar() {
    const lugar = pendienteEliminarLugar
    if (!lugar) return
    setGuardandoLugarId(lugar.id)
    setErrorLugar('')
    try {
      await eliminarLugarTour(lugar.id)
      reemplazarLugares(lugares.filter(item => item.id !== lugar.id))
      if (lugarAbiertoId === lugar.id) setLugarAbiertoId(null)
    } catch (e) {
      setErrorLugar(e instanceof Error ? e.message : 'No se pudo eliminar el lugar')
    } finally {
      setGuardandoLugarId(null)
      setPendienteEliminarLugar(null)
    }
  }

  async function handleMoverLugar(index: number, direccion: -1 | 1) {
    const destino = index + direccion
    if (destino < 0 || destino >= lugares.length) return
    const nuevos = [...lugares]
    const [movido] = nuevos.splice(index, 1)
    nuevos.splice(destino, 0, movido)
    reemplazarLugares(nuevos.map((l, orden) => ({ ...l, orden })))
    try {
      const ordenados = await reordenarLugaresTour(nuevos.map(l => l.id))
      reemplazarLugares(ordenados)
    } catch (e: any) {
      setErrorLugar(e?.message ?? 'No se pudo reordenar la ruta')
    }
  }

  async function handleSubirFotosLugar(lugarId: number, archivos: FileList | null) {
    const files = Array.from(archivos ?? [])
    if (!files.length) return
    setSubiendoLugarId(lugarId)
    setErrorLugar('')
    try {
      const noImagen = files.find(file => !file.type.startsWith('image/'))
      if (noImagen) {
        throw new Error('Solo puedes subir imagenes JPG, PNG, WEBP o similares.')
      }
      const pesada = files.find(file => file.size > IMAGEN_MAX_BYTES)
      if (pesada) {
        throw new Error(`"${pesada.name}" supera 8 MB. Usa una imagen mas liviana.`)
      }
      actualizarLugarLocal(await subirFotosLugarTour(lugarId, files))
    } catch (e: any) {
      const mensaje = e?.message ?? 'No se pudieron subir las fotos'
      setErrorLugar(mensaje)
      alert(mensaje)
    } finally {
      setSubiendoLugarId(null)
      const input = inputFotosLugarRefs.current[lugarId]
      if (input) input.value = ''
    }
  }

  async function handleEliminarMediaLugar(lugarId: number, mediaId: number) {
    setSubiendoLugarId(lugarId)
    setErrorLugar('')
    try {
      actualizarLugarLocal(await eliminarMediaLugarTour(lugarId, mediaId))
    } catch (e: any) {
      setErrorLugar(e?.message ?? 'No se pudo eliminar el archivo')
    } finally {
      setSubiendoLugarId(null)
    }
  }

  async function handleSubirVideoLugar(lugar: TourLugar, file: File, meta: VideoMetaCaptura): Promise<VideoEstado> {
    setSubiendoLugarId(lugar.id)
    try {
      const actualizado = await subirVideoLugarTour(lugar.id, file, meta)
      actualizarLugarLocal(actualizado)
      return videoEstadoLugar(actualizado)
    } finally {
      setSubiendoLugarId(null)
    }
  }

  async function handleQuitarVideoLugar(lugar: TourLugar): Promise<VideoEstado> {
    const video = mediaLugar(lugar, 'VIDEO')[0]
    const link = mediaLugar(lugar, 'VIDEO_LINK')[0]
    if (video) {
      const actualizado = await quitarVideoLugarTour(lugar.id)
      actualizarLugarLocal(actualizado)
      return videoEstadoLugar(actualizado)
    } else if (link) {
      // Era un VIDEO_LINK guardado desde "Pegar link" — eliminar solo ese entry
      const actualizado = await eliminarMediaLugarTour(lugar.id, link.id)
      actualizarLugarLocal(actualizado)
      return videoEstadoLugar(actualizado)
    }
    return videoEstadoLugar(lugar)
  }

  async function handleGuardarVideoLinkLugar(lugar: TourLugar, url: string): Promise<VideoEstado> {
    const actualizado = await guardarVideoLinkLugarTour(lugar.id, { url })
    actualizarLugarLocal(actualizado)
    return videoEstadoLugar(actualizado)
  }

  if (cargando) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 pb-12">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1A1A1A]">🗺️ {tour?.nombre ?? 'Mi Tour'}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${tour?.activo ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-500">{tour?.activo ? 'Visible al público' : 'Oculto'}</span>
        </div>
      </div>

      {errorCarga && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl px-4 py-3 text-sm mb-5">{errorCarga}</div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto mb-5">
        {([
          ['reservas', `Reservas (${reservas.length})`],
          ['ruta', `Ruta (${lugares.length})`],
          ['estadisticas', '📊 Stats'],
          ['cupones', '🎟️ Cupones'],
          ['config', 'Configuración'],
        ] as [typeof tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id)
              if (id === 'cupones') listarCuponesTour().then(setCupones).catch(() => {})
              if (id === 'estadisticas') cargarEstadisticasTour()
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Reservas ── */}
      {tab === 'reservas' && (
        <div className="space-y-3">
          {reservas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🗺️</p>
              <p>Sin reservas todavía</p>
            </div>
          ) : reservas.map(r => {
            const fecha = new Date(r.fechaTour).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
            const acciones = ACCIONES[r.estado] ?? []
            return (
              <div key={r.id} className={`bg-white rounded-2xl border p-4 ${r.estado === 'PENDIENTE' ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#1A1A1A]">{r.nombreContacto}</p>
                    <p className="text-xs text-gray-500 mt-0.5">📅 {fecha} · 👥 {r.participantes} pers.</p>
                    <p className="text-xs text-gray-400 mt-0.5">📞 {r.telefonoContacto}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[r.estado] ?? ''}`}>
                      {r.estado}
                    </span>
                    <p className="text-sm font-bold text-[#2D6A4F] mt-1">{formatearPrecio(Number(r.total))}</p>
                  </div>
                </div>
                {r.notasCliente && (
                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-2 py-1">💬 {r.notasCliente}</p>
                )}
                {acciones.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {acciones.map(a => (
                      <button key={a.estado} onClick={() => cambiarEstado(r.id, a.estado)}
                        className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-gray-300 mt-2 font-mono">{r.codigo}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Estadísticas ── */}
      {tab === 'estadisticas' && (
        <div className="space-y-5">
          {cargandoStats || !estadisticas ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Filtro por rango de fechas (consultas contables) */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Desde</label>
                  <input
                    type="date"
                    value={desdeFiltro}
                    onChange={e => setDesdeFiltro(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Hasta</label>
                  <input
                    type="date"
                    value={hastaFiltro}
                    onChange={e => setHastaFiltro(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  onClick={() => desdeFiltro && hastaFiltro && cargarEstadisticasTour({ desde: desdeFiltro, hasta: hastaFiltro })}
                  disabled={!desdeFiltro || !hastaFiltro}
                  className="px-4 py-1.5 rounded-lg bg-[#2D6A4F] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Consultar
                </button>
                {estadisticas.rango && (
                  <button
                    onClick={() => { setDesdeFiltro(''); setHastaFiltro(''); cargarEstadisticasTour() }}
                    className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Resultado del rango consultado */}
              {estadisticas.rango && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                  <h3 className="font-semibold text-gray-800">
                    Rango consultado: {estadisticas.rango.desde} a {estadisticas.rango.hasta}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white border border-amber-100 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Reservas</p>
                      <p className="text-lg font-bold text-gray-800">{estadisticas.rango.reservas}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-amber-100 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Participantes</p>
                      <p className="text-lg font-bold text-gray-800">{estadisticas.rango.participantes}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-amber-100 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Ingresos</p>
                      <p className="text-lg font-bold text-gray-800">${estadisticas.rango.ingresos.toLocaleString('es-CO')}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-amber-100 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Comisión</p>
                      <p className="text-lg font-bold text-gray-800">${estadisticas.rango.comision.toLocaleString('es-CO')}</p>
                    </div>
                  </div>

                  {estadisticas.rango.reservas === 0 && (
                    <p className="text-sm text-gray-500">No hay reservas confirmadas en este rango.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Este mes</p>
                  <p className="text-2xl font-bold text-gray-800">{estadisticas.mes.reservas}</p>
                  <p className="text-xs text-gray-500">reservas</p>
                  <p className="text-base font-semibold text-gray-700 mt-2">${estadisticas.mes.ingresos.toLocaleString('es-CO')}</p>
                  <p className="text-xs text-gray-400">ingresos</p>
                  <p className="text-sm font-medium text-gray-600 mt-1">{estadisticas.mes.participantes} participantes</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Mes anterior</p>
                  <p className="text-2xl font-bold text-gray-800">{estadisticas.mesAnterior.reservas}</p>
                  <p className="text-xs text-gray-500">reservas</p>
                  <p className="text-base font-semibold text-gray-700 mt-2">${estadisticas.mesAnterior.ingresos.toLocaleString('es-CO')}</p>
                  <p className="text-xs text-gray-400">ingresos</p>
                  <p className="text-sm font-medium text-[#2D6A4F] mt-1 font-semibold">Total histórico: {estadisticas.totalHistorico}</p>
                </div>
              </div>

              {estadisticas.porMes.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">Ingresos por mes</h3>
                  <div className="flex items-end gap-2 h-20">
                    {estadisticas.porMes.map(m => {
                      const max = Math.max(...estadisticas.porMes.map(x => x.ingresos), 1)
                      const [anio, mes] = m.mes.split('-')
                      const label = new Date(Number(anio), Number(mes) - 1).toLocaleDateString('es-CO', { month: 'short' })
                      return (
                        <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-[#2D6A4F] rounded-t"
                            style={{ height: `${(m.ingresos / max) * 64}px`, minHeight: m.ingresos > 0 ? 4 : 0 }}
                            title={`${label}: $${m.ingresos.toLocaleString('es-CO')}`}
                          />
                          <span className="text-[9px] text-gray-400">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {estadisticas.proximasReservas.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">Próximas reservas confirmadas</h3>
                  <div className="space-y-3">
                    {estadisticas.proximasReservas.map(r => (
                      <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.nombreContacto}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(r.fechaTour).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} · {r.participantes} persona{r.participantes !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs font-mono text-gray-400">{r.codigo}</p>
                        </div>
                        <p className="text-sm font-bold text-[#1B4332]">${Number(r.total).toLocaleString('es-CO')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {estadisticas.mes.reservas === 0 && estadisticas.totalHistorico === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">🗺️</p>
                  <p>Aún no hay reservas confirmadas.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Cupones ── */}
      {tab === 'cupones' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Cupones de descuento</h2>
              <span className="text-xs text-gray-400">{cupones.filter(c => c.activo).length} activos</span>
            </div>
            {cupones.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin cupones. Crea uno abajo.</p>
            ) : (
              <div className="space-y-3">
                {cupones.map(c => {
                  const vencido = new Date(c.fin) < new Date()
                  return (
                    <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl border ${!c.activo || vencido ? 'opacity-60 bg-gray-50 border-gray-100' : 'bg-green-50 border-green-100'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[#1B4332]">{c.codigo}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.tipo === 'PORCENTAJE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {c.tipo === 'PORCENTAJE' ? `${Number(c.valor)}% OFF` : `-$${Number(c.valor).toLocaleString('es-CO')}`}
                          </span>
                          {vencido && <span className="text-xs text-red-500 font-medium">Vencido</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          {c.minimoPersonas && <p>Mínimo: {c.minimoPersonas} persona{c.minimoPersonas !== 1 ? 's' : ''}</p>}
                          <p>{new Date(c.inicio).toLocaleDateString('es-CO')} → {new Date(c.fin).toLocaleDateString('es-CO')}</p>
                          <p>Usos: {c.usosActuales}{c.usosMaximos ? ` / ${c.usosMaximos}` : ''}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPendienteDesactivarCupon(c)}
                        className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg flex-shrink-0"
                      >Desactivar</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Crear cupón</h2>
            {errorCupon && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{errorCupon}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Código *</label>
                <input value={nuevoCupon.codigo} onChange={e => setNuevoCupon(p => ({ ...p, codigo: e.target.value.toUpperCase().replace(/\s/g,'') }))}
                  placeholder="Ej: TOUR20, CHOCOTRIP…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select value={nuevoCupon.tipo} onChange={e => setNuevoCupon(p => ({ ...p, tipo: e.target.value as any }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="PORCENTAJE">% Porcentaje</option>
                  <option value="VALOR_FIJO">$ Valor fijo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor * {nuevoCupon.tipo === 'PORCENTAJE' ? '(%)' : '($)'}</label>
                <input type="number" min={1} value={nuevoCupon.valor} onChange={e => setNuevoCupon(p => ({ ...p, valor: e.target.value }))}
                  placeholder={nuevoCupon.tipo === 'PORCENTAJE' ? '20' : '50000'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mínimo personas</label>
                <input type="number" min={1} value={nuevoCupon.minimoPersonas} onChange={e => setNuevoCupon(p => ({ ...p, minimoPersonas: e.target.value }))}
                  placeholder="Opcional" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Límite de usos</label>
                <input type="number" min={1} value={nuevoCupon.usosMaximos} onChange={e => setNuevoCupon(p => ({ ...p, usosMaximos: e.target.value }))}
                  placeholder="Sin límite" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Inicio *</label>
                <input type="date" value={nuevoCupon.inicio} onChange={e => setNuevoCupon(p => ({ ...p, inicio: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fin *</label>
                <input type="date" value={nuevoCupon.fin} onChange={e => setNuevoCupon(p => ({ ...p, fin: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
            <button
              disabled={guardandoCupon || !nuevoCupon.codigo.trim() || !nuevoCupon.valor}
              onClick={async () => {
                if (!nuevoCupon.codigo.trim() || !nuevoCupon.valor) return
                setGuardandoCupon(true); setErrorCupon('')
                try {
                  await crearCuponTour({
                    codigo: nuevoCupon.codigo.trim(), tipo: nuevoCupon.tipo, valor: Number(nuevoCupon.valor),
                    minimoPersonas: nuevoCupon.minimoPersonas ? Number(nuevoCupon.minimoPersonas) : undefined,
                    usosMaximos: nuevoCupon.usosMaximos ? Number(nuevoCupon.usosMaximos) : undefined,
                    inicio: nuevoCupon.inicio, fin: nuevoCupon.fin,
                  })
                  setCupones(await listarCuponesTour())
                  setNuevoCupon({ codigo: '', tipo: 'PORCENTAJE', valor: '', minimoPersonas: '', usosMaximos: '',
                    inicio: new Date().toISOString().split('T')[0],
                    fin: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] })
                } catch (e: any) { setErrorCupon(e?.message ?? 'Error al crear el cupón') }
                finally { setGuardandoCupon(false) }
              }}
              className="w-full bg-[#2D6A4F] text-white py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {guardandoCupon ? 'Creando...' : '🎟️ Crear cupón'}
            </button>
          </div>
        </div>
      )}

      {/* ── Config ── */}
      {tab === 'ruta' && (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-[#163F31] via-[#2D6A4F] to-[#9A6A21] rounded-3xl p-5 text-white shadow-sm overflow-hidden relative">
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/70">Historia del recorrido</p>
                <h2 className="text-2xl font-bold mt-1">Ruta y lugares del tour</h2>
                <p className="text-sm text-white/80 mt-2 max-w-2xl">
                  Ordena las paradas, muestra fotos reales, sube un video corto y agrega enlaces de tus redes sociales.
                </p>
              </div>
              <button
                onClick={handleCrearLugar}
                disabled={guardandoLugarId === -1}
                className="bg-white text-[#1B4332] px-5 py-3 rounded-2xl font-bold text-sm shadow-sm hover:bg-[#F6F1E8] disabled:opacity-60"
              >
                {guardandoLugarId === -1 ? 'Creando...' : '+ Agregar lugar'}
              </button>
            </div>
          </div>

          {errorLugar && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl px-4 py-3 text-sm">{errorLugar}</div>
          )}

          {lugares.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-3xl p-10 text-center">
              <p className="text-3xl mb-2">Ruta</p>
              <h3 className="font-bold text-gray-800">Aun no tienes lugares en este tour</h3>
              <p className="text-sm text-gray-500 mt-2">Agrega la primera parada para que los viajeros entiendan que van a vivir.</p>
              <button onClick={handleCrearLugar} className="mt-5 bg-[#2D6A4F] text-white px-5 py-3 rounded-2xl font-bold text-sm">
                Crear primera parada
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const tieneRutas = lugares.some(l => l.rutaNombre)
                let rutaAnterior: string | null | undefined = undefined
                return lugares.map((lugar, index) => {
                const abierto = lugarAbiertoId === lugar.id
                const fotos = mediaLugar(lugar, 'FOTO')
                const video = mediaLugar(lugar, 'VIDEO')[0]
                const links = mediaLugar(lugar, 'VIDEO_LINK')
                const portada = fotos[0]?.url ?? video?.posterUrl ?? video?.url
                const mostrarCabezaRuta = tieneRutas && lugar.rutaNombre !== rutaAnterior
                rutaAnterior = lugar.rutaNombre

                return (
                  <div key={lugar.id}>
                  {mostrarCabezaRuta && (
                    <div className={`flex items-center gap-3 mt-2 mb-1 ${index > 0 ? 'pt-2 border-t border-dashed border-gray-200' : ''}`}>
                      <span className="text-xs font-black uppercase tracking-widest text-[#B7791F]">
                        {lugar.rutaNombre ? `Ruta: ${lugar.rutaNombre}` : 'Sin ruta asignada'}
                      </span>
                      <div className="flex-1 h-px bg-[#E8DCC8]" />
                    </div>
                  )}
                  <section className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="p-4 md:p-5 flex flex-col md:flex-row gap-4">
                      <button
                        type="button"
                        onClick={() => setLugarAbiertoId(abierto ? null : lugar.id)}
                        className="w-full md:w-44 h-32 rounded-2xl overflow-hidden bg-[#F6F1E8] border border-gray-100 flex-shrink-0 text-left"
                      >
                        {portada ? (
                          <img src={portada} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">Sin media</div>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-[#1B4332] text-white text-xs font-bold px-2.5 py-1 rounded-full">#{index + 1}</span>
                              {lugar.destacado && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">Destacado</span>}
                              {lugar.tipo && <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">{lugar.tipo}</span>}
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 mt-2">{lugar.titulo}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">{lugar.descripcion || 'Describe que vera el viajero en esta parada.'}</p>
                            <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
                              <span>{fotos.length} fotos</span>
                              <span>{video ? '1 video propio' : 'Sin video propio'}</span>
                              <span>{links.length} links</span>
                              {lugar.duracionMinutos ? <span>{lugar.duracionMinutos} min</span> : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap md:justify-end">
                            <button onClick={() => handleMoverLugar(index, -1)} disabled={index === 0}
                              className="px-3 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40">Subir</button>
                            <button onClick={() => handleMoverLugar(index, 1)} disabled={index === lugares.length - 1}
                              className="px-3 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40">Bajar</button>
                            <button onClick={() => setLugarAbiertoId(abierto ? null : lugar.id)}
                              className="px-4 py-2 rounded-xl bg-[#EEF5F0] text-[#1B4332] font-bold text-sm">
                              {abierto ? 'Cerrar' : 'Editar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {abierto && (
                      <div className="border-t border-gray-100 bg-[#FAF8F3] p-4 md:p-5 space-y-5">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nombre del lugar</label>
                            <input value={lugar.titulo} onChange={e => actualizarLugarLocal({ ...lugar, titulo: e.target.value })}
                              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F]" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo</label>
                            <input value={lugar.tipo ?? ''} onChange={e => actualizarLugarLocal({ ...lugar, tipo: e.target.value })}
                              placeholder="Cascada, finca, playa, mirador..."
                              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F]" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Ruta / Itinerario (opcional)</label>
                            <input
                              value={lugar.rutaNombre ?? ''}
                              onChange={e => actualizarLugarLocal({ ...lugar, rutaNombre: e.target.value || null })}
                              placeholder="Ej: Ruta Río Quito, Ruta Selva, Día 1..."
                              list={`rutas-${lugar.id}`}
                              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F]"
                            />
                            <datalist id={`rutas-${lugar.id}`}>
                              {Array.from(new Set(lugares.map(l => l.rutaNombre).filter(Boolean))).map(ruta => (
                                <option key={ruta} value={ruta!} />
                              ))}
                            </datalist>
                            <p className="text-[11px] text-gray-400 mt-1">Agrupa paradas bajo el mismo nombre para crear itinerarios distintos dentro del tour.</p>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descripcion</label>
                            <textarea value={lugar.descripcion ?? ''} onChange={e => actualizarLugarLocal({ ...lugar, descripcion: e.target.value })}
                              rows={3} className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Duracion estimada (min)</label>
                            <input type="number" min={0} value={lugar.duracionMinutos ?? ''}
                              onChange={e => actualizarLugarLocal({ ...lugar, duracionMinutos: e.target.value ? Number(e.target.value) : null })}
                              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F]" />
                          </div>
                          <label className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-4 py-3">
                            <span>
                              <span className="block text-sm font-bold text-gray-800">Destacar lugar</span>
                              <span className="block text-xs text-gray-500">Aparecera con mayor fuerza visual.</span>
                            </span>
                            <Switch activo={!!lugar.destacado} onChange={v => actualizarLugarLocal({ ...lugar, destacado: v })} />
                          </label>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Recomendaciones</label>
                            <textarea value={lugar.recomendaciones ?? ''} onChange={e => actualizarLugarLocal({ ...lugar, recomendaciones: e.target.value })}
                              placeholder="Ej: llevar zapatos comodos, bloqueador, botella de agua..."
                              rows={2} className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button onClick={() => handleGuardarLugar(lugar)} disabled={guardandoLugarId === lugar.id}
                            className="bg-[#2D6A4F] text-white px-5 py-3 rounded-2xl font-bold text-sm disabled:opacity-60">
                            {guardandoLugarId === lugar.id ? 'Guardando...' : 'Guardar lugar'}
                          </button>
                          <button onClick={() => handleEliminarLugar(lugar)}
                            className="border border-red-200 text-red-600 px-5 py-3 rounded-2xl font-bold text-sm">
                            Eliminar
                          </button>
                        </div>

                        <div className="space-y-4">
                          {/* Fotos */}
                          <div className="bg-white rounded-2xl border border-gray-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-900 text-sm">📷 Fotos del lugar</h4>
                                <p className="text-xs text-gray-400 mt-0.5">{fotos.length > 0 ? `${fotos.length} foto${fotos.length > 1 ? 's' : ''} · ` : ''}JPG, PNG o WEBP · máx. 8 MB por imagen</p>
                              </div>
                              {fotos.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => inputFotosLugarRefs.current[lugar.id]?.click()}
                                  disabled={subiendoLugarId === lugar.id}
                                  className="bg-[#EEF5F0] text-[#1B4332] px-3 py-1.5 rounded-xl font-bold text-xs disabled:opacity-60 hover:bg-[#DDEDE4] transition-colors"
                                >
                                  {subiendoLugarId === lugar.id ? 'Subiendo...' : '+ Agregar'}
                                </button>
                              )}
                              <input
                                ref={el => { inputFotosLugarRefs.current[lugar.id] = el }}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={e => handleSubirFotosLugar(lugar.id, e.target.files)}
                              />
                            </div>
                            {fotos.length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                                {fotos.map(foto => (
                                  <div key={foto.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
                                    <img src={foto.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                                    <button
                                      onClick={() => handleEliminarMediaLugar(lugar.id, foto.id)}
                                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg">Quitar</span>
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => inputFotosLugarRefs.current[lugar.id]?.click()}
                                  disabled={subiendoLugarId === lugar.id}
                                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-[#2D6A4F] transition-colors flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#2D6A4F] disabled:opacity-50"
                                >
                                  <span className="text-xl leading-none">+</span>
                                  <span className="text-[10px] font-semibold">Más</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => inputFotosLugarRefs.current[lugar.id]?.click()}
                                disabled={subiendoLugarId === lugar.id}
                                className="w-full py-10 border-2 border-dashed border-gray-200 rounded-2xl hover:border-[#2D6A4F] hover:bg-[#F6FAF7] transition-colors flex flex-col items-center gap-2 text-gray-400 hover:text-[#2D6A4F] disabled:opacity-50"
                              >
                                <span className="text-3xl">📷</span>
                                <span className="text-sm font-semibold">{subiendoLugarId === lugar.id ? 'Subiendo...' : 'Sube fotos del lugar'}</span>
                                <span className="text-xs">Puedes seleccionar varias a la vez</span>
                              </button>
                            )}
                          </div>

                          {/* Video principal */}
                          <div className="bg-white rounded-2xl border border-gray-100 p-4">
                            <h4 className="font-semibold text-gray-900 text-sm mb-1">🎬 Video de la parada</h4>
                            <p className="text-xs text-gray-400 mb-3">Sube un clip propio o pega un link de YouTube, TikTok, Instagram, etc.</p>
                            <SubidorVideoOLink
                              key={`video-lugar-${lugar.id}-${video?.id ?? links[0]?.id ?? 'sin-video'}`}
                              titulo="Video corto de la parada"
                              estadoInicial={videoEstadoLugar(lugar)}
                              onSubir={(file, meta) => handleSubirVideoLugar(lugar, file, meta)}
                              onEliminar={() => handleQuitarVideoLugar(lugar)}
                              onGuardarLink={(url) => handleGuardarVideoLinkLugar(lugar, url)}
                              compacto
                            />
                          </div>

                          {/* Links adicionales */}
                          <div className="bg-white rounded-2xl border border-gray-100 p-4">
                            <h4 className="font-semibold text-gray-900 text-sm mb-1">🔗 Links adicionales</h4>
                            <p className="text-xs text-gray-400 mb-3">Agrega más videos o páginas relacionadas con esta parada.</p>
                            <form className="flex gap-2" onSubmit={async e => {
                              e.preventDefault()
                              const form = new FormData(e.currentTarget)
                              const url = String(form.get('url') || '').trim()
                              if (!url) return
                              await handleGuardarVideoLinkLugar(lugar, url)
                              e.currentTarget.reset()
                            }}>
                              <input
                                name="url"
                                placeholder="https://instagram.com/p/... · https://tiktok.com/..."
                                className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
                              />
                              <button type="submit" className="bg-[#2D6A4F] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#1B4332] transition-colors flex-shrink-0">
                                Agregar
                              </button>
                            </form>
                            {links.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {links.map(link => (
                                  <div key={link.id} className="flex items-center gap-3 bg-[#F6F1E8] rounded-xl px-3 py-2.5">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-[#1B4332]">{link.plataforma ?? 'Enlace externo'}</p>
                                      <a href={link.url} target="_blank" rel="noreferrer"
                                        className="text-xs text-gray-500 truncate block hover:text-[#2D6A4F]">
                                        {link.url}
                                      </a>
                                    </div>
                                    <button
                                      onClick={() => handleEliminarMediaLugar(lugar.id, link.id)}
                                      className="text-xs text-red-500 font-bold hover:text-red-700 flex-shrink-0"
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                  </div>
                )
              })
              })()}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && editConfig && (
        <div className="space-y-4">
          {/* Activo */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#1A1A1A]">Tour visible al público</p>
              <p className="text-xs text-gray-400 mt-0.5">Actívalo cuando tengas todo configurado</p>
            </div>
            <Switch
              activo={!!editConfig.activo}
              onChange={v => setEditConfig(p => ({ ...p, activo: v }))}
            />
          </div>

          {/* Confirmación automática */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#1A1A1A]">Confirmación automática</p>
              <p className="text-xs text-gray-400 mt-0.5">Confirmar reservas sin revisión manual</p>
            </div>
            <Switch
              activo={!!editConfig.confirmacionAuto}
              onChange={v => setEditConfig(p => ({ ...p, confirmacionAuto: v }))}
            />
          </div>

          {/* Datos básicos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h3 className="font-semibold text-[#1A1A1A]">Información del tour</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre del tour</label>
              <input value={editConfig.nombre ?? ''} onChange={e => setEditConfig(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Descripción</label>
              <textarea value={editConfig.descripcion ?? ''} onChange={e => setEditConfig(p => ({ ...p, descripcion: e.target.value }))}
                rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duración (horas)</label>
                <input type="number" min={0.5} step={0.5} value={editConfig.duracionHoras ?? 2}
                  onChange={e => setEditConfig(p => ({ ...p, duracionHoras: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Precio / persona</label>
                <input type="number" min={0} value={Number(editConfig.precioPersona ?? 0)}
                  onChange={e => setEditConfig(p => ({ ...p, precioPersona: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Máx. participantes por fecha</label>
              <input type="number" min={1} value={editConfig.maxParticipantes ?? 10}
                onChange={e => setEditConfig(p => ({ ...p, maxParticipantes: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Punto de encuentro</label>
              <input value={editConfig.puntoEncuentro ?? ''} onChange={e => setEditConfig(p => ({ ...p, puntoEncuentro: e.target.value }))}
                placeholder="Ej: Parque principal de Quibdó"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
          </div>

          {/* Servicios incluidos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#1A1A1A] mb-3">¿Qué incluye?</h3>
            <div className="flex flex-wrap gap-2">
              {SERVICIOS_OPCIONES.map(s => {
                const sel = (editConfig.servicios ?? []).includes(s.key)
                return (
                  <button key={s.key} onClick={() => setEditConfig(p => ({
                    ...p,
                    servicios: sel ? (p.servicios ?? []).filter(x => x !== s.key) : [...(p.servicios ?? []), s.key]
                  }))} className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                    sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Idiomas */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#1A1A1A] mb-3">Idiomas</h3>
            <div className="flex flex-wrap gap-2">
              {IDIOMAS_OPCIONES.map(lang => {
                const sel = (editConfig.idiomas ?? []).includes(lang)
                return (
                  <button key={lang} onClick={() => setEditConfig(p => ({
                    ...p,
                    idiomas: sel ? (p.idiomas ?? []).filter(x => x !== lang) : [...(p.idiomas ?? []), lang]
                  }))} className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                    sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {lang}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fotos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#1A1A1A] mb-3">Fotos del tour</h3>
            {(tour?.fotos ?? []).length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {tour?.fotos.map((f, i) => (
                  <div key={i} className="relative group">
                    <img src={f} alt="" className="w-full h-20 object-cover rounded-xl" />
                    <button
                      type="button"
                      onClick={() => eliminarFotoTour(f)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      title="Eliminar foto"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={inputFotoRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => e.target.files && subirFotos(e.target.files)} />
            <button onClick={() => inputFotoRef.current?.click()} disabled={subiendoFotos}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:border-[#2D6A4F] hover:text-[#2D6A4F] disabled:opacity-50 transition-colors">
              {subiendoFotos ? '⏳ Subiendo…' : '📸 Agregar fotos'}
            </button>
          </div>

          {/* Video */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Video del tour</h3>
            <SubidorVideoOLink
              titulo="Video del tour"
              estadoInicial={videoEstadoTour}
              onSubir={handleSubirVideoTour}
              onEliminar={handleQuitarVideoTour}
              onGuardarLink={handleGuardarLinkTour}
            />
          </div>

          {/* RNT */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              RNT — Registro Nacional de Turismo
            </label>
            <input
              value={(editConfig as any).rnt ?? ''}
              onChange={e => setEditConfig(c => ({ ...c, rnt: e.target.value }))}
              placeholder="Ej: 123456"
              className="w-full mt-1.5 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
            />
            {tour?.rntVerificado ? (
              <p className="text-xs text-blue-600 mt-1">✓ RNT verificado por Teravia</p>
            ) : tour?.rnt ? (
              <p className="text-xs text-amber-600 mt-1">Pendiente de verificación</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Ingresar el número mejora la visibilidad de tu tour</p>
            )}
          </div>

          {/* Política cancelación */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#1A1A1A] mb-2">Política de cancelación</h3>
            <textarea value={editConfig.politicaCancelacion ?? ''} rows={3}
              onChange={e => setEditConfig(p => ({ ...p, politicaCancelacion: e.target.value }))}
              placeholder="Describe tu política de cancelación y reembolsos…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
          </div>

          <button onClick={guardarConfig} disabled={guardando}
            className="w-full bg-[#2D6A4F] text-white font-bold py-3.5 rounded-2xl hover:bg-[#40916C] disabled:opacity-50 transition-colors">
            {guardando ? 'Guardando…' : '💾 Guardar configuración'}
          </button>
        </div>
      )}

      {pendienteEliminarLugar && (
        <ModalConfirmacion
          titulo="Eliminar lugar"
          mensaje={`Eliminar "${pendienteEliminarLugar.titulo}" de la ruta?`}
          onCancelar={() => setPendienteEliminarLugar(null)}
          onConfirmar={confirmarEliminarLugar}
          confirmando={guardandoLugarId === pendienteEliminarLugar.id}
          destructivo={true}
        />
      )}

      {pendienteDesactivarCupon && (
        <ModalConfirmacion
          titulo="Desactivar cupón"
          mensaje={`¿Desactivar ${pendienteDesactivarCupon.codigo}?`}
          onCancelar={() => setPendienteDesactivarCupon(null)}
          onConfirmar={confirmarDesactivarCupon}
          confirmando={desactivandoCupon}
          destructivo={true}
        />
      )}
    </div>
  )
}
