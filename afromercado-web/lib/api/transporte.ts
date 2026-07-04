import { apiFetch } from './client'

export type EstadoReservaTransporte = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'RECHAZADA' | 'COMPLETADA'

export interface RutaTransporte {
  id: number
  configTransporteId: number
  origen: string
  destino: string
  horario: string
  diasSemana: string[]
  capacidad: number
  precioAsiento: number | string
  activo: boolean
  creadoAt: string
}

export interface ConfigTransporte {
  id: number
  comercioId: number
  activo: boolean
  nombre: string
  descripcion?: string | null
  tipo: string
  fotos: string[]
  videoUrl?: string | null
  videoPosterUrl?: string | null
  creadoAt: string
  updatedAt: string
  rutas: RutaTransporte[]
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
  }
}

export interface ReservaTransporte {
  id: number
  codigo: string
  rutaTransporteId: number
  clienteId?: number
  fechaViaje: string
  asientos: number
  total: number | string
  estado: EstadoReservaTransporte
  metodoPago: string
  notasCliente?: string | null
  nombreContacto: string
  telefonoContacto: string
  creadoAt: string
  montoDescuento?: number | null
  codigoCupon?: string | null
  ruta?: RutaTransporte & { configTransporte?: ConfigTransporte }
  cliente?: { id: number; nombre: string; email: string }
}

// ── CUPONES ───────────────────────────────────────────────────
export interface CuponTransporte {
  id: number
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number | string
  minimoAsientos?: number | null
  usosMaximos?: number | null
  usosActuales: number
  activo: boolean
  inicio: string
  fin: string
  configTransporteId?: number | null
  createdAt: string
}

export interface ValidacionCuponTransporte {
  cupon: CuponTransporte
  descuento: number
  totalConDescuento: number
}

export async function validarCuponTransporte(datos: {
  codigo: string
  rutaTransporteId: number
  asientos: number
}): Promise<ValidacionCuponTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ValidacionCuponTransporte }>('/transportes/cupones/validar', { method: 'POST', body: datos, auth: false })
  return r.data
}

export async function listarCuponesTransporte(): Promise<CuponTransporte[]> {
  const r = await apiFetch<{ ok: boolean; data: CuponTransporte[] }>('/transportes/mi-transporte/cupones')
  return r.data
}

export async function crearCuponTransporte(datos: {
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number
  minimoAsientos?: number
  usosMaximos?: number
  inicio: string
  fin: string
}): Promise<CuponTransporte> {
  const r = await apiFetch<{ ok: boolean; data: CuponTransporte }>('/transportes/mi-transporte/cupones', { method: 'POST', body: datos })
  return r.data
}

export async function eliminarCuponTransporte(id: number): Promise<void> {
  await apiFetch(`/transportes/mi-transporte/cupones/${id}`, { method: 'DELETE' })
}

// ── PÚBLICO ──────────────────────────────────────────────────
export async function listarTransportes(params?: { municipio?: string; departamento?: string }): Promise<ConfigTransporte[]> {
  const q = new URLSearchParams((params ?? {}) as Record<string, string>).toString()
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte[] }>(`/transportes${q ? `?${q}` : ''}`)
  return r.data
}

export async function obtenerTransporte(id: number): Promise<ConfigTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte }>(`/transportes/${id}`)
  return r.data
}

export async function verificarDisponibilidadTransporte(rutaId: number, fecha: string): Promise<{ disponibles: number; capacidad: number }> {
  const r = await apiFetch<{ ok: boolean; data: { disponibles: number; capacidad: number } }>(
    `/transportes/disponibilidad?rutaId=${rutaId}&fecha=${fecha}`
  )
  return r.data
}

// ── CLIENTE ──────────────────────────────────────────────────
export async function crearReservaTransporte(datos: {
  rutaTransporteId: number
  fechaViaje: string
  asientos: number
  metodoPago: string
  notasCliente?: string
  nombreContacto: string
  telefonoContacto: string
  codigoCupon?: string
}): Promise<ReservaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte }>('/transportes/reservas', { method: 'POST', body: datos })
  return r.data
}

export async function misReservasTransporte(): Promise<ReservaTransporte[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte[] }>('/transportes/reservas/mis')
  return r.data
}

export async function cancelarReservaTransporte(id: number): Promise<ReservaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte }>(`/transportes/reservas/${id}/cancelar`, { method: 'PATCH' })
  return r.data
}

// ── OPERADOR ─────────────────────────────────────────────────
export async function obtenerMiTransporte(): Promise<ConfigTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte }>('/transportes/mi-transporte/config')
  return r.data
}

