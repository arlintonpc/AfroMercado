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

/** Módulo de servicio desde el que se originó una publicación de la vitrina comercial. */
export type ModuloOrigenVitrina = 'PEDIDO' | 'EXPRESS' | 'HOTEL' | 'TOUR' | 'TRANSPORTE' | 'AGRO'

/** Datos mínimos del comercio dueño de una publicación de la Vitrina de video. */
export interface ComercioVitrina {
  id: number
  nombre: string
  logoUrl?: string | null
  whatsapp?: string | null
  whatsappVisible?: boolean
  comprableEnPlataforma?: boolean
  /** Solo presente para publicaciones consultadas con sesión iniciada. */
  siguiendo?: boolean
}

export interface PublicacionCultural {
  id: number
  /** Ausente en publicaciones de la Vitrina comercial (esas se identifican por `comercio`, no por autor). */
  autorId?: number
  titulo: string
  descripcion?: string | null
  fotoUrls: string[]
  videoUrl?: string | null
  /** Miniatura del video, solo presente en publicaciones con video subido (no en links externos). */
  videoPosterUrl?: string | null
  videoDuracionSegundos?: number | null
  departamento: string
  municipio?: string | null
  activa?: boolean
  createdAt: string
  autor?: { id: number; nombre: string }
  totalLikes: number
  totalComentarios?: number
  totalCompartidos?: number
  meGusta: boolean
  /** Solo presente para publicaciones consultadas con sesión iniciada. */
  esFavorito?: boolean
  moduloOrigen?: ModuloOrigenVitrina | null
  /** No nulo únicamente en publicaciones de la Vitrina de video (comerciantes). */
  comercio?: ComercioVitrina | null

  // ── Propiedades para Anuncios Inyectados (Publicidad) ──
  esAnuncio?: boolean
  campanaId?: number
  ctaTexto?: string
  urlDestino?: string
  etiqueta?: string
  imagenUrl?: string
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
  publicacion?: { titulo: string; autor?: { id: number; nombre: string }; comercio?: ComercioVitrina | null }
  denunciante?: { id: number; nombre: string }
}

export interface PublicacionCulturalInput {
  titulo: string
  descripcion?: string
  fotoUrls?: string[]
  videoUrl?: string
  videoPosterUrl?: string
  videoDuracionSegundos?: number
  videoPublicId?: string
  departamento: string
  municipio?: string
  /** Presente cuando la publica un comerciante desde la Vitrina de video. */
  comercioId?: number
  moduloOrigen?: ModuloOrigenVitrina
}

