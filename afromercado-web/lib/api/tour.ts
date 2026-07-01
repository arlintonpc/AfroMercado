import { apiFetch } from './client'

export type EstadoReservaTour = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'RECHAZADA' | 'COMPLETADA'
export type TipoTourLugarMedia = 'FOTO' | 'VIDEO' | 'VIDEO_LINK'

export interface TourLugarMedia {
  id: number
  tourLugarId: number
  tipo: TipoTourLugarMedia
  url: string
  posterUrl?: string | null
  titulo?: string | null
  descripcion?: string | null
  plataforma?: string | null
  orden: number
  activo: boolean
  publicId?: string | null
  duracionSegundos?: number | null
  bytes?: number | null
  formato?: string | null
  mimeType?: string | null
  creadoAt: string
  updatedAt: string
}

export interface TourLugar {
  id: number
  configTourId: number
  titulo: string
  descripcion?: string | null
  tipo?: string | null
  rutaNombre?: string | null
  orden: number
  duracionMinutos?: number | null
  recomendaciones?: string | null
  latitud?: number | null
  longitud?: number | null
  activo: boolean
  destacado: boolean
  creadoAt: string
  updatedAt: string
  media: TourLugarMedia[]
}

export interface ConfigTour {
  id: number
  comercioId: number
  activo: boolean
  nombre: string
  descripcion?: string | null
  duracionHoras: number
  precioPersona: number | string
  maxParticipantes: number
  puntoEncuentro?: string | null
  videoUrl?: string | null
  videoPosterUrl?: string | null
  fotos: string[]
  servicios: string[]
  idiomas: string[]
  lugares?: TourLugar[]
  confirmacionAuto: boolean
  horasLimiteConfirm: number
  politicaCancelacion?: string | null
  creadoAt: string
  updatedAt: string
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
  }
}

export interface ReservaTour {
  id: number
  codigo: string
  configTourId: number
  clienteId?: number
  fechaTour: string
  participantes: number
  total: number | string
  estado: EstadoReservaTour
  metodoPago: string
  notasCliente?: string | null
  nombreContacto: string
  telefonoContacto: string
  creadoAt: string
  comision?: number | null
  montoDescuento?: number | null
  codigoCupon?: string | null
  configTour?: ConfigTour
  cliente?: { id: number; nombre: string; email: string; telefono?: string | null }
  review?: { id: number } | null
}

// ── PÚBLICO ─────────────────────────────────────────────────
export async function listarTours(params?: { municipio?: string; departamento?: string }): Promise<ConfigTour[]> {
  const q = new URLSearchParams(params as Record<string, string> ?? {}).toString()
  const r = await apiFetch<{ ok: boolean; data: ConfigTour[] }>(`/tours${q ? `?${q}` : ''}`)
  return r.data
}

export async function obtenerTour(id: number): Promise<ConfigTour> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>(`/tours/${id}`)
  return r.data
}

export async function verificarDisponibilidadTour(configTourId: number, fecha: string): Promise<{ disponibles: number; maxParticipantes: number }> {
  const r = await apiFetch<{ ok: boolean; data: { disponibles: number; maxParticipantes: number } }>(
    `/tours/disponibilidad?configTourId=${configTourId}&fecha=${fecha}`
  )
  return r.data
}

// ── CLIENTE ──────────────────────────────────────────────────
export async function crearReservaTour(datos: {
  configTourId: number
  fechaTour: string
  participantes: number
  metodoPago: string
  notasCliente?: string
  nombreContacto: string
  telefonoContacto: string
  codigoCupon?: string
}): Promise<ReservaTour> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTour }>('/tours/reservas', { method: 'POST', body: datos })
  return r.data
}

export async function misReservasTour(): Promise<ReservaTour[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTour[] }>('/tours/reservas/mis')
  return r.data
}

export async function cancelarReservaTour(id: number): Promise<ReservaTour> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTour }>(`/tours/reservas/${id}/cancelar`, { method: 'PATCH' })
  return r.data
}

// ── OPERADOR ─────────────────────────────────────────────────
export async function obtenerMiTour(): Promise<ConfigTour> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>('/tours/mi-tour/config')
  return r.data
}

export async function actualizarMiTour(datos: Partial<ConfigTour>): Promise<ConfigTour> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>('/tours/mi-tour/config', { method: 'PUT', body: datos })
  return r.data
}

export async function reservasOperadorTour(estado?: string): Promise<ReservaTour[]> {
  const q = estado ? `?estado=${estado}` : ''
  const r = await apiFetch<{ ok: boolean; data: ReservaTour[] }>(`/tours/mi-tour/reservas${q}`)
  return r.data
}

export async function cambiarEstadoReservaTour(id: number, estado: EstadoReservaTour): Promise<ReservaTour> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTour }>(`/tours/mi-tour/reservas/${id}/estado`, { method: 'PATCH', body: { estado } })
  return r.data
}

