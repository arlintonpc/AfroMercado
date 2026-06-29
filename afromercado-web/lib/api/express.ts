import { apiFetch } from './client'

export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO' | 'FESTIVO'
export type ModalidadExpress  = 'DOMICILIO' | 'RECOGER' | 'MESA'

export interface HorarioExpress {
  id?: number
  dia: DiaSemana
  abierto: boolean
  apertura: string
  cierre: string
}
export type EstadoPedidoExpress =
  | 'PENDIENTE' | 'ACEPTADO' | 'EN_PREPARACION' | 'LISTO'
  | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO' | 'RECHAZADO'
export type MetodoPagoExpress = 'EFECTIVO' | 'NEQUI' | 'WOMPI'

export interface ConfigExpress {
  id: number
  comercioId: number
  activo: boolean
  abierto: boolean
  tiempoPrepMinutos: number
  municipiosEntrega: string[]
  modalidades: ModalidadExpress[]
  costoEnvioBase: number
  limiteCreditoEfectivo: number
  deudaEfectivoActual: number
  horarios?: HorarioExpress[]
}

export interface ItemPedidoExpress {
  id: number
  productoId: number
  cantidad: number
  precioUnitario: number
  subtotal: number
  nota: string | null
  producto?: { nombre: string; fotoUrl: string | null }
}

export interface PedidoExpress {
  id: number
  codigo: string
  comercioId: number
  clienteId: number
  modalidad: ModalidadExpress
  estado: EstadoPedidoExpress
  metodoPago: MetodoPagoExpress
  subtotal: number
  costoEnvio: number
  comision: number
  total: number
  direccionTexto: string | null
  municipioEntrega: string | null
  notaCliente: string | null
  motivoCancelacion: string | null
  tiempoEstimadoMin: number
  tiempoAjustadoMin: number | null
  creadoAt: string
  aceptadoAt: string | null
  entregadoAt: string | null
  expiresAt: string
  items: ItemPedidoExpress[]
  cliente?: { nombre: string; email: string; telefono: string | null }
  configExpress?: { comercio: { nombre: string; logoUrl: string | null; municipio: string } }
}

export interface ComercioExpress {
  id: number
  activo: boolean
  abierto: boolean
  tiempoPrepMinutos: number
  modalidades: ModalidadExpress[]
  costoEnvioBase: number
  municipiosEntrega: string[]
  comercio: { id: number; nombre: string; logoUrl: string | null; municipio: string; calificacion: number; totalReviews: number; latitud?: number | null; longitud?: number | null }
}

// ── CLIENTE ──────────────────────────────────────────────────

export interface MenuComercioExpress extends ComercioExpress {
  abiertoAhora: boolean
  horarios?: HorarioExpress[]
  productos: Array<{
    id: number
    nombre: string
    descripcion: string | null
    precio: number
    unidad: string
    fotoUrl: string | null
    stock: number
    stockReservado: number
    tiempoEntregaMin: number | null
    categoria: { id: number; nombre: string } | null
  }>
}

export async function obtenerMenuComercioExpress(comercioId: number): Promise<MenuComercioExpress | null> {
  try {
    const r = await apiFetch<{ ok: boolean; data: MenuComercioExpress }>(`/express/comercios/${comercioId}/menu`)
    return r.data ?? null
  } catch { return null }
}

export async function listarComerciosExpress(municipio?: string): Promise<ComercioExpress[]> {
  const q = municipio ? `?municipio=${encodeURIComponent(municipio)}` : ''
  const r = await apiFetch<{ ok: boolean; data: ComercioExpress[] }>(`/express/comercios${q}`)
  return r.data ?? []
}

export async function crearPedidoExpress(body: {
  comercioId: number
  modalidad: ModalidadExpress
  metodoPago: MetodoPagoExpress
  items: { productoId: number; cantidad: number; nota?: string }[]
  notaCliente?: string
  direccionTexto?: string
  municipioEntrega?: string
}): Promise<PedidoExpress> {
  const r = await apiFetch<{ ok: boolean; data: PedidoExpress }>('/express/pedidos', { method: 'POST', body })
  return r.data
}

export async function misPedidosExpress(): Promise<PedidoExpress[]> {
  const r = await apiFetch<{ ok: boolean; data: PedidoExpress[] }>('/express/pedidos/mis')
  return r.data ?? []
}

export async function obtenerPedidoExpress(id: number): Promise<PedidoExpress> {
  const r = await apiFetch<{ ok: boolean; data: PedidoExpress }>(`/express/pedidos/${id}`)
  return r.data
}

// ── COMERCIO ─────────────────────────────────────────────────

export async function obtenerConfigExpress(): Promise<ConfigExpress> {
  const r = await apiFetch<{ ok: boolean; data: ConfigExpress }>('/express/config')
  return r.data
}

export async function actualizarConfigExpress(datos: Partial<ConfigExpress> & { horarios?: HorarioExpress[] }): Promise<ConfigExpress> {
  const r = await apiFetch<{ ok: boolean; data: ConfigExpress }>('/express/config', { method: 'PUT', body: datos })
  return r.data
}

export async function festivosColombia(anio?: number): Promise<{ anio: number; festivos: string[] }> {
  const q = anio ? `?anio=${anio}` : ''
  const r = await apiFetch<{ ok: boolean; data: { anio: number; festivos: string[] } }>(`/express/festivos${q}`)
  return r.data
}

export async function toggleAbiertoExpress(abierto: boolean): Promise<ConfigExpress> {
  const r = await apiFetch<{ ok: boolean; data: ConfigExpress }>('/express/config/abierto', { method: 'PATCH', body: { abierto } })
  return r.data
}

export async function pedidosComercioExpress(estado?: EstadoPedidoExpress): Promise<PedidoExpress[]> {
  const q = estado ? `?estado=${estado}` : ''
  const r = await apiFetch<{ ok: boolean; data: PedidoExpress[] }>(`/express/mis-pedidos${q}`)
  return r.data ?? []
}

export async function aceptarPedidoExpress(id: number, tiempoAjustadoMin?: number): Promise<PedidoExpress> {
  const r = await apiFetch<{ ok: boolean; data: PedidoExpress }>(`/express/mis-pedidos/${id}/aceptar`, { method: 'POST', body: { tiempoAjustadoMin } })
  return r.data
}

export async function rechazarPedidoExpress(id: number, motivo?: string): Promise<PedidoExpress> {
  const r = await apiFetch<{ ok: boolean; data: PedidoExpress }>(`/express/mis-pedidos/${id}/rechazar`, { method: 'POST', body: { motivo } })
  return r.data
}

export async function avanzarEstadoExpress(id: number): Promise<PedidoExpress> {
  const r = await apiFetch<{ ok: boolean; data: PedidoExpress }>(`/express/mis-pedidos/${id}/avanzar`, { method: 'POST', body: {} })
  return r.data
}

// ── ADMIN ────────────────────────────────────────────────────

export async function deudasExpressAdmin(): Promise<(ConfigExpress & { comercio: { id: number; nombre: string; municipio: string } })[]> {
  const r = await apiFetch<{ ok: boolean; data: any[] }>('/express/admin/deudas')
  return r.data ?? []
}

export async function saldarDeudaAdmin(comercioId: number, monto: number): Promise<ConfigExpress> {
  const r = await apiFetch<{ ok: boolean; data: ConfigExpress }>(`/express/admin/deudas/${comercioId}/saldar`, { method: 'POST', body: { monto } })
  return r.data
}