export function normalizarPublicacionCultural(publicacion: PublicacionCultural): PublicacionCultural {
  return {
    ...publicacion,
    descripcion: publicacion.descripcion ?? null,
    fotoUrls: Array.isArray(publicacion.fotoUrls) ? publicacion.fotoUrls : [],
    videoUrl: publicacion.videoUrl ?? null,
    videoPosterUrl: publicacion.videoPosterUrl ?? null,
    videoDuracionSegundos: publicacion.videoDuracionSegundos ?? null,
    activa: publicacion.activa ?? true,
    municipio: publicacion.municipio ?? null,
    autor: publicacion.autor ?? undefined,
    totalLikes: publicacion.totalLikes ?? 0,
    meGusta: publicacion.meGusta ?? false,
    esFavorito: publicacion.esFavorito ?? false,
    moduloOrigen: publicacion.moduloOrigen ?? null,
    comercio: publicacion.comercio ?? null,
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

// ── Vitrina de video (comerciantes) ──────────────────────────

/**
 * Feed público de publicaciones de comercio ("Vitrina de video"): reseñas
 * en video/foto de hoteles, tours, transportes, express, agro y pedidos.
 * Funciona con o sin sesión (con sesión trae `meGusta`/`esFavorito`).
 */
export async function obtenerVitrina(params: { departamento?: string; modulo?: string; search?: string; page?: number } = {}): Promise<{ items: PublicacionCultural[]; total: number; pagina: number }> {
  const qs = new URLSearchParams()
  if (params.departamento) qs.set('departamento', params.departamento)
  if (params.modulo) qs.set('modulo', params.modulo)
  if (params.search) qs.set('search', params.search)
  if (params.page) qs.set('page', String(params.page))
  const q = qs.toString()
  const r = await apiFetch<{ ok: boolean; items: PublicacionCultural[]; total: number; pagina: number }>(`/cultura/vitrina${q ? `?${q}` : ''}`)
  return {
    items: Array.isArray(r.items) ? r.items.map(normalizarPublicacionCultural) : [],
    total: r.total ?? 0,
    pagina: r.pagina ?? 1,
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

export interface VideoVitrinaSubido {
  url: string
  posterUrl: string | null
  duracionSegundos: number | null
  publicId: string | null
}

/**
 * Sube el video corto de una publicación de la Vitrina de video (máx. 45MB/45s).
 * Mismo endpoint que `subirVideoPublicacionCultural`, pero devuelve también la
 * miniatura y duración generadas por el backend, que la Vitrina sí necesita.
 */
export async function subirVideoVitrina(file: File): Promise<VideoVitrinaSubido> {
  const fd = new FormData()
  fd.append('video', file)
  const r = await apiFetch<{ ok: boolean; url: string; posterUrl?: string; duracionSegundos?: number; publicId?: string }>(
    '/cultura/publicaciones/video',
    { method: 'POST', body: fd },
  )
  return {
    url: r.url,
    posterUrl: r.posterUrl ?? null,
    duracionSegundos: r.duracionSegundos ?? null,
    publicId: r.publicId ?? null,
  }
}

export async function toggleLikePublicacion(id: number): Promise<{ meGusta: boolean; totalLikes: number }> {
  const r = await apiFetch<{ ok: boolean; data: { meGusta: boolean; totalLikes: number } }>(`/cultura/publicaciones/${id}/like/toggle`, { method: 'POST', body: {} })
  return r.data
}

export async function toggleFavoritoPublicacionCultural(id: number): Promise<{ esFavorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; esFavorito?: boolean; data?: { esFavorito: boolean } }>(`/cultura/publicaciones/${id}/favorito/toggle`, { method: 'POST', body: {} })
  return { esFavorito: r.data?.esFavorito ?? r.esFavorito ?? false }
}

/**
 * Registra una vista de una publicación en la Vitrina de video (fire-and-forget).
 */
export async function registrarVistaPublicacion(id: number, sesionId?: string, duracionSegundos?: number): Promise<void> {
  try {
    await apiFetch<{ ok: boolean }>(`/cultura/publicaciones/${id}/vista`, {
      method: 'POST',
      body: { sesionId, duracionSegundos },
    })
  } catch {
    // Ignorar errores silenciosamente para no interrumpir la reproducción
  }
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

export interface ComentarioPublicacionCultural {
  id: number
  publicacionCulturalId: number
  usuarioId: number
  texto: string
  createdAt: string
  usuario?: { id: number; nombre: string; avatarUrl?: string | null }
}

export async function registrarCompartidoPublicacion(id: number) {
  return apiFetch<{ ok: boolean }>(`/cultura/publicaciones/${id}/compartir`, { method: "POST", body: {} })
}

export async function listarComentariosPublicacion(id: number, params?: { page?: number; limit?: number }) {
  const q = new URLSearchParams()
  if (params?.page) q.set("page", String(params.page))
  if (params?.limit) q.set("limit", String(params.limit))
  const qs = q.toString()
  return apiFetch<{ ok: boolean; data: { items: ComentarioPublicacionCultural[]; total: number; pagina: number } }>(
    `/cultura/publicaciones/${id}/comentarios${qs ? `?${qs}` : ""}`
  ).then((r) => r.data)
}

export async function crearComentarioPublicacion(id: number, texto: string) {
  return apiFetch<{ ok: boolean; data: ComentarioPublicacionCultural }>(`/cultura/publicaciones/${id}/comentarios`, {
    method: "POST",
    body: { texto },
  }).then((r) => r.data)
}
