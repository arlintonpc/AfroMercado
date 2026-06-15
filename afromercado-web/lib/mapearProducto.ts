import type { Producto } from '@/types/producto'

/**
 * Forma "cruda" tal como llega del backend.
 *
 * El backend devuelve algunos campos con tipos distintos a los que esperan
 * los componentes del frontend:
 *  - id / comercioId / categoriaId vienen como number
 *  - precio y comercio.calificacion vienen como string ("18000", "4.8")
 *  - el listado NO incluye historia / whatsapp / totalReviews del comercio
 *    (solo el detalle de producto los trae)
 *
 * Este módulo normaliza esa forma cruda al tipo `Producto` que consumen las
 * tarjetas, la home y la página de detalle, sin tocar el diseño visual.
 */
interface ComercioCrudo {
  id?: number | string
  nombre?: string
  municipio?: string
  descripcion?: string
  historia?: string
  whatsapp?: string | null
  calificacion?: number | string
  verificado?: boolean
  totalVentas?: number
  totalReviews?: number
}

export interface ProductoCrudo {
  id?: number | string
  comercioId?: number | string
  categoriaId?: number | string
  nombre?: string
  descripcion?: string
  historia?: string
  precio?: number | string
  unidad?: string
  stock?: number
  stockReservado?: number
  diasAlistamientoMin?: number
  diasAlistamientoMax?: number
  alcance?: Producto['alcance']
  fotoUrl?: string | null
  imagenes?: string[] | null
  activo?: boolean
  comercio?: ComercioCrudo | null
}

/** Convierte un valor numérico o string a number, con fallback. */
function aNumero(valor: unknown, fallback = 0): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : fallback
}

/** Convierte un id (number o string) a string, tolerando null/undefined. */
function aId(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor)
}

/**
 * Normaliza un producto crudo del backend al tipo `Producto`.
 *
 * El campo `whatsapp` del comercio no está en el tipo `Producto` (que es
 * compartido), así que la página de detalle lo lee directamente del objeto
 * crudo; aquí preservamos el resto de campos que sí espera el frontend.
 */
export function mapearProducto(crudo: ProductoCrudo): Producto {
  const comercio = crudo.comercio ?? {}

  return {
    id: aId(crudo.id),
    nombre: crudo.nombre ?? '',
    descripcion: crudo.descripcion,
    historia: crudo.historia,
    precio: aNumero(crudo.precio),
    unidad: crudo.unidad ?? '',
    stock: aNumero(crudo.stock),
    stockReservado: aNumero(crudo.stockReservado),
    diasAlistamientoMin: aNumero(crudo.diasAlistamientoMin),
    diasAlistamientoMax: aNumero(crudo.diasAlistamientoMax),
    alcance: crudo.alcance ?? 'LOCAL',
    fotoUrl: crudo.fotoUrl ?? undefined,
    imagenes: Array.isArray(crudo.imagenes) ? crudo.imagenes : undefined,
    activo: crudo.activo ?? true,
    comercio: {
      nombre: comercio.nombre ?? '',
      municipio: comercio.municipio ?? '',
      verificado: comercio.verificado ?? false,
      totalVentas: aNumero(comercio.totalVentas),
      calificacion: aNumero(comercio.calificacion),
      totalReviews: aNumero(comercio.totalReviews),
      historia: comercio.historia,
    },
    categoriaId: aId(crudo.categoriaId) || undefined,
    comercioId: aId(crudo.comercioId) || undefined,
  }
}

export function mapearProductos(crudos: ProductoCrudo[]): Producto[] {
  return crudos.map(mapearProducto)
}

/**
 * Extrae el número de WhatsApp normalizado del comercio (solo dígitos),
 * o null si no existe. La página de detalle lo usa para construir el enlace
 * wa.me/57XXXXXXXXXX.
 */
export function obtenerWhatsapp(crudo: ProductoCrudo | null | undefined): string | null {
  const wa = crudo?.comercio?.whatsapp
  if (!wa) return null
  const soloDigitos = String(wa).replace(/\D/g, '')
  return soloDigitos.length > 0 ? soloDigitos : null
}