// Ruta / lugares del tour
export async function listarLugaresTour(): Promise<TourLugar[]> {
  const r = await apiFetch<{ ok: boolean; data: TourLugar[] }>('/tours/mi-tour/lugares')
  return r.data ?? []
}

export async function crearLugarTour(datos: Partial<TourLugar>): Promise<TourLugar> {
  const r = await apiFetch<{ ok: boolean; data: TourLugar }>('/tours/mi-tour/lugares', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarLugarTour(id: number, datos: Partial<TourLugar>): Promise<TourLugar> {
  const r = await apiFetch<{ ok: boolean; data: TourLugar }>(`/tours/mi-tour/lugares/${id}`, { method: 'PATCH', body: datos })
  return r.data
}

export async function eliminarLugarTour(id: number): Promise<void> {
  await apiFetch(`/tours/mi-tour/lugares/${id}`, { method: 'DELETE' })
}

export async function reordenarLugaresTour(ids: number[]): Promise<TourLugar[]> {
  const r = await apiFetch<{ ok: boolean; data: TourLugar[] }>('/tours/mi-tour/lugares/orden', { method: 'PATCH', body: { ids } })
  return r.data ?? []
}

export async function subirFotosLugarTour(lugarId: number, archivos: FileList | File[]): Promise<TourLugar> {
  const form = new FormData()
  Array.from(archivos).forEach(f => form.append('fotos', f))
  const r = await apiFetch<{ ok: boolean; data: TourLugar }>(`/tours/mi-tour/lugares/${lugarId}/fotos`, { method: 'POST', body: form })
  return r.data
}

export async function eliminarMediaLugarTour(lugarId: number, mediaId: number): Promise<TourLugar> {
  const r = await apiFetch<{ ok: boolean; data: TourLugar }>(`/tours/mi-tour/lugares/${lugarId}/media/${mediaId}`, { method: 'DELETE' })
  return r.data
}

export async function subirVideoLugarTour(
  lugarId: number,
  file: File,
  meta?: { duracionSegundos?: number; ancho?: number; alto?: number; bytes?: number; mimeType?: string; formato?: string; recorteInicioSegundos?: number; recorteFinSegundos?: number; titulo?: string; descripcion?: string }
): Promise<TourLugar> {
  const form = new FormData()
  form.append('video', file)
  if (meta?.duracionSegundos != null) form.append('duracionSegundos', String(meta.duracionSegundos))
  if (meta?.ancho != null) form.append('ancho', String(meta.ancho))
  if (meta?.alto != null) form.append('alto', String(meta.alto))
  if (meta?.bytes != null) form.append('bytes', String(meta.bytes))
  if (meta?.mimeType) form.append('mimeType', meta.mimeType)
  if (meta?.formato) form.append('formato', meta.formato)
  if (meta?.recorteInicioSegundos != null) form.append('recorteInicioSegundos', String(meta.recorteInicioSegundos))
  if (meta?.recorteFinSegundos != null) form.append('recorteFinSegundos', String(meta.recorteFinSegundos))
  if (meta?.titulo) form.append('titulo', meta.titulo)
  if (meta?.descripcion) form.append('descripcion', meta.descripcion)
  const r = await apiFetch<{ ok: boolean; data: TourLugar }>(`/tours/mi-tour/lugares/${lugarId}/video`, { method: 'POST', body: form })
  return r.data
}

export async function quitarVideoLugarTour(lugarId: number): Promise<TourLugar> {
  const r = await apiFetch<{ ok: boolean; data: TourLugar }>(`/tours/mi-tour/lugares/${lugarId}/video`, { method: 'DELETE' })
  return r.data
}

export async function guardarVideoLinkLugarTour(lugarId: number, datos: { url: string; titulo?: string; descripcion?: string; plataforma?: string }): Promise<TourLugar> {
  const r = await apiFetch<{ ok: boolean; data: TourLugar }>(`/tours/mi-tour/lugares/${lugarId}/video-link`, { method: 'POST', body: datos })
  return r.data
}

// ── ADMIN ─────────────────────────────────────────────────────
export interface TourAdmin extends ConfigTour {
  _count: { reservas: number }
}

export async function adminListarTours(): Promise<TourAdmin[]> {
  const r = await apiFetch<{ ok: boolean; data: TourAdmin[] }>('/tours/admin/todos')
  return r.data
}

export async function adminCambiarEstadoTour(id: number, activo: boolean): Promise<ConfigTour> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>(`/tours/admin/${id}/estado`, { method: 'PATCH', body: { activo } })
  return r.data
}

export interface ReservaAdminTour {
  id: number
  codigo: string
  estado: EstadoReservaTour
  fechaTour: string
  participantes: number
  total: number | string
  metodoPago: string
  creadoAt: string
  cliente: { nombre: string; email: string }
}

export async function adminReservasTour(configId: number): Promise<ReservaAdminTour[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaAdminTour[] }>(`/tours/admin/${configId}/reservas`)
  return r.data
}

// ── CUPONES TOUR ──────────────────────────────────────────────

