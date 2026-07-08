import { apiFetch } from './client'

export type EstadoEventoCultural = 'BORRADOR' | 'PUBLICADO' | 'FINALIZADO' | 'CANCELADO' | 'POSPUESTO'
export type EstadoReservaCultural = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'RECHAZADA' | 'USADA'

export interface EntradaCultural {
  id: number
  eventoCulturalId: number
  nombre: string
  descripcion?: string | null
  precio: number | string
  cupo?: number | null
  vendidas: number
  activa: boolean
  orden: number
  creadoAt: string
  updatedAt: string
}

export interface EventoCultural {
  id: number
  comercioId?: number | null
  titulo: string
  descripcion?: string | null
  categoria?: string | null
  departamento: string
  municipio: string
  lugar?: string | null
  latitud?: number | null
  longitud?: number | null
  fechaInicio: string
  fechaFin?: string | null
  portadaUrl?: string | null
  fotos: string[]
  videoUrl?: string | null
  patrimonio: boolean
  patrimonioNota?: string | null
  gratuito: boolean
  destacado: boolean
  estado: EstadoEventoCultural
  creadoAt: string
  updatedAt: string
  entradas?: EntradaCultural[]
  comercio?: { id: number; nombre: string; municipio: string; whatsapp?: string | null } | null
}

function normalizarEntrada(entrada: EntradaCultural): EntradaCultural {
  return {
    ...entrada,
    descripcion: entrada.descripcion ?? null,
    precio: Number(entrada.precio),
    cupo: entrada.cupo ?? null,
  }
}

export function normalizarEventoCultural(evento: EventoCultural): EventoCultural {
  return {
    ...evento,
    descripcion: evento.descripcion ?? null,
    categoria: evento.categoria ?? null,
    lugar: evento.lugar ?? null,
    latitud: evento.latitud ?? null,
    longitud: evento.longitud ?? null,
    portadaUrl: evento.portadaUrl ?? null,
    fotos: Array.isArray(evento.fotos) ? evento.fotos : [],
    videoUrl: evento.videoUrl ?? null,
    patrimonioNota: evento.patrimonioNota ?? null,
    entradas: Array.isArray(evento.entradas) ? evento.entradas.map(normalizarEntrada) : [],
    comercio: evento.comercio ?? null,
  }
}

export interface ReservaCultural {
  id: number
  codigo: string
  eventoCulturalId: number
  entradaCulturalId: number
  clienteId: number
  cantidad: number
  total: number | string
  estado: EstadoReservaCultural
  metodoPago: string
  nombreContacto: string
  telefonoContacto: string
  creadoAt: string
  updatedAt: string
  evento?: EventoCultural
  entrada?: EntradaCultural
  review?: { id: number } | null
}

export async function listarAgenda(params: {
  departamento?: string
  municipio?: string
  categoria?: string
  search?: string
  patrimonio?: boolean
  fechaDesde?: string
  fechaHasta?: string
} = {}): Promise<EventoCultural[]> {
  const qs = new URLSearchParams()
  if (params.departamento) qs.set('departamento', params.departamento)
  if (params.municipio) qs.set('municipio', params.municipio)
  if (params.categoria) qs.set('categoria', params.categoria)
  if (params.search) qs.set('search', params.search)
  if (params.patrimonio) qs.set('patrimonio', 'true')
  if (params.fechaDesde) qs.set('fechaDesde', params.fechaDesde)
  if (params.fechaHasta) qs.set('fechaHasta', params.fechaHasta)
  const q = qs.toString()
  const r = await apiFetch<{ ok: boolean; data: EventoCultural[] }>(`/cultura${q ? `?${q}` : ''}`)
  return Array.isArray(r.data) ? r.data.map(normalizarEventoCultural) : []
}

export async function obtenerEvento(id: number): Promise<EventoCultural> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural }>(`/cultura/${id}`)
  return normalizarEventoCultural(r.data)
}

export async function crearReservaCultural(datos: {
  entradaCulturalId: number
  cantidad: number
  metodoPago?: string
  notasCliente?: string
  nombreContacto: string
  telefonoContacto: string
}): Promise<ReservaCultural> {
  const r = await apiFetch<{ ok: boolean; data: ReservaCultural }>('/cultura/reservas', { method: 'POST', body: datos })
  return r.data
}

export async function misReservasCultura(): Promise<ReservaCultural[]> {
  const r = await apiFetch<{ ok: boolean; data: ReservaCultural[] }>('/cultura/reservas/mis')
  return r.data
}

