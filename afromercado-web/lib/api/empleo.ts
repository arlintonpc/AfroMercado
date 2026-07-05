import { apiFetch, API_URL, obtenerToken } from './client'

export type TipoContratoEmpleo = 'TIEMPO_COMPLETO' | 'MEDIO_TIEMPO' | 'POR_DIAS' | 'TEMPORAL' | 'OTRO'
export type EstadoOfertaEmpleo = 'BORRADOR' | 'PUBLICADA' | 'PAUSADA' | 'CERRADA'
export type EstadoPostulacionEmpleo = 'ENVIADA' | 'VISTA' | 'PRESELECCIONADO' | 'RECHAZADA' | 'CONTRATADO' | 'RETIRADA'
export type TipoPreguntaEmpleo = 'TEXTO' | 'SI_NO' | 'OPCION_MULTIPLE'

export const CATEGORIAS_EMPLEO: string[] = [
  'Pesca y acuicultura',
  'Agricultura y agroindustria',
  'Turismo y hotelería',
  'Comercio y ventas',
  'Construcción',
  'Transporte',
  'Oficios domésticos',
  'Tecnología y sistemas',
  'Salud',
  'Educación',
  'Administración y oficina',
  'Otro',
]

export interface PreguntaOferta {
  id: string
  texto: string
  tipo: TipoPreguntaEmpleo
  opciones?: string[]
}

export interface RespuestaPregunta {
  preguntaId: string
  texto: string
  respuesta: string
}

export interface OfertaEmpleo {
  id: number
  publicadoPorId: number
  comercioId: number | null
  titulo: string
  descripcion: string
  categoria: string | null
  tipoContrato: TipoContratoEmpleo
  municipio: string
  departamento: string | null
  salarioMin: string | number | null
  salarioMax: string | number | null
  salarioNegociable: boolean
  requisitos: string | null
  vacantes: number
  estado: EstadoOfertaEmpleo
  estadoModeracion: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  motivoRechazoModeracion: string | null
  contactoWhatsapp: string | null
  fechaCierre: string | null
  preguntas: PreguntaOferta[]
  createdAt: string
  publicadoPor?: { id: number; nombre: string }
  comercio?: { id: number; nombre: string; verificado: boolean; logoUrl: string | null } | null
  _count?: { postulaciones: number }
}

export interface ExperienciaItem {
  empresa: string
  cargo: string
  desde: string
  hasta?: string
  descripcion?: string
}

export interface EducacionItem {
  institucion: string
  titulo: string
  nivel?: string
  anio?: string
}

export interface HojaDeVida {
  id: number
  usuarioId: number
  resumenPerfil: string | null
  telefonoContacto: string
  experiencia: ExperienciaItem[]
  educacion: EducacionItem[]
  habilidades: string[]
  disponibilidad: string | null
  cvUrl: string | null
}

export interface PostulacionEmpleo {
  id: number
  ofertaEmpleoId: number
  postulanteId: number
  experienciaSnap: ExperienciaItem[]
  educacionSnap: EducacionItem[]
  habilidadesSnap: string[]
  resumenPerfilSnap: string | null
  disponibilidadSnap: string | null
  fotoSnapUrl: string | null
  cvSnapUrl: string | null
  respuestas: RespuestaPregunta[]
  mensaje: string | null
  estado: EstadoPostulacionEmpleo
  notasPublicador: string | null
  createdAt: string
  postulante?: { id: number; nombre: string; email: string; telefono: string | null }
  oferta?: { id: number; titulo: string; municipio: string; estado: EstadoOfertaEmpleo }
}

interface RespuestaApi<T> {
  ok: boolean
  data: T
}

export async function listarOfertasEmpleo(filtros: { municipio?: string; departamento?: string; categoria?: string; tipoContrato?: TipoContratoEmpleo; page?: number } = {}): Promise<{ items: OfertaEmpleo[]; total: number; pagina: number }> {
  const params = new URLSearchParams()
  if (filtros.municipio) params.set('municipio', filtros.municipio)
  if (filtros.departamento) params.set('departamento', filtros.departamento)
  if (filtros.categoria) params.set('categoria', filtros.categoria)
  if (filtros.tipoContrato) params.set('tipoContrato', filtros.tipoContrato)
  if (filtros.page) params.set('page', String(filtros.page))
  const r = await apiFetch<RespuestaApi<{ items: OfertaEmpleo[]; total: number; pagina: number }>>(`/empleo/ofertas?${params.toString()}`)
  return r.data
}

export async function obtenerOfertaEmpleo(id: number): Promise<OfertaEmpleo> {
  const r = await apiFetch<RespuestaApi<OfertaEmpleo>>(`/empleo/ofertas/${id}`)
  return r.data
}

export async function crearOfertaEmpleo(datos: Partial<OfertaEmpleo>): Promise<OfertaEmpleo> {
  const r = await apiFetch<RespuestaApi<OfertaEmpleo>>('/empleo/ofertas', { method: 'POST', body: datos })
  return r.data
}

