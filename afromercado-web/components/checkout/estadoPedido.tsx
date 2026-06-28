/**
 * Mapeo de estados de pedido a copy amable en español y variante de badge.
 * Centraliza el tono cálido del flujo de compra (confirmación / pago).
 */
import { Badge } from '@/components/ui/Badge'
import type { EstadoPedidoPago } from './tiposPedido'

type VarianteBadge = 'verde' | 'gris' | 'dorado' | 'naranja'

interface InfoEstado {
  etiqueta: string
  variante: VarianteBadge
  titulo: string
  mensaje: string
}

const MAPA: Record<string, InfoEstado> = {
  PENDIENTE_PAGO: {
    etiqueta: 'Pendiente de pago',
    variante: 'dorado',
    titulo: 'Tu pedido está reservado',
    mensaje:
      'Realiza el pago para que los productores empiecen a preparar tu pedido.',
  },
  PENDIENTE: {
    etiqueta: 'Pendiente de pago',
    variante: 'dorado',
    titulo: 'Tu pedido está reservado',
    mensaje:
      'Realiza el pago para que los productores empiecen a preparar tu pedido.',
  },
  VERIFICANDO_PAGO: {
    etiqueta: 'Verificando pago',
    variante: 'naranja',
    titulo: 'Estamos verificando tu pago',
    mensaje:
      'Estamos esperando la confirmacion oficial de la pasarela para activar tu pedido.',
  },
  PAGADO: {
    etiqueta: 'Pago confirmado',
    variante: 'verde',
    titulo: '¡Pago confirmado!',
    mensaje: 'Los productores están preparando tu pedido con dedicación.',
  },
  CONFIRMADO: {
    etiqueta: 'Pago confirmado',
    variante: 'verde',
    titulo: '¡Pago confirmado!',
    mensaje: 'Los productores están preparando tu pedido con dedicación.',
  },
  EN_PREPARACION: {
    etiqueta: 'En preparación',
    variante: 'verde',
    titulo: 'Tu pedido se está preparando',
    mensaje:
      'Cada productor alista tu pedido artesanalmente. Pronto coordinarán el envío contigo.',
  },
  ENVIADO: {
    etiqueta: 'Enviado',
    variante: 'verde',
    titulo: 'Tu pedido va en camino',
    mensaje: 'El productor coordinará la entrega contigo. ¡Ya casi lo tienes!',
  },
  ENTREGADO: {
    etiqueta: 'Entregado',
    variante: 'verde',
    titulo: '¡Pedido entregado!',
    mensaje: 'Esperamos que disfrutes lo mejor del Chocó. Gracias por tu compra.',
  },
  CANCELADO: {
    etiqueta: 'Cancelado',
    variante: 'gris',
    titulo: 'Este pedido fue cancelado',
    mensaje: 'Si tienes dudas, escríbenos por WhatsApp y te ayudamos.',
  },
  EXPIRADO: {
    etiqueta: 'Expirado',
    variante: 'gris',
    titulo: 'El tiempo de pago expiró',
    mensaje:
      'No alcanzamos a recibir tu pago a tiempo. Puedes volver a armar tu pedido cuando quieras.',
  },
}

const POR_DEFECTO: InfoEstado = {
  etiqueta: 'En proceso',
  variante: 'gris',
  titulo: 'Tu pedido está en proceso',
  mensaje: 'Te mantendremos al tanto del estado de tu pedido.',
}

export function infoEstado(estado: EstadoPedidoPago | string | undefined): InfoEstado {
  if (!estado) return POR_DEFECTO
  return MAPA[estado] ?? { ...POR_DEFECTO, etiqueta: String(estado) }
}

export function BadgeEstado({ estado }: { estado: EstadoPedidoPago | string | undefined }) {
  const info = infoEstado(estado)
  return <Badge variant={info.variante}>{info.etiqueta}</Badge>
}
