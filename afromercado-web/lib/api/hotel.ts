import { apiFetch } from './client'

export type EstadoReservaHotel = 'PENDIENTE' | 'CONFIRMADA' | 'CHECKIN' | 'CHECKOUT' | 'CANCELADA' | 'RECHAZADA'
export type EstadoHabitacionFisica = 'LIBRE' | 'OCUPADA' | 'LIMPIEZA' | 'MANTENIMIENTO' | 'BLOQUEADA'
export type ModalidadReservaHotel = 'NOCHE' | 'HORAS'
export type TipoAlojamiento = 'HABITACION' | 'CABANA' | 'APARTAMENTO' | 'CASA_COMPLETA' | 'FINCA' | 'GLAMPING' | 'POSADA' | 'HOSTAL' | 'ALBERGUE' | 'RESORT'

export const TIPOS_ALOJAMIENTO: { value: TipoAlojamiento; label: string; labelPlural: string; icono: string }[] = [
  { value: 'HABITACION',   label: 'Habitación',    labelPlural: 'habitaciones',    icono: '🛏️' },
  { value: 'CABANA',       label: 'Cabaña',        labelPlural: 'cabañas',         icono: '🌲' },
  { value: 'APARTAMENTO',  label: 'Apartamento',   labelPlural: 'apartamentos',    icono: '🏢' },
  { value: 'CASA_COMPLETA',label: 'Casa completa', labelPlural: 'casas completas', icono: '🏠' },
  { value: 'FINCA',        label: 'Finca',         labelPlural: 'fincas',          icono: '🌾' },
  { value: 'GLAMPING',     label: 'Glamping',      labelPlural: 'glampings',       icono: '⛺' },
  { value: 'POSADA',       label: 'Posada',        labelPlural: 'posadas',         icono: '🏡' },
  { value: 'HOSTAL',       label: 'Hostal',        labelPlural: 'hostales',        icono: '🎒' },
  { value: 'ALBERGUE',     label: 'Albergue',      labelPlural: 'albergues',       icono: '🏘️' },
  { value: 'RESORT',       label: 'Resort',        labelPlural: 'resorts',         icono: '🏖️' },
]

export const LABEL_TIPO_ALOJAMIENTO: Record<TipoAlojamiento, string> =
  Object.fromEntries(TIPOS_ALOJAMIENTO.map(t => [t.value, t.label])) as Record<TipoAlojamiento, string>

export const LABEL_PLURAL_TIPO_ALOJAMIENTO: Record<TipoAlojamiento, string> =
  Object.fromEntries(TIPOS_ALOJAMIENTO.map(t => [t.value, t.labelPlural])) as Record<TipoAlojamiento, string>

// Tipos donde lo normal es una sola unidad completa (no N unidades idénticas) —
// se usa para sugerir cantidad=1 y ocultar "reservas por horas" en el formulario.
export const TIPOS_ALOJAMIENTO_UNIDAD_UNICA: TipoAlojamiento[] = ['CABANA', 'CASA_COMPLETA', 'FINCA', 'GLAMPING']

export interface TemporadaHotel {
  id: number
  configHotelId: number
  habitacionTipoId?: number | null
  nombre: string
  inicio: string
  fin: string
  precioPorNoche: number | string
  activo: boolean
  createdAt: string
  habitacionTipo?: { nombre: string } | null
}

export interface HabitacionFisica {
  id: number
  configHotelId: number
  habitacionTipoId: number
  nombre: string
  piso?: string | null
  zona?: string | null
  estado: EstadoHabitacionFisica | string
  notas?: string | null
  activo: boolean
  creadoAt: string
  updatedAt: string
  habitacionTipo?: { id: number; nombre: string; capacidad?: number }
}