export async function cambiarEstadoOfertaEmpleo(id: number, estado: EstadoOfertaEmpleo): Promise<OfertaEmpleo> {
  const r = await apiFetch<RespuestaApi<OfertaEmpleo>>(`/empleo/ofertas/${id}/estado`, { method: 'PATCH', body: { estado } })
  return r.data
}

export async function misOfertasEmpleo(): Promise<OfertaEmpleo[]> {
  const r = await apiFetch<RespuestaApi<OfertaEmpleo[]>>('/empleo/mis-ofertas')
  return r.data
}

export async function obtenerMiHojaDeVida(): Promise<HojaDeVida | null> {
  const r = await apiFetch<RespuestaApi<HojaDeVida | null>>('/empleo/hoja-de-vida')
  return r.data
}

export async function guardarHojaDeVida(datos: Partial<HojaDeVida>): Promise<HojaDeVida> {
  const r = await apiFetch<RespuestaApi<HojaDeVida>>('/empleo/hoja-de-vida', { method: 'PUT', body: datos })
  return r.data
}

/** Sube el CV en PDF (campo "cv") y lo guarda en la hoja de vida ya existente. */
export async function subirCvHojaDeVida(archivo: File): Promise<HojaDeVida> {
  const form = new FormData()
  form.append('cv', archivo)

  const res = await fetch(`${API_URL}/empleo/hoja-de-vida/cv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${obtenerToken() ?? ''}` },
    body: form,
  })

  const json = await res.json()
  if (!res.ok || !json.ok) {
    throw new Error(json.mensaje ?? json.error ?? 'No se pudo subir el CV.')
  }
  return json.data as HojaDeVida
}

export async function postularseOferta(ofertaId: number, mensaje?: string, respuestas?: { preguntaId: string; respuesta: string }[]): Promise<PostulacionEmpleo> {
  const r = await apiFetch<RespuestaApi<PostulacionEmpleo>>(`/empleo/ofertas/${ofertaId}/postular`, { method: 'POST', body: { mensaje, respuestas } })
  return r.data
}

export async function misPostulacionesEmpleo(): Promise<PostulacionEmpleo[]> {
  const r = await apiFetch<RespuestaApi<PostulacionEmpleo[]>>('/empleo/mis-postulaciones')
  return r.data
}

export async function postulacionesDeOferta(ofertaId: number): Promise<PostulacionEmpleo[]> {
  const r = await apiFetch<RespuestaApi<PostulacionEmpleo[]>>(`/empleo/ofertas/${ofertaId}/postulaciones`)
  return r.data
}

export async function cambiarEstadoPostulacion(id: number, estado: EstadoPostulacionEmpleo, notasPublicador?: string): Promise<PostulacionEmpleo> {
  const r = await apiFetch<RespuestaApi<PostulacionEmpleo>>(`/empleo/postulaciones/${id}/estado`, { method: 'PATCH', body: { estado, notasPublicador } })
  return r.data
}

export async function retirarPostulacionEmpleo(id: number): Promise<PostulacionEmpleo> {
  const r = await apiFetch<RespuestaApi<PostulacionEmpleo>>(`/empleo/postulaciones/${id}/retirar`, { method: 'PATCH' })
  return r.data
}

export async function ofertasEmpleoPendientesModeracion(): Promise<OfertaEmpleo[]> {
  const r = await apiFetch<RespuestaApi<OfertaEmpleo[]>>('/admin/empleo/pendientes')
  return r.data
}

export async function moderarOfertaEmpleo(id: number, accion: 'APROBAR' | 'RECHAZAR', motivo?: string): Promise<OfertaEmpleo> {
  const r = await apiFetch<RespuestaApi<OfertaEmpleo>>(`/admin/empleo/${id}/moderar`, { method: 'PATCH', body: { accion, motivo } })
  return r.data
}

export async function otrasOfertasDelPublicador(ofertaId: number): Promise<OfertaEmpleo[]> {
  const r = await apiFetch<RespuestaApi<OfertaEmpleo[]>>(`/empleo/ofertas/${ofertaId}/otras-del-publicador`)
  return r.data
}

export async function toggleFavoritoEmpleo(ofertaId: number): Promise<{ favorito: boolean }> {
  const r = await apiFetch<RespuestaApi<{ favorito: boolean }>>(`/empleo/favoritos/${ofertaId}/toggle`, { method: 'POST' })
  return r.data
}

export async function misFavoritosEmpleo(): Promise<OfertaEmpleo[]> {
  const r = await apiFetch<RespuestaApi<OfertaEmpleo[]>>('/empleo/favoritos/mis')
  return r.data
}

export async function esFavoritoEmpleo(ofertaId: number): Promise<{ favorito: boolean }> {
  const r = await apiFetch<RespuestaApi<{ favorito: boolean }>>(`/empleo/favoritos/${ofertaId}`)
  return r.data
}
