import { apiFetch, API_URL, obtenerToken } from './client'

export type TipoInmueble = 'LOTE' | 'CASA' | 'APARTAMENTO' | 'FINCA' | 'LOCAL_COMERCIAL' | 'BODEGA' | 'OTRO'
export type TipoOperacionInmueble = 'VENTA' | 'ARRIENDO'
export type EstadoInmueble = 'BORRADOR' | 'PUBLICADO' | 'PAUSADO' | 'CERRADO'
export type EstadoModeracionInmueble = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
export type MotivoDenunciaInmueble = 'PUBLICACION_FALSA' | 'TIERRA_EN_DISPUTA' | 'ESTAFA_DINERO' | 'DOCUMENTO_FALSO' | 'CONTENIDO_INAPROPIADO' | 'OTRO'

export const TIPOS_INMUEBLE: { value: TipoInmueble; label: string; icono: string }[] = [
  { value: 'LOTE',            label: 'Lote',             icono: '📐' },
  { value: 'CASA',            label: 'Casa',             icono: '🏠' },
  { value: 'APARTAMENTO',     label: 'Apartamento',      icono: '🏢' },
  { value: 'FINCA',           label: 'Finca',            icono: '🌾' },
  { value: 'LOCAL_COMERCIAL', label: 'Local comercial',  icono: '🏪' },
  { value: 'BODEGA',          label: 'Bodega',           icono: '📦' },
  { value: 'OTRO',            label: 'Otro',             icono: '🏘️' },
]

export const LABEL_TIPO_INMUEBLE: Record<TipoInmueble, string> =
  Object.fromEntries(TIPOS_INMUEBLE.map(t => [t.value, t.label])) as Record<TipoInmueble, string>

export const ICONO_TIPO_INMUEBLE: Record<TipoInmueble, string> =
  Object.fromEntries(TIPOS_INMUEBLE.map(t => [t.value, t.icono])) as Record<TipoInmueble, string>

export const TIPOS_OPERACION_INMUEBLE: { value: TipoOperacionInmueble; label: string }[] = [
  { value: 'VENTA',    label: 'Venta' },
  { value: 'ARRIENDO', label: 'Arriendo' },
]

export const LABEL_TIPO_OPERACION_INMUEBLE: Record<TipoOperacionInmueble, string> =
  Object.fromEntries(TIPOS_OPERACION_INMUEBLE.map(t => [t.value, t.label])) as Record<TipoOperacionInmueble, string>

export const MOTIVOS_DENUNCIA_INMUEBLE: { value: MotivoDenunciaInmueble; label: string }[] = [
  { value: 'PUBLICACION_FALSA',   label: 'Publicación falsa' },
  { value: 'TIERRA_EN_DISPUTA',   label: 'Tierra en disputa' },
  { value: 'ESTAFA_DINERO',       label: 'Estafa / solicitud de dinero' },
  { value: 'DOCUMENTO_FALSO',     label: 'Documento falso' },
  { value: 'CONTENIDO_INAPROPIADO', label: 'Contenido inapropiado' },
  { value: 'OTRO',                label: 'Otro' },
]

export type EstadoDenunciaInmueble = 'PENDIENTE' | 'DESESTIMADA' | 'PUBLICACION_BLOQUEADA' | 'CUENTA_BLOQUEADA'
export type AccionModerarInmueble = 'APROBAR' | 'RECHAZAR'
export type AccionResolverDenunciaInmueble = 'DESESTIMAR' | 'BLOQUEAR_PUBLICACION' | 'BLOQUEAR_CUENTA'

export interface Inmueble {
  id: number
  publicadorId: number
  comercioId?: number | null
  titulo: string
  descripcion?: string | null
  tipoInmueble: TipoInmueble
  tipoOperacion: TipoOperacionInmueble
  precio: number | string
  areaM2?: number | null
  habitaciones?: number | null
  banos?: number | null
  departamento: string
  municipio: string
  vereda?: string | null
  direccionReferencia?: string | null
  latitud?: number | null
  longitud?: number | null
  fotoUrls: string[]
  folioMatricula?: string | null
  /** Privada — nunca mostrarla en listado ni detalle público, solo la ve un admin en /admin/inmuebles. */
  documentoSoporteUrl?: string | null
  contactoWhatsapp?: string | null
  estado: EstadoInmueble
  estadoModeracion: EstadoModeracionInmueble
  motivoRechazoModeracion?: string | null
  createdAt: string
  publicador?: { nombre: string; email: string; telefono?: string | null }
}

export interface DenunciaInmueble {
  id: number
  inmuebleId: number
  denuncianteId: number
  motivo: MotivoDenunciaInmueble
  descripcion?: string | null
  estado: EstadoDenunciaInmueble
  createdAt: string
  inmueble?: { titulo: string; id: number }
  denunciante?: { nombre: string }
}

interface RespuestaApi<T> {
  ok: boolean
  data: T
}