export interface HabitacionTipo {
  id: number
  configHotelId: number
  tipoAlojamiento: TipoAlojamiento
  nombre: string
  descripcion?: string | null
  capacidad: number
  precioPorNoche: number | string
  precioPorHora?: number | string | null
  permitePorHoras?: boolean
  duracionMinHoras?: number
  duracionMaxHoras?: number | null
  cantidad: number
  fotos: string[]
  serviciosExtra: string[]
  activo: boolean
  creadoAt: string
  videoUrl?: string | null
  videoPosterUrl?: string | null
  videoDuracionSeg?: number | null
  temporadas?: TemporadaHotel[]
  unidadesFisicas?: HabitacionFisica[]
}

export interface EstadisticasHotel {
  ingresosPorMes: { mes: string; ingreso: number }[]
  ingresoTotal6m: number
  reservasMesActual: number
  totalReservas6m: number
  cancelaciones6m: number
  ocupacionPorHab: { id: number; nombre: string; tasaOcupacion: number; diasOcupados: number }[]
  tasaOcupacionPromedio: number
  topHabitaciones: Array<{
    habitacion: { id: number; nombre: string }
    reservas: number
    ingresos: number
  }>
  rango?: {
    reservas: number
    ingresos: number
    cancelaciones: number
    topHabitaciones: EstadisticasHotel['topHabitaciones']
    desde: string
    hasta: string
  }
}

export interface ConfigHotel {
  id: number
  comercioId: number
  activo: boolean
  confirmacionAuto: boolean
  horasLimiteConfirm: number
  servicios: string[]
  politicaCancelacion?: string | null
  checkInHora: string
  checkOutHora: string
  permiteReservasPorHora?: boolean
  minutosLimpiezaEntreReservas?: number
  creadoAt: string
  updatedAt: string
  rnt?: string | null
  rntVerificado?: boolean
  // Política de pagos
  permitePagarAlLlegar: boolean
  permiteDeposito30: boolean
  permiteTotal: boolean
  // Política de cancelación
  horasLibresCancelacion: number
  pctPenalidadCancelacion: number
  habitaciones: HabitacionTipo[]
  habitacionesFisicas?: HabitacionFisica[]
  comercio: {
    id: number
    nombre: string
    municipio: string
    departamento?: string | null
    latitud?: number | null
    longitud?: number | null
    logoUrl?: string | null
    calificacion: number | string
    totalReviews: number
    whatsapp?: string | null
    descripcion?: string | null
    verificadoEtnico?: boolean
  }
}

export interface PoliticaCancelacionInfo {
  horasRestantes: number
  penalizacionPct: number
  montoPenalidad: number
  montoReembolso: number
  dentroPlazoGratuito: boolean
}

export interface ReservaHotel {
  id: number
  codigo: string
  configHotelId: number
  habitacionTipoId: number
  habitacionFisicaId?: number | null
  clienteId: number
  fechaEntrada: string
  fechaSalida: string
  modalidad?: ModalidadReservaHotel | string
  duracionHoras?: number | string | null
  huespedes: number
  total: number | string
  estado: EstadoReservaHotel
  metodoPago: string
  notasCliente?: string | null
  nombreHuesped: string
  telefonoHuesped: string
  creadoAt: string
  montoDescuento?: number | null
  montoPenalidad?: number | null
  montoReembolso?: number | null
  codigoCupon?: string | null
  checkinOnlineAt?: string | null
  docTipo?: string | null
  docNumero?: string | null
  horaEstimadaLlegada?: string | null
  solicitudesEspeciales?: string | null
  tokenCheckin?: string | null
  grupoReservaId?: string | null
  habitacionTipo?: { nombre: string; fotos: string[]; precioPorNoche: number | string; precioPorHora?: number | string | null }
  habitacionFisica?: { id: number; nombre: string; piso?: string | null; zona?: string | null; estado?: string | null } | null
  configHotel?: {
    id: number
    checkInHora: string
    checkOutHora: string
    comercio: { nombre: string; municipio: string; logoUrl?: string | null }
  }
  cliente?: { nombre: string; email: string; telefono?: string | null }
  review?: { id: number } | null
}