export interface CuponTour {
  id: number
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number
  minimoPersonas: number | null
  usosMaximos: number | null
  usosActuales: number
  activo: boolean
  inicio: string
  fin: string
  configTourId: number | null
  createdAt: string
  _count?: { usos: number }
}

export interface ValidacionCuponTour {
  cupon: CuponTour
  descuento: number
  subtotalConDescuento: number
}

export async function validarCuponTour(codigo: string, configTourId: number, participantes: number): Promise<ValidacionCuponTour> {
  const r = await apiFetch<{ ok: boolean; data: ValidacionCuponTour }>('/tours/cupones/validar', {
    method: 'POST',
    body: { codigo, configTourId, participantes },
  })
  return r.data
}

export async function listarCuponesTour(): Promise<CuponTour[]> {
  const r = await apiFetch<{ ok: boolean; data: CuponTour[] }>('/tours/mi-tour/cupones')
  return r.data ?? []
}

export async function crearCuponTour(datos: {
  codigo: string; tipo: 'PORCENTAJE' | 'VALOR_FIJO'; valor: number
  minimoPersonas?: number; usosMaximos?: number; inicio: string; fin: string
}): Promise<CuponTour> {
  const r = await apiFetch<{ ok: boolean; data: CuponTour }>('/tours/mi-tour/cupones', { method: 'POST', body: datos })
  return r.data
}

export async function eliminarCuponTour(id: number): Promise<void> {
  await apiFetch(`/tours/mi-tour/cupones/${id}`, { method: 'DELETE' })
}

// ── FAVORITOS TOUR ────────────────────────────────────────────

export async function toggleFavoritoTour(id: number): Promise<{ esFavorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; data: { esFavorito: boolean } }>(`/tours/favoritos/${id}/toggle`, { method: 'POST', body: {} })
  return r.data
}

export async function misFavoritosTour(): Promise<ConfigTour[]> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTour[] }>('/tours/favoritos/mis')
  return r.data ?? []
}

export async function esFavoritoTour(id: number): Promise<boolean> {
  try {
    const r = await apiFetch<{ ok: boolean; data: { esFavorito: boolean } }>(`/tours/favoritos/${id}`)
    return r.data?.esFavorito ?? false
  } catch { return false }
}

// ── ESTADÍSTICAS TOUR ─────────────────────────────────────────

export interface EstadisticasTour {
  mes: { reservas: number; ingresos: number; comision: number; participantes: number }
  mesAnterior: { reservas: number; ingresos: number }
  totalHistorico: number
  proximasReservas: Array<{ id: number; codigo: string; fechaTour: string; participantes: number; total: number; nombreContacto: string }>
  porMes: Array<{ mes: string; reservas: number; ingresos: number }>
}

export async function obtenerEstadisticasTour(): Promise<EstadisticasTour> {
  const r = await apiFetch<{ ok: boolean; data: EstadisticasTour }>('/tours/mi-tour/estadisticas')
  return r.data
}

// ── VIDEO TOUR ────────────────────────────────────────────────

export async function subirVideoTour(
  file: File,
  meta?: { duracionSegundos?: number; ancho?: number; alto?: number; bytes?: number; mimeType?: string; formato?: string; recorteInicioSegundos?: number; recorteFinSegundos?: number }
): Promise<{ videoUrl: string; videoPosterUrl?: string }> {
  const form = new FormData()
  form.append('video', file)
  if (meta?.duracionSegundos != null) form.append('duracionSegundos', String(meta.duracionSegundos))
  if (meta?.ancho != null) form.append('ancho', String(meta.ancho))
  if (meta?.alto != null) form.append('alto', String(meta.alto))
  if (meta?.bytes != null) form.append('bytes', String(meta.bytes))
  if (meta?.mimeType) form.append('mimeType', meta.mimeType)
  if (meta?.formato) form.append('formato', meta.formato)
  if (meta?.recorteInicioSegundos != null) form.append('recorteInicioSegundos', String(meta.recorteInicioSegundos))
  if (meta?.recorteFinSegundos != null) form.append('recorteFinSegundos', String(meta.recorteFinSegundos))
  const r = await apiFetch<{ ok: boolean; data: any }>('/tours/mi-tour/config/video', { method: 'POST', body: form })
  return r.data
}

export async function quitarVideoTour(): Promise<void> {
  await apiFetch('/tours/mi-tour/config/video', { method: 'DELETE' })
}

export async function guardarVideoLinkTour(videoUrl: string): Promise<void> {
  await apiFetch('/tours/mi-tour/config/video-link', { method: 'PATCH', body: { videoUrl } as any })
}

export async function subirFotosTour(archivos: FileList): Promise<ConfigTour> {
  const form = new FormData()
  Array.from(archivos).forEach(f => form.append('fotos', f))
  const r = await apiFetch<{ ok: boolean; data: ConfigTour }>('/tours/mi-tour/config/fotos', { method: 'POST', body: form })
  return r.data
}
