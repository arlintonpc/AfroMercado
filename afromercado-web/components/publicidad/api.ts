import { apiFetch } from '@/lib/api/client'

export type PaquetePublicidad =
  | 'IMPULSO_PRODUCTO'
  | 'HOME_DESTACADO'
  | 'VIDEO_HISTORIA'
  | 'TEMPORADA_REGIONAL'
  | 'MARCA_ALIADA'
  | 'BANNER_CARRUSEL'
  | 'IRRUPTOR_BIENVENIDA'

export type EstadoSolicitudPublicidad =
  | 'PENDIENTE'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'CONVERTIDA'

export type AlcancePublicidad = 'MUNICIPIO' | 'DEPARTAMENTO' | 'NACIONAL'

export type EstadoPagoPublicidad =
  | 'PENDIENTE'
  | 'EN_CHECKOUT'
  | 'PAGADA'
  | 'FALLIDA'
  | 'VENCIDA'
  | 'ANULADA'
  | 'CORTESIA'

export interface SolicitudPublicidad {
  id: number
  paquete: PaquetePublicidad | string
  objetivo: string
  presupuestoCOP?: number | string | null
  alcance?: AlcancePublicidad | string
  departamento?: string | null
  municipio?: string | null
  inicio?: string | null
  fin?: string | null
  mensaje?: string | null
  estado: EstadoSolicitudPublicidad | string
  notasAdmin?: string | null
  politicaAceptada?: boolean
  politicaVersion?: string | null
  politicaAceptadaAt?: string | null
  pagoEstado?: EstadoPagoPublicidad | string
  pagoMontoCOP?: number | string | null
  pagoReferencia?: string | null
  pagoProveedor?: 'SANDBOX' | 'WOMPI' | 'PAYU' | 'EPAYCO' | 'MERCADOPAGO' | string | null
  pagoCheckoutUrl?: string | null
  pagoProviderPaymentId?: string | null
  pagoProviderReference?: string | null
  pagoProviderStatus?: string | null
  pagoConfirmadoAt?: string | null
  pagoExpiraAt?: string | null
  pagoNotas?: string | null
  pagoActualizadoAt?: string | null
  videoUrl?: string | null
  videoPortadaUrl?: string | null
  videoTexto?: string | null
  videoUbicacion?: string | null
  videoDestino?: string | null
  videoNotasComercio?: string | null
  videoAprobado?: boolean | null
  videoNotasRevision?: string | null
  videoRevisadoAt?: string | null
  imagenPersonalizadaUrl?: string | null
  revisadoAt?: string | null
  createdAt: string
  updatedAt: string
  comercio: {
    id: number
    nombre: string
    municipio: string
    estadoRegistro?: string
    verificado?: boolean
    usuario?: { nombre: string; email: string; telefono?: string | null }
  }
  producto?: {
    id: number
    nombre: string
    fotoUrl?: string | null
    precio?: number | string
    stock?: number
    activo?: boolean
  } | null
  adminRevisor?: { id: number; nombre: string } | null
}

export interface ResumenAfroMedia {
  solicitudesPendientes: number
  solicitudesAprobadas: number
  solicitudesConvertidas: number
  campanasActivas: number
  visibilidadesActivas: number
  vistasCampanas: number
  clicsCampanas: number
  vistasVisibilidad: number
  clicsVisibilidad: number
  carritosVisibilidad: number
  pedidosAtribuidos: number
  unidadesAtribuidas: number
  gmvAtribuido: number
  inversionRegistrada: number
  ctrCampanas: number
  ctrVisibilidad: number
  conversionCarrito: number
  roasVisibilidad: number
  publicidadPagosPendientes: number
  publicidadIngresosPendientes: number
  publicidadPagosConfirmados: number
  publicidadIngresosConfirmados: number
}

export interface PublicidadPaqueteConfig {
  id: number
  codigo: PaquetePublicidad | string
  nombre: string
  descripcion?: string | null
  ideal?: string | null
  precioBaseCOP: number | string
  duracionDias: number
  cuposSugeridos?: number | null
  activo: boolean
  recomendado: boolean
  orden: number
  color?: string | null
  cuposOcupados?: number
  cuposDisponibles?: number | null
  cupoLleno?: boolean
  pendientesRevision?: number
  updatedAt?: string
}

export interface FilaAnaliticaAfroMedia {
  clave: string
  nombre: string
  pautas: number
  vistas: number
  clics: number
  carritos: number
  pedidosAtribuidos: number
  unidadesAtribuidas: number
  gmvAtribuido: number
  inversionRegistrada: number
  ctr: number
  conversionCarrito: number
  roas: number
  productoId?: number | null
  comercioId?: number | null
  comercio?: string | null
  municipio?: string | null
  categoria?: string | null
}