// ── PÚBLICO ──────────────────────────────────────────────────
export async function listarHoteles(params?: { municipio?: string; departamento?: string }): Promise<ConfigHotel[]> {
  const q = new URLSearchParams()
  if (params?.municipio) q.set('municipio', params.municipio)
  if (params?.departamento) q.set('departamento', params.departamento)
  const qs = q.toString()
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel[] }>(`/hoteles${qs ? `?${qs}` : ''}`, { auth: false })
  return r.data
}

export async function obtenerHotel(id: number): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>(`/hoteles/${id}`, { auth: false })
  return r.data
}

export async function verificarDisponibilidad(
  habitacionTipoId: number,
  fechaEntrada: string,
  fechaSalida: string,
  modalidad?: ModalidadReservaHotel
) {
  const q = new URLSearchParams({ habitacionTipoId: String(habitacionTipoId), fechaEntrada, fechaSalida })
  if (modalidad) q.set('modalidad', modalidad)
  const r = await apiFetch<{ ok: boolean; data: { disponibles: number; total: number } }>(`/hoteles/disponibilidad?${q}`, { auth: false })
  return r.data
}

// ── CLIENTE ──────────────────────────────────────────────────
export interface CuponHotel {
  id: number
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number | string
  minimoNoches?: number | null
  usosMaximos?: number | null
  usosActuales: number
  activo: boolean
  inicio: string
  fin: string
  configHotelId?: number | null
  createdAt: string
}

export interface ValidacionCupon {
  cupon: CuponHotel
  descuento: number
  totalConDescuento: number
}

export async function validarCuponHotel(datos: {
  codigo: string
  habitacionTipoId: number
  fechaEntrada: string
  fechaSalida: string
  modalidad?: ModalidadReservaHotel
}): Promise<ValidacionCupon> {
  const r = await apiFetch<{ ok: boolean; data: ValidacionCupon }>('/hoteles/cupones/validar', { method: 'POST', body: datos, auth: false })
  return r.data
}

export async function listarCuponesHotel(): Promise<CuponHotel[]> {
  const r = await apiFetch<{ ok: boolean; data: CuponHotel[] }>('/hoteles/mi-hotel/cupones')
  return r.data
}

export async function crearCuponHotel(datos: {
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number
  minimoNoches?: number
  usosMaximos?: number
  inicio: string
  fin: string
}): Promise<CuponHotel> {
  const r = await apiFetch<{ ok: boolean; data: CuponHotel }>('/hoteles/mi-hotel/cupones', { method: 'POST', body: datos })
  return r.data
}

export async function eliminarCuponHotel(id: number): Promise<void> {
  await apiFetch(`/hoteles/mi-hotel/cupones/${id}`, { method: 'DELETE' })
}

export async function crearReserva(datos: {
  habitacionTipoId: number
  fechaEntrada: string
  fechaSalida: string
  modalidad?: ModalidadReservaHotel
  horaEntrada?: string
  horaSalida?: string
  huespedes: number
  metodoPago: string
  notasCliente?: string
  nombreHuesped: string
  telefonoHuesped: string
  codigoCupon?: string
}): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>('/hoteles/reservas', { method: 'POST', body: datos })
  return r.data
}

export async function misReservasHotel(): Promise<ReservaHotel[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel[] }>('/hoteles/reservas/mis')
  return r.data
}

export interface ReservaMultipleResultado {
  reservas: ReservaHotel[]
  grupoReservaId: string
  total: number
}

export async function crearReservaMultiple(datos: {
  habitaciones: { habitacionTipoId: number; huespedes: number }[]
  fechaEntrada: string
  fechaSalida: string
  modalidad?: ModalidadReservaHotel
  horaEntrada?: string
  horaSalida?: string
  metodoPago: string
  notasCliente?: string
  nombreHuesped: string
  telefonoHuesped: string
  codigoCupon?: string
}): Promise<ReservaMultipleResultado> {
  const r = await apiFetch<{ ok: boolean; data: ReservaMultipleResultado }>('/hoteles/reservas/multiple', { method: 'POST', body: datos })
  return r.data
}