// ── PÚBLICO ──────────────────────────────────────────────────
export async function listarInmuebles(filtros: {
  departamento?: string
  municipio?: string
  tipoInmueble?: TipoInmueble
  tipoOperacion?: TipoOperacionInmueble
  precioMax?: number
} = {}): Promise<Inmueble[]> {
  const params = new URLSearchParams()
  if (filtros.departamento) params.set('departamento', filtros.departamento)
  if (filtros.municipio) params.set('municipio', filtros.municipio)
  if (filtros.tipoInmueble) params.set('tipoInmueble', filtros.tipoInmueble)
  if (filtros.tipoOperacion) params.set('tipoOperacion', filtros.tipoOperacion)
  if (filtros.precioMax != null) params.set('precioMax', String(filtros.precioMax))
  const qs = params.toString()
  // El backend pagina: { items, total, pagina }.
  const r = await apiFetch<RespuestaApi<{ items: Inmueble[]; total: number; pagina: number }>>(`/inmuebles${qs ? `?${qs}` : ''}`, { auth: false })
  return r.data.items
}

export async function obtenerInmueble(id: number): Promise<Inmueble> {
  const r = await apiFetch<RespuestaApi<Inmueble>>(`/inmuebles/${id}`, { auth: false })
  return r.data
}

// ── PUBLICADOR ───────────────────────────────────────────────
export async function crearInmueble(datos: Partial<Inmueble>): Promise<Inmueble> {
  const r = await apiFetch<RespuestaApi<Inmueble>>('/inmuebles', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarInmueble(id: number, datos: Partial<Inmueble>): Promise<Inmueble> {
  const r = await apiFetch<RespuestaApi<Inmueble>>(`/inmuebles/${id}`, { method: 'PUT', body: datos })
  return r.data
}

export async function cambiarEstadoInmueble(id: number, estado: EstadoInmueble): Promise<Inmueble> {
  const r = await apiFetch<RespuestaApi<Inmueble>>(`/inmuebles/${id}/estado`, { method: 'PATCH', body: { estado } })
  return r.data
}

export async function eliminarInmueble(id: number): Promise<void> {
  await apiFetch(`/inmuebles/${id}`, { method: 'DELETE' })
}

export async function misPublicacionesInmuebles(): Promise<Inmueble[]> {
  const r = await apiFetch<RespuestaApi<Inmueble[]>>('/inmuebles/mis-publicaciones')
  return r.data
}

/** Sube una o más fotos. El backend acepta un archivo por llamada (campo "foto"), así que se suben en secuencia. */
export async function subirFotoInmueble(id: number, files: File[]): Promise<Inmueble> {
  const token = obtenerToken()
  let ultimo: Inmueble | null = null
  for (const f of files) {
    const fd = new FormData()
    fd.append('foto', f)
    const res = await fetch(`${API_URL}/inmuebles/${id}/foto`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    })
    const j = await res.json()
    if (!res.ok || !j.ok) throw new Error(j?.error ?? j?.mensaje ?? 'No se pudo subir una de las fotos.')
    ultimo = j.data as Inmueble
  }
  if (!ultimo) throw new Error('No se seleccionó ninguna foto.')
  return ultimo
}

/** Sube el documento de soporte (folio/escritura, PDF o imagen — campo "documento"). Es privado, solo lo ve un admin. */
export async function subirDocumentoSoporteInmueble(id: number, file: File): Promise<Inmueble> {
  const fd = new FormData()
  fd.append('documento', file)
  const token = obtenerToken()
  const res = await fetch(`${API_URL}/inmuebles/${id}/documento-soporte`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  const j = await res.json()
  if (!res.ok || !j.ok) throw new Error(j?.error ?? j?.mensaje ?? 'No se pudo subir el documento de soporte.')
  return j.data as Inmueble
}

// ── DENUNCIAS ────────────────────────────────────────────────
export async function denunciarInmueble(id: number, datos: { motivo: MotivoDenunciaInmueble; descripcion?: string }): Promise<void> {
  await apiFetch(`/inmuebles/${id}/denunciar`, { method: 'POST', body: datos })
}

// ── ADMIN ────────────────────────────────────────────────────
export async function adminPendientesInmuebles(): Promise<Inmueble[]> {
  const r = await apiFetch<RespuestaApi<Inmueble[]>>('/admin/inmuebles/pendientes')
  return r.data
}

export async function adminModerarInmueble(id: number, datos: { accion: AccionModerarInmueble; motivo?: string }): Promise<Inmueble> {
  const r = await apiFetch<RespuestaApi<Inmueble>>(`/admin/inmuebles/${id}/moderar`, { method: 'PATCH', body: datos })
  return r.data
}

export async function adminDenunciasInmuebles(): Promise<DenunciaInmueble[]> {
  const r = await apiFetch<RespuestaApi<DenunciaInmueble[]>>('/admin/inmuebles/denuncias')
  return r.data
}

export async function adminResolverDenunciaInmueble(id: number, datos: { accion: AccionResolverDenunciaInmueble; notaRevision?: string }): Promise<DenunciaInmueble> {
  const r = await apiFetch<RespuestaApi<DenunciaInmueble>>(`/admin/inmuebles/denuncias/${id}/resolver`, { method: 'PATCH', body: datos })
  return r.data
}