export async function actualizarMiTransporte(datos: Partial<ConfigTransporte>): Promise<ConfigTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte }>('/transportes/mi-transporte/config', { method: 'PUT', body: datos })
  return r.data
}

export async function agregarRuta(datos: Partial<RutaTransporte>): Promise<RutaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: RutaTransporte }>('/transportes/mi-transporte/rutas', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarRuta(id: number, datos: Partial<RutaTransporte>): Promise<RutaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: RutaTransporte }>(`/transportes/mi-transporte/rutas/${id}`, { method: 'PUT', body: datos })
  return r.data
}

export async function eliminarRuta(id: number): Promise<void> {
  await apiFetch(`/transportes/mi-transporte/rutas/${id}`, { method: 'DELETE' })
}

export async function reservasOperadorTransporte(estado?: string): Promise<ReservaTransporte[]> {
  const q = estado ? `?estado=${estado}` : ''
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte[] }>(`/transportes/mi-transporte/reservas${q}`)
  return r.data
}

export async function cambiarEstadoReservaTransporte(id: number, estado: EstadoReservaTransporte): Promise<ReservaTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte }>(`/transportes/mi-transporte/reservas/${id}/estado`, { method: 'PATCH', body: { estado } })
  return r.data
}

export async function subirFotosTransporte(files: File[]): Promise<ConfigTransporte> {
  const fd = new FormData()
  files.forEach(f => fd.append('fotos', f))
  const { obtenerToken } = await import('./client')
  const token = obtenerToken()
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
  const res = await fetch(`${API}/transportes/mi-transporte/config/fotos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j?.error ?? 'Error al subir fotos')
  return j.data
}

// ── ADMIN ─────────────────────────────────────────────────────
export interface TransporteAdmin extends ConfigTransporte {
  _count: { rutas: number }
}

export async function adminListarTransportes(): Promise<TransporteAdmin[]> {
  const r = await apiFetch<{ ok: boolean; data: TransporteAdmin[] }>('/transportes/admin/todos')
  return r.data
}

export async function adminCambiarEstadoTransporte(id: number, activo: boolean): Promise<ConfigTransporte> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte }>(`/transportes/admin/${id}/estado`, { method: 'PATCH', body: { activo } })
  return r.data
}

// ── VIDEO TRANSPORTE ──────────────────────────────────────────

export async function subirVideoTransporte(
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
  const r = await apiFetch<{ ok: boolean; data: any }>('/transportes/mi-transporte/config/video', { method: 'POST', body: form })
  return r.data
}

export async function quitarVideoTransporte(): Promise<void> {
  await apiFetch('/transportes/mi-transporte/config/video', { method: 'DELETE' })
}

export async function guardarVideoLinkTransporte(videoUrl: string): Promise<void> {
  await apiFetch('/transportes/mi-transporte/config/video-link', { method: 'PATCH', body: { videoUrl } as any })
}

export async function toggleFavoritoTransporte(configTransporteId: number): Promise<{ favorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; data: { favorito: boolean } }>(`/transportes/favoritos/${configTransporteId}/toggle`, { method: 'POST' })
  return r.data
}

export async function esFavoritoTransporte(configTransporteId: number): Promise<{ favorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; data: { favorito: boolean } }>(`/transportes/favoritos/${configTransporteId}`)
  return r.data
}

export async function misTransportesFavoritos(): Promise<ConfigTransporte[]> {
  const r = await apiFetch<{ ok: boolean; data: ConfigTransporte[] }>('/transportes/favoritos/mis')
  return r.data
}

export interface EstadisticasTransporte {
  totalReservas: number
  reservasConfirmadas: number
  reservasCompletadas: number
  reservasCanceladas: number
  ingresoTotal: number
  ingresoMes: number
  reservasPorMes: Array<{ mes: string; total: number; ingresos: number }>
  rutasPopulares: Array<{ origen: string; destino: string; total: number }>
  ocupacionPromedio: number
  rango?: {
    reservas: number
    ingresos: number
    canceladas: number
    rutasPopulares: EstadisticasTransporte['rutasPopulares']
    desde: string
    hasta: string
  }
}

export async function estadisticasTransporte(params?: { desde?: string; hasta?: string }): Promise<EstadisticasTransporte> {
  const qs = params?.desde && params?.hasta
    ? `?${new URLSearchParams({ desde: params.desde, hasta: params.hasta }).toString()}`
    : ''
  const r = await apiFetch<{ ok: boolean; data: EstadisticasTransporte }>(`/transportes/mi-transporte/estadisticas${qs}`)
  return r.data
}

export async function adminReservasTransporte(configId: number): Promise<ReservaTransporte[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaTransporte[] }>(`/transportes/admin/${configId}/reservas`)
  return r.data
}