export async function consultarPoliticaCancelacion(reservaId: number): Promise<PoliticaCancelacionInfo> {
  const r = await apiFetch<{ ok: boolean; data: PoliticaCancelacionInfo }>(`/hoteles/reservas/${reservaId}/politica-cancelacion`)
  return r.data
}

export async function cancelarReservaHotel(id: number): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>(`/hoteles/reservas/${id}/cancelar`, { method: 'PATCH' })
  return r.data
}

// ── HOTELERO ─────────────────────────────────────────────────
export async function obtenerMiHotel(): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>('/hoteles/mi-hotel/config')
  return r.data
}

export async function actualizarMiHotel(datos: Partial<ConfigHotel>): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>('/hoteles/mi-hotel/config', { method: 'PUT', body: datos })
  return r.data
}

export async function agregarHabitacion(datos: Partial<HabitacionTipo>): Promise<HabitacionTipo> {
  const r = await apiFetch<{ ok: boolean; data: HabitacionTipo }>('/hoteles/mi-hotel/habitaciones', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarHabitacion(id: number, datos: Partial<HabitacionTipo>): Promise<HabitacionTipo> {
  const r = await apiFetch<{ ok: boolean; data: HabitacionTipo }>(`/hoteles/mi-hotel/habitaciones/${id}`, { method: 'PUT', body: datos })
  return r.data
}

export async function eliminarHabitacion(id: number): Promise<void> {
  await apiFetch(`/hoteles/mi-hotel/habitaciones/${id}`, { method: 'DELETE' })
}

export async function reservasHotelero(params?: { estado?: string }): Promise<ReservaHotel[]> {
  const q = params?.estado ? `?estado=${params.estado}` : ''
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel[] }>(`/hoteles/mi-hotel/reservas${q}`)
  return r.data
}

export async function cambiarEstadoReserva(id: number, estado: EstadoReservaHotel, datos?: { habitacionFisicaId?: number }): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>(`/hoteles/mi-hotel/reservas/${id}/estado`, { method: 'PATCH', body: { estado, ...(datos ?? {}) } })
  return r.data
}

export async function listarHabitacionesFisicas(): Promise<HabitacionFisica[]> {
  const r = await apiFetch<{ ok: boolean; data: HabitacionFisica[] }>('/hoteles/mi-hotel/habitaciones-fisicas')
  return r.data
}

