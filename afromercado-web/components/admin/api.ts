/**
 * Capa de acceso a los endpoints de administración de AfroMercado.
 *
 * Reutiliza `apiFetch` y `obtenerToken` de lib/api/client. Se ubica en
 * components/admin para no tocar lib/* (reglas de no-conflicto), pero
 * cumple la misma convención: lanza Error con el mensaje del backend.
 */

import { apiFetch, obtenerToken } from '@/lib/api/client'

// ——— Tipos del dominio admin ———

export interface AdminEstadisticas {
  totalPedidos: number
  pedidosPendientesPago: number
  pagosPorVerificar: number
  totalComercios: number
  totalProductos: number
  ventasConfirmadas: number
}

export interface PagoComprador {
  nombre: string
  email: string
  telefono?: string | null
}

export interface PagoPedido {
  id: string
  total: number
  direccionTexto?: string | null
  comprador: PagoComprador
}

export interface PagoPendiente {
  id: string
  monto: number
  metodo: string
  estado: string
  referencia?: string | null
  comprobanteUrl?: string | null
  createdAt: string
  pedido: PagoPedido
}

export type AccionVerificacion = 'APROBAR' | 'RECHAZAR'

interface RespuestaOk<T> {
  ok: boolean
  data: T
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

/**
 * GET /api/admin/estadisticas
 */
export async function obtenerEstadisticas(): Promise<AdminEstadisticas> {
  const res = await apiFetch<RespuestaOk<AdminEstadisticas>>(
    '/admin/estadisticas',
  )
  return res.data
}

/**
 * GET /api/admin/pagos/pendientes
 */
export async function obtenerPagosPendientes(): Promise<PagoPendiente[]> {
  const res = await apiFetch<RespuestaOk<PagoPendiente[]>>(
    '/admin/pagos/pendientes',
  )
  return res.data
}

/**
 * PATCH /api/admin/pagos/:id/verificar
 */
export async function verificarPago(
  id: string,
  accion: AccionVerificacion,
  notas?: string,
): Promise<void> {
  await apiFetch<unknown>(`/admin/pagos/${id}/verificar`, {
    method: 'PATCH',
    body: notas !== undefined && notas !== '' ? { accion, notas } : { accion },
  })
}

/**
 * GET /api/admin/pagos/:id/comprobante
 *
 * El endpoint devuelve la imagen binaria del comprobante y exige el header
 * Authorization, por lo que <img src> directo no funciona (no envía el
 * token). Hacemos un fetch autenticado, leemos el blob y devolvemos un
 * object URL listo para usar en <img src>. Quien lo consuma debe revocar
 * el URL con URL.revokeObjectURL cuando ya no lo necesite.
 */
export async function obtenerComprobanteObjectUrl(
  id: string,
): Promise<string> {
  const token = obtenerToken()
  const url = `${API_URL}/admin/pagos/${id}/comprobante`

  let response: Response
  try {
    response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor.')
  }

  if (!response.ok) {
    // El cuerpo de error puede venir como JSON { error } o texto plano.
    let mensaje = `Error ${response.status}`
    try {
      const texto = await response.text()
      if (texto) {
        try {
          const datos = JSON.parse(texto) as Record<string, unknown>
          if (typeof datos.error === 'string') mensaje = datos.error
          else if (typeof datos.message === 'string') mensaje = datos.message
        } catch {
          mensaje = texto
        }
      }
    } catch {
      // Ignoramos errores al leer el cuerpo; usamos el mensaje por defecto.
    }
    throw new Error(mensaje)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

// ——— Email ———

export interface SmtpConfig {
  host: string | null
  port: number
  user: string | null
  secure: boolean
  tienePassword: boolean
}

export interface EstadoEmail {
  configurado: boolean
  from: string
  adminEmail: string | null
  smtp: SmtpConfig
}

export interface InputSmtp {
  host: string
  port: number
  user: string
  pass: string
  secure: boolean
}

export async function obtenerEstadoEmail(): Promise<EstadoEmail> {
  const res = await apiFetch<{ ok: boolean; data: EstadoEmail }>('/admin/email/estado')
  return res.data
}

export async function guardarConfigSmtp(config: InputSmtp): Promise<void> {
  await apiFetch<unknown>('/admin/email/smtp', {
    method: 'PUT',
    body: config,
  })
}

export async function actualizarConfigEmail(adminEmail: string): Promise<void> {
  await apiFetch<unknown>('/admin/email/config', {
    method: 'PUT',
    body: { adminEmail },
  })
}

export async function enviarEmailTest(): Promise<string> {
  const res = await apiFetch<{ ok: boolean; mensaje: string }>('/admin/email/test', {
    method: 'POST',
  })
  return res.mensaje
}

// ——— WhatsApp ———

export interface EstadoWhatsApp {
  estado: 'DESCONECTADO' | 'ESCANEANDO_QR' | 'CONECTADO'
  qrDataUrl?: string
}

/**
 * GET /api/admin/whatsapp/estado
 */
export async function obtenerEstadoWhatsApp(): Promise<EstadoWhatsApp> {
  const token = obtenerToken()
  const res = await fetch(`${API_URL}/admin/whatsapp/estado`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new Error('No se pudo obtener el estado de WhatsApp')
  const j = await res.json()
  return j.data
}

/**
 * POST /api/admin/whatsapp/conectar
 */
export async function conectarWhatsApp(): Promise<void> {
  const token = obtenerToken()
  const res = await fetch(`${API_URL}/admin/whatsapp/conectar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new Error('No se pudo iniciar la conexión')
}

// ——— Comerciantes ———

export type EstadoComerciante = 'PENDIENTE_REVISION' | 'APROBADO' | 'RECHAZADO' | 'SUSPENDIDO'

export interface AdminComercio {
  id: number
  nombre: string
  municipio: string
  whatsapp?: string | null
  descripcion?: string | null
  verificado: boolean
  estadoRegistro: EstadoComerciante
  motivoRechazo?: string | null
  revisadoAt?: string | null
  whatsappVisible: boolean
  fotoDocumentoUrl?: string | null
  totalVentas: number
  calificacion: number | string
  createdAt: string
  usuario: {
    id: number
    nombre: string
    email: string
    telefono?: string | null
    tipoDocumento?: string | null
    numeroDocumento?: string | null
    createdAt: string
  }
  _count: { productos: number }
  comisiones: Array<{ tasa: number | string; motivo?: string | null; desde: string; hasta?: string | null }>
}

export async function listarComerciosAdmin(
  soloSinVerificar = false,
  estado?: EstadoComerciante,
): Promise<AdminComercio[]> {
  const params = new URLSearchParams()
  if (soloSinVerificar) params.set('soloSinVerificar', 'true')
  if (estado) params.set('estado', estado)
  const qs = params.toString() ? `?${params}` : ''
  const res = await apiFetch<RespuestaOk<AdminComercio[]>>(`/admin/comercios${qs}`)
  return res.data
}

export async function verificarComercianteAdmin(
  id: number,
  accion: 'APROBAR' | 'RECHAZAR' | 'SUSPENDER' | 'REHABILITAR',
  motivo?: string,
): Promise<AdminComercio> {
  const res = await apiFetch<RespuestaOk<AdminComercio>>(`/admin/comercios/${id}/verificar`, {
    method: 'PATCH',
    body: { accion, motivo },
  })
  return res.data
}

export async function toggleWhatsappAdmin(id: number): Promise<AdminComercio> {
  const res = await apiFetch<RespuestaOk<AdminComercio>>(`/admin/comercios/${id}/whatsapp-visible`, {
    method: 'PATCH',
  })
  return res.data
}

export async function setComisionComercioAdmin(
  id: number,
  tasa: number,
  motivo?: string,
  hasta?: string,
): Promise<{ id: number; tasa: number; motivo?: string | null }> {
  const res = await apiFetch<RespuestaOk<{ id: number; tasa: number; motivo?: string | null }>>(
    `/admin/comercios/${id}/comision`,
    { method: 'POST', body: { tasa, motivo, hasta } },
  )
  return res.data
}

export async function actualizarConfigAdmin(clave: string, valor: string): Promise<void> {
  await apiFetch(`/admin/config/${clave}`, { method: 'PUT', body: { valor } })
}

// ——— Pedidos (admin) ———

export type EstadoPedido =
  | 'PENDIENTE_PAGO'
  | 'VERIFICANDO_PAGO'
  | 'PAGO_FALLIDO'
  | 'CONFIRMADO'
  | 'CANCELADO'
  | 'EXPIRADO'
  | 'ENTREGADO'

export interface AdminPedidoResumen {
  id: number
  codigo: string | null
  estado: EstadoPedido
  total: number
  costoEnvio: number
  subtotal: number
  comisionTotal: number
  cuponDescuento: number | null
  direccionTexto: string
  createdAt: string
  expiresAt: string
  comprador: {
    id: number
    nombre: string
    email: string
    telefono?: string | null
  }
  subPedidos: Array<{
    id: number
    estado: string
    comercio: { id: number; nombre: string }
  }>
  pagos: Array<{
    id: number
    monto: number
    metodo: string
    estado: string
    createdAt: string
  }>
}

export interface AdminPedidoItem {
  id: number
  cantidad: number
  precioUnitario: number
  subtotal: number
  producto: { id: number; nombre: string; fotoUrl?: string | null }
}

export interface AdminSubPedido {
  id: number
  estado: string
  subtotal: number
  comision: number
  neto: number
  tasaComisionAplicada: number | null
  notas?: string | null
  comercio: { id: number; nombre: string; municipio: string }
  items: AdminPedidoItem[]
  entrega?: {
    id: number
    estado: string
    direccion: string
    notas?: string | null
  } | null
}

export interface AdminPedidoDetalle extends AdminPedidoResumen {
  notas?: string | null
  subPedidos: AdminSubPedido[]
  pagos: Array<{
    id: number
    monto: number
    metodo: string
    estado: string
    referencia?: string | null
    comprobanteUrl?: string | null
    notas?: string | null
    createdAt: string
    verificadoAt?: string | null
  }>
  cupon?: {
    id: number
    codigo: string
    tipo: string
    valor: number
  } | null
}

export interface ListaPedidosAdmin {
  items: AdminPedidoResumen[]
  total: number
  pagina: number
  paginas: number
}

export async function listarPedidosAdmin(params?: {
  estado?: EstadoPedido
  page?: number
  limit?: number
  comercioId?: number
  compradorId?: number
}): Promise<ListaPedidosAdmin> {
  const qs = new URLSearchParams()
  if (params?.estado)      qs.set('estado',      params.estado)
  if (params?.page)        qs.set('page',         String(params.page))
  if (params?.limit)       qs.set('limit',        String(params.limit))
  if (params?.comercioId)  qs.set('comercioId',   String(params.comercioId))
  if (params?.compradorId) qs.set('compradorId',  String(params.compradorId))
  const q = qs.toString() ? `?${qs}` : ''
  const res = await apiFetch<RespuestaOk<ListaPedidosAdmin>>(`/admin/pedidos${q}`)
  return res.data
}

export async function obtenerPedidoAdmin(id: number): Promise<AdminPedidoDetalle> {
  const res = await apiFetch<RespuestaOk<AdminPedidoDetalle>>(`/admin/pedidos/${id}`)
  return res.data
}
