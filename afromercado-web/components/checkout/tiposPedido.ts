/**
 * Tipos locales del flujo de compra (checkout, pago, confirmación).
 *
 * El backend devuelve para el pedido una forma más rica que la del tipo
 * compartido `types/pedido.ts` (subPedidos por comercio, comisión, expiresAt,
 * estados de pago digital, etc.). Como no debemos tocar `types/*`,
 * definimos aquí las formas reales verificadas contra la API en vivo y las
 * consumimos solo dentro del flujo de compra.
 */

/** Estados reales del pedido en el flujo de pago digital. */
export type EstadoPedidoPago =
  | 'PENDIENTE_PAGO'
  | 'VERIFICANDO_PAGO'
  | 'CONFIRMADO'
  | 'EN_PREPARACION'
  | 'ENVIADO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'EXPIRADO'
  // Estados del tipo compartido por compatibilidad.
  | 'PENDIENTE'
  | 'PAGADO'
  | string

export interface ItemSubPedido {
  id?: string | number
  productoId?: string | number
  nombre?: string
  cantidad?: number
  precioUnitario?: number
  subtotal?: number
  producto?: {
    id?: string | number
    nombre?: string
    fotoUrl?: string | null
    unidad?: string
  } | null
}

export interface ComercioSubPedido {
  id?: string | number
  nombre?: string
  municipio?: string
}

export interface EntregaSubPedido {
  id: number
  estado: string
  ultimaLatitud?: number | null
  ultimaLongitud?: number | null
  ultimaUbicacionAt?: string | null
  calificacion?: { calificacion: number } | null
}

export interface SubPedido {
  id?: string | number
  comercio?: ComercioSubPedido | string | null
  items?: ItemSubPedido[]
  subtotal?: number
  estado?: string
  entrega?: EntregaSubPedido | null
}

export interface PedidoDetalle {
  id: string | number
  codigo?: string | null
  estado: EstadoPedidoPago
  total?: number
  subtotal?: number
  comisionTotal?: number
  expiresAt?: string | null
  creadoEn?: string
  direccionTexto?: string
  direccion?: string
  notas?: string
  subPedidos?: SubPedido[]
  items?: ItemSubPedido[]
}

export interface InstruccionesPago {
  mensaje?: string
  expiresAt?: string | null
  total?: number
}

export interface RespuestaCheckout {
  pedido: PedidoDetalle
  instruccionesPago?: InstruccionesPago
}

export interface DatosPagoTransferencia {
  nequi?: string | null
  daviplata?: string | null
  monto?: number
  referencia?: string
}

export type MetodoPago = 'NEQUI' | 'DAVIPLATA' | 'TRANSFERENCIA' | 'EFECTIVO' | 'PASARELA'

export interface PagoCreado {
  id: string | number
  estado?: string
  metodo?: MetodoPago
  referencia?: string
}

/** Envoltorio estándar del backend: { ok, data }. */
export interface RespuestaApi<T> {
  ok?: boolean
  data?: T
}

/**
 * Desenvuelve una respuesta { ok, data } o devuelve el objeto directo si el
 * backend ya lo entrega sin envoltorio.
 */
export function desenvolver<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as RespuestaApi<T>).data as T
  }
  return raw as T
}

/** Normaliza el nombre del comercio de un subPedido (puede venir como string u objeto). */
export function nombreComercio(sub: SubPedido): string {
  if (!sub.comercio) return 'Productor'
  if (typeof sub.comercio === 'string') return sub.comercio
  return sub.comercio.nombre ?? 'Productor'
}