export async function crearHabitacionFisica(datos: Partial<HabitacionFisica>): Promise<HabitacionFisica> {
  const r = await apiFetch<{ ok: boolean; data: HabitacionFisica }>('/hoteles/mi-hotel/habitaciones-fisicas', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarHabitacionFisica(id: number, datos: Partial<HabitacionFisica>): Promise<HabitacionFisica> {
  const r = await apiFetch<{ ok: boolean; data: HabitacionFisica }>(`/hoteles/mi-hotel/habitaciones-fisicas/${id}`, { method: 'PUT', body: datos })
  return r.data
}

export async function cambiarEstadoHabitacionFisica(id: number, estado: EstadoHabitacionFisica): Promise<HabitacionFisica> {
  const r = await apiFetch<{ ok: boolean; data: HabitacionFisica }>(`/hoteles/mi-hotel/habitaciones-fisicas/${id}/estado`, { method: 'PATCH', body: { estado } })
  return r.data
}

export async function eliminarHabitacionFisica(id: number): Promise<void> {
  await apiFetch(`/hoteles/mi-hotel/habitaciones-fisicas/${id}`, { method: 'DELETE' })
}

export async function asignarHabitacionFisicaReserva(reservaId: number, habitacionFisicaId: number): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>(`/hoteles/mi-hotel/reservas/${reservaId}/habitacion-fisica`, {
    method: 'PATCH',
    body: { habitacionFisicaId },
  })
  return r.data
}

export async function subirFotosHabitacion(habitacionId: number, files: File[]): Promise<HabitacionTipo> {
  const fd = new FormData()
  files.forEach(f => fd.append('fotos', f))
  const { obtenerToken } = await import('./client')
  const token = obtenerToken()
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
  const res = await fetch(`${API}/hoteles/mi-hotel/habitaciones/${habitacionId}/fotos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j?.error ?? 'Error al subir fotos')
  return j.data
}

export async function subirVideoHabitacion(
  habitacionId: number,
  file: File,
  meta?: { duracionSegundos?: number; ancho?: number; alto?: number; bytes?: number; mimeType?: string; formato?: string; recorteInicioSegundos?: number; recorteFinSegundos?: number }
): Promise<{ videoUrl: string; videoPosterUrl?: string; videoDuracionSeg?: number }> {
  const fd = new FormData()
  fd.append('video', file)
  if (meta) {
    if (meta.duracionSegundos != null) fd.append('duracionSegundos', String(meta.duracionSegundos))
    if (meta.ancho != null)            fd.append('ancho', String(meta.ancho))
    if (meta.alto != null)             fd.append('alto', String(meta.alto))
    if (meta.bytes != null)            fd.append('bytes', String(meta.bytes))
    if (meta.mimeType)                 fd.append('mimeType', meta.mimeType)
    if (meta.formato)                  fd.append('formato', meta.formato)
    if (meta.recorteInicioSegundos != null) fd.append('recorteInicioSegundos', String(meta.recorteInicioSegundos))
    if (meta.recorteFinSegundos != null)    fd.append('recorteFinSegundos', String(meta.recorteFinSegundos))
  }
  const { obtenerToken } = await import('./client')
  const token = obtenerToken()
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
  const res = await fetch(`${API}/hoteles/mi-hotel/habitaciones/${habitacionId}/video`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j?.error ?? 'Error al subir video')
  return j.data
}

export async function quitarVideoHabitacion(habitacionId: number): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `/hoteles/mi-hotel/habitaciones/${habitacionId}/video`,
    { method: 'DELETE', auth: true }
  )
}

export async function guardarVideoLinkHabitacion(habitacionId: number, videoUrl: string): Promise<void> {
  await apiFetch(`/hoteles/mi-hotel/habitaciones/${habitacionId}/video-link`, { method: 'PATCH', body: { videoUrl } as any })
}

export async function ocupacionHotel(): Promise<{ habitaciones: HabitacionTipo[]; habitacionesFisicas: HabitacionFisica[]; reservas: ReservaHotel[] }> {
  const r = await apiFetch<{ ok: boolean; data: { habitaciones: HabitacionTipo[]; habitacionesFisicas: HabitacionFisica[]; reservas: ReservaHotel[] } }>('/hoteles/mi-hotel/ocupacion')
  return r.data
}

// ── ADMIN ─────────────────────────────────────────────────────
export interface HotelAdmin extends ConfigHotel {
  _count: { reservas: number }
}

export async function adminListarHoteles(): Promise<HotelAdmin[]> {
  const r = await apiFetch<{ ok: boolean; data: HotelAdmin[] }>('/hoteles/admin/todos')
  return r.data
}

export async function adminCambiarEstadoHotel(id: number, activo: boolean): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>(`/hoteles/admin/${id}/estado`, { method: 'PATCH', body: { activo } })
  return r.data
}

export async function adminVerificarRntHotel(id: number, verificado: boolean): Promise<ConfigHotel> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel }>(`/hoteles/admin/${id}/rnt`, { method: 'PATCH', body: { verificado } })
  return r.data
}

export async function adminReservasHotel(id: number): Promise<ReservaHotel[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel[] }>(`/hoteles/admin/${id}/reservas`)
  return r.data
}

// ── BLOQUEOS ─────────────────────────────────────────────────
export interface BloqueoFecha {
  id: string
  habitacionId: number | null
  fechaInicio: string
  fechaFin: string
  motivo: string | null
}

export async function listarBloqueos(): Promise<BloqueoFecha[]> {
  const d = await apiFetch<{ ok: boolean; data: BloqueoFecha[] }>('/hoteles/mi-hotel/bloqueos', { auth: true })
  return d.data
}

export async function crearBloqueo(datos: { habitacionId?: number | null; fechaInicio: string; fechaFin: string; motivo?: string }): Promise<BloqueoFecha> {
  const d = await apiFetch<{ ok: boolean; data: BloqueoFecha }>('/hoteles/mi-hotel/bloqueos', { method: 'POST', body: datos, auth: true })
  return d.data
}

export async function eliminarBloqueo(bloqueoId: string): Promise<void> {
  await apiFetch(`/hoteles/mi-hotel/bloqueos/${bloqueoId}`, { method: 'DELETE', auth: true })
}

export async function iniciarPagoReserva(reservaId: number): Promise<{ checkoutUrl: string; referencia: string; montoDeposito: number; pct: number }> {
  const d = await apiFetch<{ ok: boolean; data: any }>(`/hoteles/reservas/${reservaId}/checkout`, { method: 'POST', auth: true })
  return d.data
}

// ── CHECK-IN ONLINE ───────────────────────────────────────────
export interface CheckinInfo {
  token: string
  reserva: ReservaHotel
}

export async function solicitarTokenCheckin(reservaId: number): Promise<CheckinInfo> {
  const r = await apiFetch<{ ok: boolean; data: CheckinInfo }>(`/hoteles/reservas/${reservaId}/checkin-token`, { method: 'POST' })
  return r.data
}

export async function verCheckinPublico(token: string): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>(`/hoteles/checkin/${token}`, { auth: false })
  return r.data
}

export async function realizarCheckin(token: string, datos: {
  docTipo: string
  docNumero: string
  horaEstimadaLlegada?: string
  solicitudesEspeciales?: string
}): Promise<ReservaHotel> {
  const r = await apiFetch<{ ok: boolean; data: ReservaHotel }>(`/hoteles/checkin/${token}`, { method: 'POST', body: datos, auth: false })
  return r.data
}

// ── TEMPORADAS ────────────────────────────────────────────────
export async function listarTemporadasHotel(): Promise<TemporadaHotel[]> {
  const r = await apiFetch<{ ok: boolean; data: TemporadaHotel[] }>('/hoteles/mi-hotel/temporadas')
  return r.data
}

export async function crearTemporadaHotel(datos: {
  nombre: string
  inicio: string
  fin: string
  precioPorNoche: number
  habitacionTipoId?: number | null
}): Promise<TemporadaHotel> {
  const r = await apiFetch<{ ok: boolean; data: TemporadaHotel }>('/hoteles/mi-hotel/temporadas', { method: 'POST', body: datos })
  return r.data
}

export async function eliminarTemporadaHotel(id: number): Promise<void> {
  await apiFetch(`/hoteles/mi-hotel/temporadas/${id}`, { method: 'DELETE' })
}

export async function obtenerEstadisticasHotel(params?: { desde?: string; hasta?: string }): Promise<EstadisticasHotel> {
  const qs = params?.desde && params?.hasta
    ? `?${new URLSearchParams({ desde: params.desde, hasta: params.hasta }).toString()}`
    : ''
  const r = await apiFetch<{ ok: boolean; data: EstadisticasHotel }>(`/hoteles/mi-hotel/estadisticas${qs}`)
  return r.data
}

export async function toggleFavoritoHotel(configHotelId: number): Promise<{ favorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; data: { favorito: boolean } }>(`/hoteles/favoritos/${configHotelId}/toggle`, { method: 'POST' })
  return r.data
}

export async function misFavoritosHoteles(): Promise<ConfigHotel[]> {
  const r = await apiFetch<{ ok: boolean; data: ConfigHotel[] }>('/hoteles/favoritos/mis')
  return r.data
}

export async function esFavoritoHotel(configHotelId: number): Promise<{ favorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; data: { favorito: boolean } }>(`/hoteles/favoritos/${configHotelId}`)
  return r.data
}