export interface FilaPaqueteAfroMedia {
  codigo: string
  nombre: string
  solicitudes: number
  pendientes: number
  aprobadas: number
  convertidas: number
  rechazadas: number
  presupuestoSolicitado: number
  pagadas?: number
  pendientesPago?: number
  ingresoPagado?: number
  ingresoPendiente?: number
  activo: boolean
}

export interface AnaliticaAfroMedia {
  porRegion: FilaAnaliticaAfroMedia[]
  porCategoria: FilaAnaliticaAfroMedia[]
  porProducto: FilaAnaliticaAfroMedia[]
  porComercio: FilaAnaliticaAfroMedia[]
  porPaquete: FilaPaqueteAfroMedia[]
  campanas: Array<{
    id: number
    tipo: string
    titulo: string
    vistas: number
    clics: number
    montoCOP: number
    ctr: number
    inicio: string
    fin: string
    activa: boolean
  }>
}

export interface CrearSolicitudPublicidadInput {
  paquete: PaquetePublicidad
  objetivo: string
  productoId?: number | null
  presupuestoCOP?: number | null
  alcance?: AlcancePublicidad
  departamento?: string | null
  municipio?: string | null
  inicio?: string | null
  fin?: string | null
  mensaje?: string
  aceptaPoliticas: boolean
  videoUrl?: string | null
  videoPortadaUrl?: string | null
  videoTexto?: string | null
  videoUbicacion?: string | null
  videoDestino?: string | null
  videoNotasComercio?: string | null
  imagenPersonalizadaUrl?: string | null
}

export interface AuditoriaAfroMediaItem {
  id: number
  tipo: string
  entidad: string
  entidadId?: number | null
  usuarioId?: number | null
  datos?: Record<string, unknown> | null
  ip?: string | null
  createdAt: string
}

export async function revisarVideoSolicitudAdmin(
  id: number,
  input: {
    videoAprobado: boolean
    videoNotasRevision?: string | null
    videoUrl?: string | null
    videoPortadaUrl?: string | null
    videoTexto?: string | null
    videoUbicacion?: string | null
    videoDestino?: string | null
  },
): Promise<SolicitudPublicidad> {
  const res = await apiFetch<{ ok: boolean; data: SolicitudPublicidad }>(
    `/admin/publicidad/solicitudes/${id}/video`,
    { method: 'PATCH', body: input },
  )
  return res.data
}

export async function obtenerAuditoriaAdmin(
  params: { tipo?: string; entidad?: string; desde?: string; hasta?: string; limite?: number } = {},
): Promise<AuditoriaAfroMediaItem[]> {
  const qs = new URLSearchParams()
  if (params.tipo) qs.set('tipo', params.tipo)
  if (params.entidad) qs.set('entidad', params.entidad)
  if (params.desde) qs.set('desde', params.desde)
  if (params.hasta) qs.set('hasta', params.hasta)
  if (params.limite) qs.set('limite', String(params.limite))
  const res = await apiFetch<{ ok: boolean; data: AuditoriaAfroMediaItem[] }>(
    `/admin/publicidad/auditoria${qs.toString() ? `?${qs}` : ''}`,
  )
  return res.data ?? []
}

export interface ResultadoConversionPublicidad {
  solicitud: SolicitudPublicidad
  destino: {
    tipo: 'VISIBILIDAD' | 'CAMPANA_HERO' | string
    id: number
    subtipo?: string
  }
}

export interface ResultadoPagoPublicidad {
  solicitud: SolicitudPublicidad
  pago: {
    estado: EstadoPagoPublicidad | string
    proveedor?: string | null
    referencia?: string | null
    checkoutUrl?: string | null
  }
}

export async function listarPaquetesPublicidad(): Promise<PublicidadPaqueteConfig[]> {
  const res = await apiFetch<{ ok: boolean; data: PublicidadPaqueteConfig[] }>('/publicidad/paquetes', { auth: false })
  return res.data ?? []
}

export async function listarPaquetesPublicidadAdmin(): Promise<PublicidadPaqueteConfig[]> {
  const res = await apiFetch<{ ok: boolean; data: PublicidadPaqueteConfig[] }>('/admin/publicidad/paquetes')
  return res.data ?? []
}

export async function actualizarPaquetePublicidadAdmin(
  codigo: string,
  input: Partial<PublicidadPaqueteConfig>,
): Promise<PublicidadPaqueteConfig> {
  const res = await apiFetch<{ ok: boolean; data: PublicidadPaqueteConfig }>(
    `/admin/publicidad/paquetes/${codigo}`,
    { method: 'PUT', body: input },
  )
  return res.data
}