export async function cancelarReservaCultura(id: number): Promise<ReservaCultural> {
  const r = await apiFetch<{ ok: boolean; data: ReservaCultural }>(`/cultura/reservas/${id}/cancelar`, { method: 'PATCH' })
  return r.data
}

/** Precio más bajo entre las entradas activas (para el "desde $"). null si no hay entradas. */
export function precioDesde(evento: EventoCultural): number | null {
  const activas = (evento.entradas ?? []).filter((e) => e.activa)
  if (activas.length === 0) return null
  return Math.min(...activas.map((e) => Number(e.precio)))
}

// ── Organizador (comercio) ───────────────────────────────────

export interface EventoInput {
  titulo: string
  departamento: string
  municipio: string
  fechaInicio: string
  descripcion?: string
  categoria?: string
  lugar?: string
  fechaFin?: string
  portadaUrl?: string
  gratuito?: boolean
  patrimonio?: boolean
  patrimonioNota?: string
  estado?: EstadoEventoCultural
  fotos?: string[]
  videoUrl?: string
  latitud?: number
  longitud?: number
}

export interface EntradaInput {
  nombre: string
  precio: number
  descripcion?: string
  cupo?: number | null
  activa?: boolean
  orden?: number
}

export async function misEventosCultura(): Promise<EventoCultural[]> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural[] }>('/cultura/mis-eventos')
  return Array.isArray(r.data) ? r.data.map(normalizarEventoCultural) : []
}

export async function crearEventoCultura(datos: EventoInput): Promise<EventoCultural> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural }>('/cultura/mis-eventos', { method: 'POST', body: datos })
  return normalizarEventoCultural(r.data)
}

export async function actualizarEventoCultura(id: number, datos: Partial<EventoInput>): Promise<EventoCultural> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural }>(`/cultura/mis-eventos/${id}`, { method: 'PATCH', body: datos })
  return normalizarEventoCultural(r.data)
}

export async function crearEntradaCultura(eventoId: number, datos: EntradaInput): Promise<EntradaCultural> {
  const r = await apiFetch<{ ok: boolean; data: EntradaCultural }>(`/cultura/mis-eventos/${eventoId}/entradas`, { method: 'POST', body: datos })
  return normalizarEntrada(r.data)
}

export async function actualizarEntradaCultura(entradaId: number, datos: Partial<EntradaInput>): Promise<EntradaCultural> {
  const r = await apiFetch<{ ok: boolean; data: EntradaCultural }>(`/cultura/entradas/${entradaId}`, { method: 'PATCH', body: datos })
  return normalizarEntrada(r.data)
}

