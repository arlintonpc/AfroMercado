'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  actualizarPagoSolicitudPublicidadAdmin,
  actualizarPaquetePublicidadAdmin,
  convertirSolicitudPublicidadAdmin,
  listarPaquetesPublicidadAdmin,
  listarSolicitudesPublicidadAdmin,
  obtenerAnaliticaAfroMediaAdmin,
  actualizarInventarioAdmin,
  obtenerAuditoriaAdmin,
  obtenerInventarioAdmin,
  obtenerResumenAfroMediaAdmin,
  obtenerTendenciasAdmin,
  revisarSolicitudPublicidadAdmin,
  revisarVideoSolicitudAdmin,
  type AnaliticaAfroMedia,
  type AuditoriaAfroMediaItem,
  type EstadoPagoPublicidad,
  type EstadoSolicitudPublicidad,
  type FilaAnaliticaAfroMedia,
  type PuntoTendencia,
  type PublicidadPaqueteConfig,
  type ResumenAfroMedia,
  type SlotInventario,
  type SolicitudPublicidad,
  type TendenciasAfroMedia,
} from '@/components/publicidad/api'
import { Button } from '@/components/ui/Button'
import BotonExportar from '@/components/reportes/BotonExportar'
import { formatearPrecio } from '@/lib/formatearPrecio'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

const RESUMEN_VACIO: ResumenAfroMedia = {
  solicitudesPendientes: 0,
  solicitudesAprobadas: 0,
  solicitudesConvertidas: 0,
  campanasActivas: 0,
  visibilidadesActivas: 0,
  vistasCampanas: 0,
  clicsCampanas: 0,
  vistasVisibilidad: 0,
  clicsVisibilidad: 0,
  carritosVisibilidad: 0,
  pedidosAtribuidos: 0,
  unidadesAtribuidas: 0,
  gmvAtribuido: 0,
  inversionRegistrada: 0,
  ctrCampanas: 0,
  ctrVisibilidad: 0,
  conversionCarrito: 0,
  roasVisibilidad: 0,
  publicidadPagosPendientes: 0,
  publicidadIngresosPendientes: 0,
  publicidadPagosConfirmados: 0,
  publicidadIngresosConfirmados: 0,
}

const PAQUETES: Record<string, string> = {
  IMPULSO_PRODUCTO: 'Impulso Producto',
  HOME_DESTACADO: 'Home Destacado',
  VIDEO_HISTORIA: 'Video Historia',
  TEMPORADA_REGIONAL: 'Temporada Regional',
  MARCA_ALIADA: 'Marca Aliada',
}

const ANALITICA_VACIA: AnaliticaAfroMedia = {
  porRegion: [],
  porCategoria: [],
  porProducto: [],
  porComercio: [],
  porPaquete: [],
  campanas: [],
}

function estadoClase(estado: string) {
  if (estado === 'PENDIENTE') return 'bg-[#D4A017]/15 text-[#9B7300] border-[#D4A017]/35'
  if (estado === 'APROBADA') return 'bg-[#52B788]/15 text-[#2D6A4F] border-[#52B788]/30'
  if (estado === 'CONVERTIDA') return 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
  return 'bg-[#C0392B]/10 text-[#C0392B] border-[#C0392B]/25'
}

function pagoClase(estado?: string | null) {
  if (estado === 'PAGADA') return 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
  if (estado === 'CORTESIA') return 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
  if (estado === 'EN_CHECKOUT') return 'bg-[#D4A017]/15 text-[#9B7300] border-[#D4A017]/35'
  if (estado === 'FALLIDA' || estado === 'VENCIDA' || estado === 'ANULADA') return 'bg-[#C0392B]/10 text-[#C0392B] border-[#C0392B]/25'
  return 'bg-white text-[#1A1A1A]/55 border-[#1A1A1A]/10'
}

function pagoTexto(estado?: string | null) {
  if (estado === 'PAGADA') return 'Pagada'
  if (estado === 'CORTESIA') return 'Cortesia'
  if (estado === 'EN_CHECKOUT') return 'En checkout'
  if (estado === 'FALLIDA') return 'Fallida'
  if (estado === 'VENCIDA') return 'Vencida'
  if (estado === 'ANULADA') return 'Anulada'
  return 'Pendiente pago'
}

function pagoActivable(estado?: string | null) {
  return estado === 'PAGADA' || estado === 'CORTESIA'
}