export async function obtenerAnaliticaAfroMediaAdmin(params: { desde?: string; hasta?: string } = {}): Promise<AnaliticaAfroMedia> {
  const qs = new URLSearchParams()
  if (params.desde) qs.set('desde', params.desde)
  if (params.hasta) qs.set('hasta', params.hasta)
  const res = await apiFetch<{ ok: boolean; data: { analitica: AnaliticaAfroMedia } }>(
    `/admin/publicidad/analitica${qs.toString() ? `?${qs}` : ''}`,
  )
  return res.data.analitica
}

export async function crearSolicitudPublicidad(
  input: CrearSolicitudPublicidadInput,
): Promise<SolicitudPublicidad> {
  const res = await apiFetch<{ ok: boolean; data: SolicitudPublicidad }>('/publicidad/solicitudes', {
    method: 'POST',
    body: input,
  })
  return res.data
}

export async function listarMisSolicitudesPublicidad(): Promise<SolicitudPublicidad[]> {
  const res = await apiFetch<{ ok: boolean; data: SolicitudPublicidad[] }>('/publicidad/mis-solicitudes')
  return res.data ?? []
}

export async function iniciarPagoSolicitudPublicidad(id: number): Promise<ResultadoPagoPublicidad> {
  const res = await apiFetch<{ ok: boolean; data: ResultadoPagoPublicidad }>(
    `/publicidad/solicitudes/${id}/pago/iniciar`,
    { method: 'POST' },
  )
  return res.data
}

export async function obtenerResumenAfroMediaAdmin(): Promise<ResumenAfroMedia> {
  const res = await apiFetch<{ ok: boolean; data: ResumenAfroMedia }>('/admin/publicidad/resumen')
  return res.data
}

export async function listarSolicitudesPublicidadAdmin(): Promise<SolicitudPublicidad[]> {
  const res = await apiFetch<{ ok: boolean; data: SolicitudPublicidad[] }>('/admin/publicidad/solicitudes')
  return res.data ?? []
}

export async function revisarSolicitudPublicidadAdmin(
  id: number,
  estado: Exclude<EstadoSolicitudPublicidad, 'PENDIENTE'>,
  notasAdmin?: string,
): Promise<SolicitudPublicidad> {
  const res = await apiFetch<{ ok: boolean; data: SolicitudPublicidad }>(
    `/admin/publicidad/solicitudes/${id}`,
    { method: 'PATCH', body: { estado, notasAdmin } },
  )
  return res.data
}

export async function actualizarPagoSolicitudPublicidadAdmin(
  id: number,
  input: { estado: EstadoPagoPublicidad | string; notas?: string },
): Promise<SolicitudPublicidad> {
  const res = await apiFetch<{ ok: boolean; data: SolicitudPublicidad }>(
    `/admin/publicidad/solicitudes/${id}/pago`,
    { method: 'PATCH', body: input },
  )
  return res.data
}

export interface PuntoTendencia {
  fecha: string
  clics: number
  carritos: number
  pedidos: number
  gmv: number
  solicitudes: number
  ingresos: number
}

export interface TendenciasAfroMedia {
  agrupacion: 'dia' | 'semana'
  desde: string
  hasta: string
  serie: PuntoTendencia[]
}

export async function obtenerTendenciasAdmin(
  params: { desde?: string; hasta?: string; agrupacion?: 'dia' | 'semana' } = {},
): Promise<TendenciasAfroMedia> {
  const qs = new URLSearchParams()
  if (params.desde) qs.set('desde', params.desde)
  if (params.hasta) qs.set('hasta', params.hasta)
  if (params.agrupacion) qs.set('agrupacion', params.agrupacion)
  const res = await apiFetch<{ ok: boolean; data: TendenciasAfroMedia }>(
    `/admin/publicidad/tendencias${qs.toString() ? `?${qs}` : ''}`,
  )
  return res.data
}

export interface SlotInventario {
  tipo: string
  limite: number
  activos: number
  disponibles: number
  lleno: boolean
}

export async function obtenerInventarioAdmin(): Promise<SlotInventario[]> {
  const res = await apiFetch<{ ok: boolean; data: SlotInventario[] }>('/admin/publicidad/inventario')
  return res.data ?? []
}

export async function actualizarInventarioAdmin(tipo: string, limite: number): Promise<SlotInventario[]> {
  const res = await apiFetch<{ ok: boolean; data: SlotInventario[] }>(
    `/admin/publicidad/inventario/${tipo}`,
    { method: 'PUT', body: { limite } },
  )
  return res.data ?? []
}

export async function convertirSolicitudPublicidadAdmin(
  id: number,
): Promise<ResultadoConversionPublicidad> {
  const res = await apiFetch<{ ok: boolean; data: ResultadoConversionPublicidad }>(
    `/admin/publicidad/solicitudes/${id}/convertir`,
    { method: 'POST' },
  )
  return res.data
}