export async function eliminarEntradaCultura(entradaId: number): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/cultura/entradas/${entradaId}`, { method: 'DELETE' })
}

// ── Comparte tu Chocó (publicaciones culturales) ─────────────

export type MotivoDenunciaPublicacion = 'CONTENIDO_INAPROPIADO' | 'SPAM' | 'DERECHOS_DE_AUTOR' | 'NO_RELACIONADO' | 'OTRO'
export type EstadoDenunciaPublicacion = 'PENDIENTE' | 'DESESTIMADA' | 'PUBLICACION_OCULTADA'
export type AccionResolverDenunciaPublicacion = 'DESESTIMAR' | 'OCULTAR'

export interface PublicacionCultural {
  id: number
  autorId: number
  titulo: string
  descripcion?: string | null
  fotoUrls: string[]
  videoUrl?: string | null
  departamento: string
  municipio?: string | null
  activa: boolean
  createdAt: string
  autor?: { id: number; nombre: string }
  totalLikes: number
  meGusta: boolean
}

export interface DenunciaPublicacionCultural {
  id: number
  publicacionCulturalId: number
  denuncianteId: number
  motivo: MotivoDenunciaPublicacion
  descripcion?: string | null
  estado: EstadoDenunciaPublicacion
  revisadoPor?: number | null
  revisadoAt?: string | null
  notaRevision?: string | null
  createdAt: string
  publicacion?: { titulo: string; autor?: { id: number; nombre: string } }
  denunciante?: { id: number; nombre: string }
}

export interface PublicacionCulturalInput {
  titulo: string
  descripcion?: string
  fotoUrls?: string[]
  videoUrl?: string
  departamento: string
  municipio?: string
}

export function normalizarPublicacionCultural(publicacion: PublicacionCultural): PublicacionCultural {
  return {
    ...publicacion,
    descripcion: publicacion.descripcion ?? null,
    fotoUrls: Array.isArray(publicacion.fotoUrls) ? publicacion.fotoUrls : [],
    videoUrl: publicacion.videoUrl ?? null,
    activa: Boolean(publicacion.activa),
    municipio: publicacion.municipio ?? null,
    autor: publicacion.autor ?? undefined,
    totalLikes: publicacion.totalLikes ?? 0,
    meGusta: publicacion.meGusta ?? false,
  }
}

export async function crearPublicacionCultural(datos: PublicacionCulturalInput): Promise<PublicacionCultural> {
  const r = await apiFetch<{ ok: boolean; data: PublicacionCultural }>('/cultura/publicaciones', { method: 'POST', body: datos })
  return normalizarPublicacionCultural(r.data)
}

export async function listarPublicacionesCulturales(params: { departamento?: string; page?: number } = {}): Promise<{ items: PublicacionCultural[]; total: number; pagina: number }> {
  const qs = new URLSearchParams()
  if (params.departamento) qs.set('departamento', params.departamento)
  if (params.page) qs.set('page', String(params.page))
  const q = qs.toString()
  const r = await apiFetch<{ ok: boolean; data: { items: PublicacionCultural[]; total: number; pagina: number } }>(`/cultura/publicaciones${q ? `?${q}` : ''}`)
  return {
    ...r.data,
    items: Array.isArray(r.data.items) ? r.data.items.map(normalizarPublicacionCultural) : [],
  }
}

export async function subirFotoPublicacionCultural(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('foto', file)
  const r = await apiFetch<{ ok: boolean; url: string }>('/cultura/publicaciones/foto', { method: 'POST', body: fd })
  return r.url
}

export async function subirVideoPublicacionCultural(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('video', file)
  const r = await apiFetch<{ ok: boolean; url: string }>('/cultura/publicaciones/video', { method: 'POST', body: fd })
  return r.url
}

export async function toggleLikePublicacion(id: number): Promise<{ meGusta: boolean; totalLikes: number }> {
  const r = await apiFetch<{ ok: boolean; data: { meGusta: boolean; totalLikes: number } }>(`/cultura/publicaciones/${id}/like/toggle`, { method: 'POST', body: {} })
  return r.data
}

export async function denunciarPublicacionCultural(id: number, datos: { motivo: MotivoDenunciaPublicacion; descripcion?: string }): Promise<DenunciaPublicacionCultural> {
  const r = await apiFetch<{ ok: boolean; data: DenunciaPublicacionCultural }>(`/cultura/publicaciones/${id}/denunciar`, { method: 'POST', body: datos })
  return r.data
}

export async function listarDenunciasPublicacionPendientes(): Promise<DenunciaPublicacionCultural[]> {
  const r = await apiFetch<{ ok: boolean; data: DenunciaPublicacionCultural[] }>('/cultura/admin/publicaciones/denuncias')
  return r.data
}

export async function resolverDenunciaPublicacion(id: number, datos: { accion: AccionResolverDenunciaPublicacion; motivo?: string }): Promise<DenunciaPublicacionCultural> {
  const r = await apiFetch<{ ok: boolean; data: DenunciaPublicacionCultural }>(`/cultura/admin/publicaciones/denuncias/${id}/resolver`, { method: 'PATCH', body: datos })
  return r.data
}

// ── Media de eventos (organizador) ───────────────────────────

export async function subirFotoEvento(archivo: File): Promise<string> {
  const fd = new FormData()
  fd.append('foto', archivo)
  const r = await apiFetch<{ ok: boolean; url: string }>('/cultura/mis-eventos/foto', { method: 'POST', body: fd })
  return r.url
}

export async function subirVideoEvento(archivo: File): Promise<string> {
  const fd = new FormData()
  fd.append('video', archivo)
  const r = await apiFetch<{ ok: boolean; url: string }>('/cultura/mis-eventos/video', { method: 'POST', body: fd })
  return r.url
}

// ── FAVORITOS CULTURA ─────────────────────────────────────────

export async function toggleFavoritoCultura(id: number): Promise<{ esFavorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; data: { esFavorito: boolean } }>(`/cultura/favoritos/${id}/toggle`, { method: 'POST', body: {} })
  return r.data
}

export async function misFavoritosCultura(): Promise<EventoCultural[]> {
  const r = await apiFetch<{ ok: boolean; data: EventoCultural[] }>('/cultura/favoritos/mis')
  return Array.isArray(r.data) ? r.data.map(normalizarEventoCultural) : []
}

export async function esFavoritoCultura(id: number): Promise<boolean> {
  try {
    const r = await apiFetch<{ ok: boolean; data: { esFavorito: boolean } }>(`/cultura/favoritos/${id}`)
    return r.data?.esFavorito ?? false
  } catch { return false }
}