function fmtFecha(iso?: string | null) {
  if (!iso) return 'Sin fecha'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function pct(valor: number) {
  return `${(valor * 100).toFixed(1)}%`
}

function prioridadEstado(estado: string) {
  if (estado === 'PENDIENTE') return 0
  if (estado === 'APROBADA') return 1
  if (estado === 'CONVERTIDA') return 2
  return 3
}

function Metrica({
  titulo,
  valor,
  detalle,
  tono = 'verde',
}: {
  titulo: string
  valor: string
  detalle: string
  tono?: 'verde' | 'oro' | 'negro'
}) {
  const colores = {
    verde: 'from-[#2D6A4F] to-[#52B788]',
    oro: 'from-[#9B7300] to-[#D4A017]',
    negro: 'from-[#1A1A1A] to-[#2D6A4F]',
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-[#1A1A1A]/8 bg-white shadow-sm">
      <div className={`h-2 bg-gradient-to-r ${colores[tono]}`} />
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1A1A1A]/35">{titulo}</p>
        <p className="mt-3 text-3xl font-black text-[#1A1A1A]">{valor}</p>
        <p className="mt-1 text-sm text-[#1A1A1A]/55">{detalle}</p>
      </div>
    </div>
  )
}

function GraficaTendencias({ serie, metrica }: { serie: PuntoTendencia[]; metrica: 'clics' | 'gmv' | 'pedidos' }) {
  if (serie.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl bg-[#F8F5F0] text-sm text-[#1A1A1A]/40">
        Sin datos en el periodo seleccionado.
      </div>
    )
  }

  const valores = serie.map((p) => (metrica === 'gmv' ? p.gmv : metrica === 'clics' ? p.clics : p.pedidos))
  const max = Math.max(...valores, 1)
  const W = 600
  const H = 120
  const padX = 4
  const padY = 8

  const puntos = serie.map((_, i) => {
    const x = padX + (i / Math.max(serie.length - 1, 1)) * (W - padX * 2)
    const y = padY + (1 - valores[i] / max) * (H - padY * 2)
    return { x, y }
  })

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${linea} L ${puntos[puntos.length - 1].x.toFixed(1)} ${H} L ${puntos[0].x.toFixed(1)} ${H} Z`

  const colorLinea = metrica === 'gmv' ? '#D4A017' : metrica === 'clics' ? '#2D6A4F' : '#52B788'
  const colorArea = metrica === 'gmv' ? '#D4A017' : metrica === 'clics' ? '#2D6A4F' : '#52B788'

  const fmtEtiq = (p: PuntoTendencia) => p.fecha.slice(5)

  return (
    <div className="overflow-hidden rounded-2xl bg-[#F8F5F0] p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${metrica}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorArea} stopOpacity="0.28" />
            <stop offset="100%" stopColor={colorArea} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${metrica})`} />
        <path d={linea} fill="none" stroke={colorLinea} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={colorLinea} />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-[#1A1A1A]/40 font-bold">
        <span>{fmtEtiq(serie[0])}</span>
        {serie.length > 2 && <span>{fmtEtiq(serie[Math.floor(serie.length / 2)])}</span>}
        <span>{fmtEtiq(serie[serie.length - 1])}</span>
      </div>
    </div>
  )
}

function RankingAfroMedia({
  titulo,
  filas,
  detalle,
}: {
  titulo: string
  filas: FilaAnaliticaAfroMedia[]
  detalle?: (fila: FilaAnaliticaAfroMedia) => string
}) {
  return (
    <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-[#1A1A1A]">{titulo}</h3>
        <span className="rounded-full bg-[#F8F5F0] px-3 py-1 text-xs font-bold text-[#1A1A1A]/45">
          {filas.length} filas
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {filas.length === 0 ? (
          <div className="rounded-2xl bg-[#F8F5F0] p-4 text-sm text-[#1A1A1A]/50">Sin datos en el periodo.</div>
        ) : filas.slice(0, 5).map((fila, index) => (
          <div key={`${fila.clave}-${index}`} className="rounded-2xl border border-[#1A1A1A]/6 bg-[#FDFBF7] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-black text-[#1A1A1A]">{fila.nombre}</p>
                {detalle && <p className="mt-0.5 text-xs text-[#1A1A1A]/45">{detalle(fila)}</p>}
              </div>
              <span className="rounded-full bg-[#2D6A4F]/10 px-2.5 py-1 text-xs font-black text-[#2D6A4F]">
                {fila.roas.toFixed(1)}x
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <div>
                <p className="font-black text-[#1A1A1A]">{fila.vistas.toLocaleString('es-CO')}</p>
                <p className="text-[#1A1A1A]/40">vistas</p>
              </div>
              <div>
                <p className="font-black text-[#1A1A1A]">{fila.clics.toLocaleString('es-CO')}</p>
                <p className="text-[#1A1A1A]/40">clics</p>
              </div>
              <div>
                <p className="font-black text-[#1A1A1A]">{pct(fila.ctr)}</p>
                <p className="text-[#1A1A1A]/40">CTR</p>
              </div>
              <div>
                <p className="truncate font-black text-[#1A1A1A]">{formatearPrecio(fila.gmvAtribuido)}</p>
                <p className="text-[#1A1A1A]/40">GMV</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AfroMediaAdminPage() {
  const [resumen, setResumen] = useState<ResumenAfroMedia>(RESUMEN_VACIO)
  const [solicitudes, setSolicitudes] = useState<SolicitudPublicidad[]>([])
  const [paquetes, setPaquetes] = useState<PublicidadPaqueteConfig[]>([])
  const [analitica, setAnalitica] = useState<AnaliticaAfroMedia>(ANALITICA_VACIA)
  const [tendencias, setTendencias] = useState<TendenciasAfroMedia | null>(null)
  const [agrupacion, setAgrupacion] = useState<'dia' | 'semana'>('dia')
  const [auditoria, setAuditoria] = useState<AuditoriaAfroMediaItem[]>([])
  const [inventario, setInventario] = useState<SlotInventario[]>([])
  const [editandoLimite, setEditandoLimite] = useState<{ tipo: string; valor: string } | null>(null)
  const [guardandoInventario, setGuardandoInventario] = useState(false)
  const [viendoVideoId, setViendoVideoId] = useState<number | null>(null)
  const [videoForm, setVideoForm] = useState<{ aprobado: boolean; notas: string }>({ aprobado: false, notas: '' })
  const [procesandoVideo, setProcesandoVideo] = useState(false)
  const [filtros, setFiltros] = useState({ desde: '', hasta: '' })
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [guardandoPaquete, setGuardandoPaquete] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [pautaAConfirmar, setPautaAConfirmar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = { desde: filtros.desde || undefined, hasta: filtros.hasta || undefined }
      const [resumenRes, solicitudesRes, paquetesRes, analiticaRes, tendenciasRes, auditoriaRes, inventarioRes] = await Promise.all([
        obtenerResumenAfroMediaAdmin(),
        listarSolicitudesPublicidadAdmin(),
        listarPaquetesPublicidadAdmin(),
        obtenerAnaliticaAfroMediaAdmin(params),
        obtenerTendenciasAdmin({ ...params, agrupacion }),
        obtenerAuditoriaAdmin({ limite: 50 }),
        obtenerInventarioAdmin(),
      ])
      setResumen(resumenRes)
      setSolicitudes(solicitudesRes)
      setPaquetes(paquetesRes)
      setAnalitica(analiticaRes)
      setTendencias(tendenciasRes)
      setAuditoria(auditoriaRes)
      setInventario(inventarioRes)
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No pudimos cargar AfroMedia.' })
    } finally {
      setCargando(false)
    }
  }, [filtros.desde, filtros.hasta, agrupacion])

  useEffect(() => { void cargar() }, [cargar])

  function abrirVideoReview(solicitud: SolicitudPublicidad) {
    setViendoVideoId(solicitud.id)
    setVideoForm({ aprobado: solicitud.videoAprobado ?? false, notas: solicitud.videoNotasRevision ?? '' })
  }

  async function guardarLimiteInventario() {
    if (!editandoLimite) return
    const n = parseInt(editandoLimite.valor)
    if (isNaN(n) || n < 0) return
    setGuardandoInventario(true)
    try {
      const slots = await actualizarInventarioAdmin(editandoLimite.tipo, n)
      setInventario(slots)
      setEditandoLimite(null)
      setAviso({ tipo: 'ok', texto: `Limite de ${editandoLimite.tipo} actualizado a ${n} slots.` })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo actualizar el limite.' })
    } finally {
      setGuardandoInventario(false)
    }
  }

  async function enviarRevisionVideo() {
    if (!viendoVideoId) return
    setProcesandoVideo(true)
    setAviso(null)
    try {
      await revisarVideoSolicitudAdmin(viendoVideoId, {
        videoAprobado: videoForm.aprobado,
        videoNotasRevision: videoForm.notas || null,
      })
      setAviso({ tipo: 'ok', texto: `Video ${videoForm.aprobado ? 'aprobado' : 'rechazado'}.` })
      setViendoVideoId(null)
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar la revision de video.' })
    } finally {
      setProcesandoVideo(false)
    }
  }

  async function cambiarEstado(id: number, estado: Exclude<EstadoSolicitudPublicidad, 'PENDIENTE'>) {
    const notasAdmin = window.prompt(
      estado === 'APROBADA'
        ? 'Nota para el comerciante antes de crear la visibilidad o campana:'
        : estado === 'CONVERTIDA'
          ? 'Describe donde quedo activada la pauta:'
          : 'Motivo del rechazo:',
      '',
    )
    if (notasAdmin === null) return
    setProcesandoId(id)
    setAviso(null)
    try {
      await revisarSolicitudPublicidadAdmin(id, estado, notasAdmin)
      setAviso({ tipo: 'ok', texto: `Solicitud marcada como ${estado.toLowerCase()}.` })
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo actualizar la solicitud.' })
    } finally {
      setProcesandoId(null)
    }
  }

  function crearPauta(id: number) {
    setPautaAConfirmar(id)
  }

  async function confirmarCrearPauta() {
    if (pautaAConfirmar == null) return
    const id = pautaAConfirmar
    setProcesandoId(id)
    setAviso(null)
    try {
      const resultado = await convertirSolicitudPublicidadAdmin(id)
      setAviso({
        tipo: 'ok',
        texto: `Pauta creada: ${resultado.destino.tipo} #${resultado.destino.id}.`,
      })
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo crear la pauta.' })
    } finally {
      setProcesandoId(null)
      setPautaAConfirmar(null)
    }
  }

  async function cambiarPago(id: number, estado: EstadoPagoPublicidad | string) {
    const notas = window.prompt(
      estado === 'CORTESIA'
        ? 'Motivo de la cortesia publicitaria:'
        : estado === 'PAGADA'
          ? 'Nota de conciliacion de pasarela o soporte del pago:'
          : `Nota para marcar el pago como ${String(estado).toLowerCase()}:`,
      '',
    )
    if (notas === null) return
    setProcesandoId(id)
    setAviso(null)
    try {
      await actualizarPagoSolicitudPublicidadAdmin(id, { estado, notas })
      setAviso({ tipo: 'ok', texto: `Pago publicitario actualizado a ${String(estado).toLowerCase()}.` })
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo actualizar el pago publicitario.' })
    } finally {
      setProcesandoId(null)
    }
  }

  function cambiarPaquete(codigo: string, campo: keyof PublicidadPaqueteConfig, valor: string | number | boolean | null) {
    setPaquetes((actuales) => actuales.map((p) => (
      p.codigo === codigo ? { ...p, [campo]: valor } : p
    )))
  }

  async function guardarPaquete(paquete: PublicidadPaqueteConfig) {
    setGuardandoPaquete(String(paquete.codigo))
    setAviso(null)
    try {
      const actualizado = await actualizarPaquetePublicidadAdmin(String(paquete.codigo), {
        nombre: paquete.nombre,
        descripcion: paquete.descripcion,
        ideal: paquete.ideal,
        precioBaseCOP: Number(paquete.precioBaseCOP || 0),
        duracionDias: Number(paquete.duracionDias || 1),
        cuposSugeridos: paquete.cuposSugeridos === null || paquete.cuposSugeridos === undefined ? null : Number(paquete.cuposSugeridos),
        activo: paquete.activo,
        recomendado: paquete.recomendado,
        orden: Number(paquete.orden || 0),
        color: paquete.color,
      })
      setPaquetes((actuales) => actuales.map((p) => p.codigo === actualizado.codigo ? actualizado : p))
      setAviso({ tipo: 'ok', texto: `Paquete ${actualizado.nombre} actualizado.` })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar el paquete.' })
    } finally {
      setGuardandoPaquete(null)
    }
  }

  const vistasTotales = resumen.vistasCampanas + resumen.vistasVisibilidad
  const clicsTotales = resumen.clicsCampanas + resumen.clicsVisibilidad
  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE')
  const solicitudesRecientes = [...solicitudes]
    .sort((a, b) => prioridadEstado(a.estado) - prioridadEstado(b.estado) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#101A14] px-6 py-8 text-white shadow-xl sm:px-8 lg:px-10">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#52B788]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#D4A017]/25 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#D4A017]">AfroMedia</p>
            <h1
              className="mt-4 max-w-3xl text-4xl leading-[0.98] sm:text-5xl"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              Publicidad nativa para vender sin romper la confianza.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              Controla productos patrocinados, campanas del hero, rutas regionales y solicitudes de comerciantes.
              El objetivo es ingreso publicitario medible, curado y culturalmente responsable.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Link href="/admin/visibilidad" className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 font-bold text-white backdrop-blur hover:bg-white/15">
              Crear visibilidad
            </Link>
            <Link href="/admin/campanas" className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 font-bold text-white backdrop-blur hover:bg-white/15">
              Crear campana
            </Link>
            <Link href="/admin/hero" className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 font-bold text-white backdrop-blur hover:bg-white/15">
              Configurar hero
            </Link>
          </div>
        </div>
      </section>

      {aviso && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
          aviso.tipo === 'ok'
            ? 'border-[#52B788]/35 bg-[#52B788]/10 text-[#2D6A4F]'
            : 'border-[#C0392B]/25 bg-[#C0392B]/5 text-[#C0392B]'
        }`}>
          {aviso.texto}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-3xl border border-[#1A1A1A]/8 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Centro de medicion</p>
          <h2 className="mt-1 text-xl font-black text-[#1A1A1A]">Reportes y exporte AfroMedia</h2>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">Filtra la analitica por fecha de creacion de solicitud, pauta o campana.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid gap-1 text-xs font-bold text-[#1A1A1A]/55">
            Desde
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => setFiltros((actual) => ({ ...actual, desde: e.target.value }))}
              className="rounded-xl border border-[#1A1A1A]/10 px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#1A1A1A]/55">
            Hasta
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => setFiltros((actual) => ({ ...actual, hasta: e.target.value }))}
              className="rounded-xl border border-[#1A1A1A]/10 px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
            />
          </label>
          <Button variant="secondary" size="sm" onClick={() => void cargar()} loading={cargando}>
            Aplicar
          </Button>
          <BotonExportar
            endpoint="/admin/publicidad/exportar"
            params={{ desde: filtros.desde || undefined, hasta: filtros.hasta || undefined }}
            nombreBase="AfroMedia"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#245a42] disabled:opacity-60"
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metrica
          titulo="Solicitudes pendientes"
          valor={String(resumen.solicitudesPendientes)}
          detalle={`${resumen.solicitudesAprobadas} aprobadas esperando activacion`}
          tono="oro"
        />
        <Metrica
          titulo="Cobro publicitario"
          valor={formatearPrecio(resumen.publicidadIngresosConfirmados)}
          detalle={`${resumen.publicidadPagosPendientes} pagos pendientes por ${formatearPrecio(resumen.publicidadIngresosPendientes)}`}
        />
        <Metrica
          titulo="Vistas publicitarias"
          valor={vistasTotales.toLocaleString('es-CO')}
          detalle={`${clicsTotales.toLocaleString('es-CO')} clics totales`}
          tono="negro"
        />
        <Metrica
          titulo="Inventario activo"
          valor={String(resumen.campanasActivas + resumen.visibilidadesActivas)}
          detalle={`${resumen.campanasActivas} campanas y ${resumen.visibilidadesActivas} slots - ROAS ${resumen.roasVisibilidad.toFixed(1)}x`}
          tono="oro"
        />
      </section>

      <section className="grid gap-3 rounded-3xl border border-[#1A1A1A]/8 bg-white p-4 shadow-sm md:grid-cols-4">
        <div className="rounded-2xl bg-[#F8F5F0] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1A1A1A]/35">CTR visibilidad</p>
          <p className="mt-2 text-2xl font-black text-[#1A1A1A]">{pct(resumen.ctrVisibilidad)}</p>
        </div>
        <div className="rounded-2xl bg-[#F8F5F0] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1A1A1A]/35">Carritos</p>
          <p className="mt-2 text-2xl font-black text-[#1A1A1A]">{resumen.carritosVisibilidad.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-2xl bg-[#F8F5F0] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1A1A1A]/35">Pedidos atribuidos</p>
          <p className="mt-2 text-2xl font-black text-[#1A1A1A]">{resumen.pedidosAtribuidos.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-2xl bg-[#F8F5F0] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1A1A1A]/35">Inversion registrada</p>
          <p className="mt-2 text-2xl font-black text-[#1A1A1A]">{formatearPrecio(resumen.inversionRegistrada)}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Evolucion temporal</p>
            <h2 className="mt-1 text-2xl font-black text-[#1A1A1A]">Tendencias</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAgrupacion('dia')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${agrupacion === 'dia' ? 'bg-[#2D6A4F] text-white' : 'bg-[#F8F5F0] text-[#1A1A1A]/55 hover:bg-[#F8F5F0]/70'}`}
            >
              Por dia
            </button>
            <button
              type="button"
              onClick={() => setAgrupacion('semana')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${agrupacion === 'semana' ? 'bg-[#2D6A4F] text-white' : 'bg-[#F8F5F0] text-[#1A1A1A]/55 hover:bg-[#F8F5F0]/70'}`}
            >
              Por semana
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D6A4F]">Clics patrocinados</p>
              <span className="text-xs font-bold text-[#1A1A1A]/40">
                {tendencias ? tendencias.serie.reduce((acc, p) => acc + p.clics, 0).toLocaleString('es-CO') : '—'} total
              </span>
            </div>
            <GraficaTendencias serie={tendencias?.serie ?? []} metrica="clics" />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#D4A017]">GMV atribuido</p>
              <span className="text-xs font-bold text-[#1A1A1A]/40">
                {tendencias ? formatearPrecio(tendencias.serie.reduce((acc, p) => acc + p.gmv, 0)) : '—'} total
              </span>
            </div>
            <GraficaTendencias serie={tendencias?.serie ?? []} metrica="gmv" />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#52B788]">Pedidos atribuidos</p>
              <span className="text-xs font-bold text-[#1A1A1A]/40">
                {tendencias ? tendencias.serie.reduce((acc, p) => acc + p.pedidos, 0).toLocaleString('es-CO') : '—'} total
              </span>
            </div>
            <GraficaTendencias serie={tendencias?.serie ?? []} metrica="pedidos" />
          </div>
        </div>

        {tendencias && tendencias.serie.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] text-xs">
              <thead>
                <tr className="text-[#1A1A1A]/40 font-bold uppercase tracking-[0.15em]">
                  <th className="py-2 text-left">Fecha</th>
                  <th className="py-2 text-right">Clics</th>
                  <th className="py-2 text-right">Carritos</th>
                  <th className="py-2 text-right">Pedidos</th>
                  <th className="py-2 text-right">GMV</th>
                  <th className="py-2 text-right">Solicitudes</th>
                  <th className="py-2 text-right">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {tendencias.serie.map((p) => (
                  <tr key={p.fecha} className="border-t border-[#1A1A1A]/5 hover:bg-[#F8F5F0]">
                    <td className="py-1.5 font-bold text-[#1A1A1A]">{p.fecha}</td>
                    <td className="py-1.5 text-right text-[#2D6A4F] font-black">{p.clics.toLocaleString('es-CO')}</td>
                    <td className="py-1.5 text-right text-[#1A1A1A]/60">{p.carritos.toLocaleString('es-CO')}</td>
                    <td className="py-1.5 text-right text-[#52B788] font-black">{p.pedidos.toLocaleString('es-CO')}</td>
                    <td className="py-1.5 text-right text-[#D4A017] font-black">{formatearPrecio(p.gmv)}</td>
                    <td className="py-1.5 text-right text-[#1A1A1A]/60">{p.solicitudes.toLocaleString('es-CO')}</td>
                    <td className="py-1.5 text-right text-[#1A1A1A]/60">{formatearPrecio(p.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <RankingAfroMedia titulo="Regiones con mejor pauta" filas={analitica.porRegion} />
        <RankingAfroMedia titulo="Categorias que mas venden por pauta" filas={analitica.porCategoria} />
        <RankingAfroMedia
          titulo="Productos con mas retorno"
          filas={analitica.porProducto}
          detalle={(fila) => [fila.comercio, fila.municipio, fila.categoria].filter(Boolean).join(' - ')}
        />
        <RankingAfroMedia
          titulo="Comercios con mayor impacto"
          filas={analitica.porComercio}
          detalle={(fila) => fila.municipio || ''}
        />
      </section>

      <section className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Pricing operativo</p>
            <h2 className="mt-2 text-2xl font-black text-[#1A1A1A]">Paquetes configurables</h2>
            <p className="mt-1 text-sm text-[#1A1A1A]/55">Estos valores alimentan la pagina del comerciante y sirven como precio sugerido.</p>
          </div>
          <span className="rounded-full bg-[#F8F5F0] px-3 py-1 text-xs font-bold text-[#1A1A1A]/45">
            {paquetes.filter((p) => p.activo).length} activos
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {paquetes.map((paquete) => (
            <article key={paquete.codigo} className="rounded-3xl border border-[#1A1A1A]/8 bg-[#FDFBF7] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2D6A4F]">{paquete.codigo}</p>
                  <input
                    value={paquete.nombre}
                    onChange={(e) => cambiarPaquete(String(paquete.codigo), 'nombre', e.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-lg font-black text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                  />
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#1A1A1A]/60">
                    <input
                      type="checkbox"
                      checked={paquete.activo}
                      onChange={(e) => cambiarPaquete(String(paquete.codigo), 'activo', e.target.checked)}
                    />
                    Activo
                  </label>
                  <label className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#1A1A1A]/60">
                    <input
                      type="checkbox"
                      checked={paquete.recomendado}
                      onChange={(e) => cambiarPaquete(String(paquete.codigo), 'recomendado', e.target.checked)}
                    />
                    Recom.
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-bold text-[#1A1A1A]/50">
                  Precio base
                  <input
                    type="number"
                    min="0"
                    value={Number(paquete.precioBaseCOP || 0)}
                    onChange={(e) => cambiarPaquete(String(paquete.codigo), 'precioBaseCOP', e.target.value)}
                    className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#1A1A1A]/50">
                  Duracion dias
                  <input
                    type="number"
                    min="1"
                    value={paquete.duracionDias}
                    onChange={(e) => cambiarPaquete(String(paquete.codigo), 'duracionDias', Number(e.target.value))}
                    className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#1A1A1A]/50">
                  Cupos
                  <input
                    type="number"
                    min="0"
                    value={paquete.cuposSugeridos ?? ''}
                    onChange={(e) => cambiarPaquete(String(paquete.codigo), 'cuposSugeridos', e.target.value ? Number(e.target.value) : null)}
                    className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                  />
                </label>
              </div>

              <label className="mt-3 grid gap-1 text-xs font-bold text-[#1A1A1A]/50">
                Descripcion
                <textarea
                  rows={2}
                  value={paquete.descripcion ?? ''}
                  onChange={(e) => cambiarPaquete(String(paquete.codigo), 'descripcion', e.target.value)}
                  className="resize-none rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                />
              </label>

              <label className="mt-3 grid gap-1 text-xs font-bold text-[#1A1A1A]/50">
                Ideal para
                <input
                  value={paquete.ideal ?? ''}
                  onChange={(e) => cambiarPaquete(String(paquete.codigo), 'ideal', e.target.value)}
                  className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                />
              </label>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#2D6A4F]">{formatearPrecio(Number(paquete.precioBaseCOP || 0))}</p>
                  <p className={`mt-1 text-xs font-bold ${
                    paquete.cupoLleno ? 'text-[#C0392B]' : 'text-[#1A1A1A]/45'
                  }`}>
                    {paquete.cuposSugeridos && paquete.cuposSugeridos > 0
                      ? `${paquete.cuposOcupados ?? 0}/${paquete.cuposSugeridos} ocupados · ${paquete.cuposDisponibles ?? 0} libres`
                      : 'Sin limite de cupos'}
                    {paquete.pendientesRevision ? ` · ${paquete.pendientesRevision} por revisar` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={guardandoPaquete === paquete.codigo}
                  onClick={() => void guardarPaquete(paquete)}
                  className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#245a42] disabled:opacity-50"
                >
                  {guardandoPaquete === paquete.codigo ? 'Guardando...' : 'Guardar paquete'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Bandeja comercial</p>
              <h2 className="mt-2 text-2xl font-black text-[#1A1A1A]">Solicitudes de pauta</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void cargar()} loading={cargando}>
              Actualizar
            </Button>
          </div>

          <div className="mt-5 grid gap-4">
            {cargando ? (
              <div className="rounded-2xl bg-[#F8F5F0] p-6 text-sm text-[#1A1A1A]/55">Cargando solicitudes...</div>
            ) : solicitudesRecientes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 p-6">
                <p className="font-bold text-[#2D6A4F]">Aun no hay solicitudes.</p>
                <p className="mt-1 text-sm text-[#1A1A1A]/55">Cuando un comerciante pida pauta, aparecera aqui.</p>
              </div>
            ) : solicitudesRecientes.map((s) => (
              <article key={s.id} className="overflow-hidden rounded-3xl border border-[#1A1A1A]/8 bg-[#FDFBF7]">
                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${estadoClase(s.estado)}`}>
                        {s.estado}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1A1A1A]/50">
                        {PAQUETES[s.paquete] ?? s.paquete}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${pagoClase(s.pagoEstado)}`}>
                        {pagoTexto(s.pagoEstado)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-[#1A1A1A]">{s.comercio.nombre}</h3>
                    <p className="text-sm text-[#1A1A1A]/55">{s.comercio.municipio} - {s.comercio.usuario?.email}</p>
                    <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/70">{s.objetivo}</p>
                    <div className="mt-3 grid gap-2 text-xs text-[#1A1A1A]/45 sm:grid-cols-5">
                      <span>Producto: {s.producto?.nombre ?? 'Tienda completa'}</span>
                      <span>Fechas: {fmtFecha(s.inicio)} - {fmtFecha(s.fin)}</span>
                      <span>Presupuesto: {s.presupuestoCOP ? formatearPrecio(Number(s.presupuestoCOP)) : 'Por definir'}</span>
                      <span>Pago: {formatearPrecio(Number(s.pagoMontoCOP || s.presupuestoCOP || 0))}</span>
                      <span className={s.politicaAceptada ? 'text-[#2D6A4F]' : 'text-[#C0392B]'}>
                        Politicas: {s.politicaAceptada ? `aceptadas ${s.politicaVersion ?? ''}` : 'sin aceptar'}
                      </span>
                    </div>
                    <div className="mt-3 rounded-2xl border border-[#1A1A1A]/8 bg-white px-3 py-2 text-xs text-[#1A1A1A]/55">
                      <p>
                        Ref. pago: {s.pagoProviderReference || s.pagoReferencia || 'pendiente'}
                        {s.pagoProveedor ? ` - ${s.pagoProveedor}` : ''}
                        {s.pagoConfirmadoAt ? ` - confirmado ${fmtFecha(s.pagoConfirmadoAt)}` : ''}
                      </p>
                      {s.pagoNotas && <p className="mt-1 text-[#1A1A1A]/45">{s.pagoNotas}</p>}
                    </div>
                    {s.mensaje && (
                      <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs leading-relaxed text-[#1A1A1A]/55">
                        {s.mensaje}
                      </p>
                    )}
                    {s.notasAdmin && (
                      <p className="mt-3 text-xs font-semibold text-[#2D6A4F]">Nota admin: {s.notasAdmin}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 lg:w-40">
                    {s.paquete === 'VIDEO_HISTORIA' && (
                      <button
                        type="button"
                        onClick={() => abrirVideoReview(s)}
                        className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                          s.videoAprobado === true
                            ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                            : s.videoAprobado === false && s.videoNotasRevision
                              ? 'border-[#C0392B]/25 bg-[#C0392B]/8 text-[#C0392B]'
                              : 'border-[#D4A017]/30 bg-[#D4A017]/10 text-[#9B7300]'
                        } hover:opacity-80`}
                      >
                        {s.videoAprobado === true ? 'Video OK' : s.videoAprobado === false ? 'Video rechazado' : 'Revisar video'}
                      </button>
                    )}
                    {s.estado === 'PENDIENTE' && (
                      <>
                        <button
                          type="button"
                          disabled={procesandoId === s.id || !s.politicaAceptada}
                          title={!s.politicaAceptada ? 'No se puede aprobar sin aceptacion de politicas.' : undefined}
                          onClick={() => void cambiarEstado(s.id, 'APROBADA')}
                          className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-bold text-white hover:bg-[#245a42] disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={procesandoId === s.id}
                          onClick={() => void cambiarEstado(s.id, 'RECHAZADA')}
                          className="rounded-xl border border-[#C0392B]/25 bg-[#C0392B]/8 px-4 py-2 text-sm font-bold text-[#C0392B] hover:bg-[#C0392B]/12 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {s.estado === 'APROBADA' && (
                      <button
                        type="button"
                        disabled={procesandoId === s.id || !pagoActivable(s.pagoEstado)}
                        title={!pagoActivable(s.pagoEstado) ? 'Confirma el pago o marca cortesia antes de crear la pauta.' : undefined}
                        onClick={() => void crearPauta(s.id)}
                        className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
                      >
                        Crear pauta
                      </button>
                    )}
                    {s.estado === 'APROBADA' && !pagoActivable(s.pagoEstado) && (
                      <>
                        <button
                          type="button"
                          disabled={procesandoId === s.id}
                          onClick={() => void cambiarPago(s.id, 'PAGADA')}
                          className="rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/8 px-4 py-2 text-sm font-bold text-[#2D6A4F] hover:bg-[#2D6A4F]/12 disabled:opacity-50"
                        >
                          Conciliar pago
                        </button>
                        <button
                          type="button"
                          disabled={procesandoId === s.id}
                          onClick={() => void cambiarPago(s.id, 'CORTESIA')}
                          className="rounded-xl border border-[#1A1A1A]/12 bg-white px-4 py-2 text-sm font-bold text-[#1A1A1A]/70 hover:bg-[#F8F5F0] disabled:opacity-50"
                        >
                          Cortesia
                        </button>
                      </>
                    )}
                    {s.estado === 'APROBADA' && pagoActivable(s.pagoEstado) && (
                      <button
                        type="button"
                        disabled={procesandoId === s.id}
                        onClick={() => void cambiarPago(s.id, 'ANULADA')}
                        className="rounded-xl border border-[#C0392B]/18 bg-[#C0392B]/5 px-4 py-2 text-sm font-bold text-[#C0392B] hover:bg-[#C0392B]/10 disabled:opacity-50"
                      >
                        Anular pago
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Reglas sanas</p>
            <h2 className="mt-2 text-2xl font-black text-[#1A1A1A]">No se vende confianza</h2>
            <div className="mt-4 grid gap-3 text-sm text-[#1A1A1A]/62">
              <p className="rounded-2xl bg-[#F8F5F0] p-3">Todo anuncio debe decir Patrocinado, Publicidad o Comunidad.</p>
              <p className="rounded-2xl bg-[#F8F5F0] p-3">Solo comercios aprobados, con cuenta verificada y producto con stock.</p>
              <p className="rounded-2xl bg-[#F8F5F0] p-3">Maximo 10%-15% de tarjetas patrocinadas en catalogo/busqueda.</p>
              <p className="rounded-2xl bg-[#F8F5F0] p-3">No poner publicidad de descubrimiento en checkout.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#D4A017]/30 bg-[#D4A017]/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9B7300]/70">Pipeline</p>
            <h2 className="mt-2 text-2xl font-black text-[#1A1A1A]">{solicitudesPendientes.length} por revisar</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/60">
              Revisa calidad, legalidad, fotos, stock, coherencia cultural y promesa comercial antes de crear el slot.
            </p>
          </div>
        </aside>
      </section>

      {viendoVideoId && (() => {
        const s = solicitudes.find((sol) => sol.id === viendoVideoId)
        if (!s) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setViendoVideoId(null)}>
            <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#C0392B] px-6 py-4">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">Editorial</p>
                <h2 className="mt-1 text-xl font-black text-white">Revision Video Historia — #{s.id}</h2>
                <p className="mt-0.5 text-sm text-white/70">{s.comercio.nombre} · {s.objetivo}</p>
              </div>

              <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-6">
                {s.videoUrl ? (
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[#1A1A1A]/40">Video</p>
                    <video
                      src={s.videoUrl}
                      poster={s.videoPortadaUrl ?? undefined}
                      controls
                      className="w-full rounded-2xl bg-black"
                      style={{ maxHeight: 260 }}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#F8F5F0] p-4 text-sm text-[#1A1A1A]/50">
                    El comerciante aun no ha proporcionado la URL del video.
                  </div>
                )}

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {s.videoTexto && (
                    <div className="rounded-2xl bg-[#F8F5F0] p-3">
                      <p className="text-xs font-bold text-[#1A1A1A]/40">Copy / texto</p>
                      <p className="mt-1 font-semibold text-[#1A1A1A]">{s.videoTexto}</p>
                    </div>
                  )}
                  {s.videoUbicacion && (
                    <div className="rounded-2xl bg-[#F8F5F0] p-3">
                      <p className="text-xs font-bold text-[#1A1A1A]/40">Ubicacion deseada</p>
                      <p className="mt-1 font-semibold text-[#1A1A1A]">{s.videoUbicacion}</p>
                    </div>
                  )}
                  {s.videoDestino && (
                    <div className="rounded-2xl bg-[#F8F5F0] p-3">
                      <p className="text-xs font-bold text-[#1A1A1A]/40">Destino del clic</p>
                      <p className="mt-1 font-mono text-xs text-[#2D6A4F]">{s.videoDestino}</p>
                    </div>
                  )}
                  {s.videoNotasComercio && (
                    <div className="rounded-2xl bg-[#F8F5F0] p-3">
                      <p className="text-xs font-bold text-[#1A1A1A]/40">Notas del comerciante</p>
                      <p className="mt-1 text-[#1A1A1A]/70">{s.videoNotasComercio}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#1A1A1A]/8 p-4">
                  <p className="mb-3 text-sm font-black text-[#1A1A1A]">Decision editorial</p>
                  <div className="flex gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-2 text-sm font-bold text-[#2D6A4F]">
                      <input type="radio" name="videoDecision" checked={videoForm.aprobado} onChange={() => setVideoForm((f) => ({ ...f, aprobado: true }))} />
                      Aprobar video
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#C0392B]/25 bg-[#C0392B]/8 px-4 py-2 text-sm font-bold text-[#C0392B]">
                      <input type="radio" name="videoDecision" checked={!videoForm.aprobado} onChange={() => setVideoForm((f) => ({ ...f, aprobado: false }))} />
                      Rechazar / pedir cambios
                    </label>
                  </div>
                  <label className="mt-3 grid gap-1 text-xs font-bold text-[#1A1A1A]/55">
                    Notas para el comerciante
                    <textarea
                      rows={3}
                      value={videoForm.notas}
                      onChange={(e) => setVideoForm((f) => ({ ...f, notas: e.target.value }))}
                      placeholder="Que debe cambiar, que esta bien, que falta..."
                      className="resize-none rounded-xl border border-[#1A1A1A]/10 px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
                    />
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={procesandoVideo}
                    onClick={() => void enviarRevisionVideo()}
                    className="flex-1 rounded-xl bg-[#1A1A1A] py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
                  >
                    {procesandoVideo ? 'Guardando...' : 'Guardar revision'}
                  </button>
                  <button type="button" onClick={() => setViendoVideoId(null)} className="rounded-xl border border-[#1A1A1A]/12 px-5 py-3 text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#F8F5F0]">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <section className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Capacidad</p>
          <h2 className="mt-1 text-2xl font-black text-[#1A1A1A]">Inventario publicitario</h2>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">Slots activos por seccion. Edita el limite para abrir o cerrar cupos en tiempo real.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {inventario.map((slot) => {
            const pct = slot.limite > 0 ? Math.round((slot.activos / slot.limite) * 100) : 0
            const nombre = slot.tipo === 'HOME_DESTACADO' ? 'Home Destacado' : slot.tipo === 'CATALOGO' ? 'Catalogo' : slot.tipo
            const isEditing = editandoLimite?.tipo === slot.tipo
            return (
              <div key={slot.tipo} className={`rounded-2xl border p-4 ${slot.lleno ? 'border-[#C0392B]/20 bg-[#C0392B]/4' : 'border-[#1A1A1A]/8 bg-[#F8F5F0]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1A1A1A]/40">{nombre}</p>
                    <p className={`mt-1 text-2xl font-black ${slot.lleno ? 'text-[#C0392B]' : 'text-[#1A1A1A]'}`}>
                      {slot.activos} <span className="text-base font-semibold text-[#1A1A1A]/35">/ {slot.limite}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-[#1A1A1A]/45">
                      {slot.lleno ? 'Seccion llena — no se crean mas slots' : `${slot.disponibles} disponible${slot.disponibles !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setEditandoLimite({ tipo: slot.tipo, valor: String(slot.limite) })}
                      className="rounded-xl border border-[#1A1A1A]/12 px-3 py-1.5 text-xs font-bold text-[#1A1A1A]/55 hover:bg-white"
                    >
                      Editar limite
                    </button>
                  )}
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1A1A1A]/8">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-[#C0392B]' : pct >= 75 ? 'bg-[#D4A017]' : 'bg-[#2D6A4F]'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>

                {isEditing && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={editandoLimite.valor}
                      onChange={(e) => setEditandoLimite({ tipo: slot.tipo, valor: e.target.value })}
                      className="w-20 rounded-xl border border-[#1A1A1A]/12 px-3 py-1.5 text-sm font-bold text-center outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
                    />
                    <button
                      type="button"
                      disabled={guardandoInventario}
                      onClick={() => void guardarLimiteInventario()}
                      className="rounded-xl bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1E4D38] disabled:opacity-50"
                    >
                      {guardandoInventario ? '...' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoLimite(null)}
                      className="rounded-xl border border-[#1A1A1A]/12 px-3 py-1.5 text-xs font-bold text-[#1A1A1A]/45 hover:bg-white"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {inventario.length === 0 && (
            <div className="col-span-2 rounded-2xl bg-[#F8F5F0] p-5 text-sm text-[#1A1A1A]/50">Cargando inventario...</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Trazabilidad</p>
          <h2 className="mt-1 text-2xl font-black text-[#1A1A1A]">Auditoria AfroMedia</h2>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">Ultimas 50 operaciones: cambios de precio, revisiones, pagos y exportaciones.</p>
        </div>

        <div className="mt-5 overflow-x-auto">
          {auditoria.length === 0 ? (
            <div className="rounded-2xl bg-[#F8F5F0] p-6 text-sm text-[#1A1A1A]/50">Sin registros de auditoria todavia.</div>
          ) : (
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-left font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/35">
                  <th className="py-2 pr-3">Cuando</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Entidad</th>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2">Datos</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map((a) => (
                  <tr key={a.id} className="border-t border-[#1A1A1A]/5 hover:bg-[#FDFBF7]">
                    <td className="py-2 pr-3 font-mono text-[#1A1A1A]/50 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 font-black ${
                        a.tipo.includes('APROBADO') || a.tipo.includes('CONVERTIDA') ? 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
                        : a.tipo.includes('RECHAZADO') ? 'bg-[#C0392B]/10 text-[#C0392B]'
                        : a.tipo.includes('PAGO') ? 'bg-[#D4A017]/15 text-[#9B7300]'
                        : 'bg-[#F8F5F0] text-[#1A1A1A]/55'
                      }`}>
                        {a.tipo.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[#1A1A1A]/55">{a.entidad}</td>
                    <td className="py-2 pr-3 font-mono text-[#1A1A1A]/40">{a.entidadId ?? '—'}</td>
                    <td className="py-2 max-w-[260px] truncate text-[#1A1A1A]/45">
                      {a.datos ? JSON.stringify(a.datos) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {pautaAConfirmar != null && (
        <ModalConfirmacion
          titulo="Crear pauta"
          mensaje="Crear la pauta automaticamente y marcar esta solicitud como convertida?"
          onCancelar={() => setPautaAConfirmar(null)}
          onConfirmar={() => void confirmarCrearPauta()}
          confirmando={procesandoId === pautaAConfirmar}
          destructivo={false}
        />
      )}
    </div>
  )
}
