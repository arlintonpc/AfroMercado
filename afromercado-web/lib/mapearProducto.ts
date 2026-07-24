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
interface CategoriaCruda {
  id?: number | string
  nombre?: string
  slug?: string
  grupo?: 'ANCESTRAL' | 'LOCAL'
}

interface ComercioCrudo {
  id?: number | string
  nombre?: string
  municipio?: string
  departamento?: string
  descripcion?: string
  historia?: string
  whatsapp?: string | null
  whatsappVisible?: boolean
  comprableEnPlataforma?: boolean
  videoUrl?: string | null
  videoPosterUrl?: string | null
  videoDuracionSegundos?: number | string | null
  videoDuracionOriginalSegundos?: number | string | null
  videoRecorteInicioSegundos?: number | string | null
  videoRecorteFinSegundos?: number | string | null
  videoMimeType?: string | null
  calificacion?: number | string
  verificado?: boolean
  totalVentas?: number
  totalReviews?: number
}

interface OfertaCruda {
  id?:          number | string
  tipo:        string
  valor:       number | string
  etiqueta?:   string | null
  fin?:        string
  stockLimite?: number | null
  stockUsado?: number
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
  pesoKg?: number | string | null
  diasAlistamientoMin?: number
  diasAlistamientoMax?: number
  alcance?: Producto['alcance']
  fotoUrl?: string | null
  imagenes?: string[] | null
  videoUrl?: string | null
  videoPosterUrl?: string | null
  videoDuracionSegundos?: number | string | null
  videoDuracionOriginalSegundos?: number | string | null
  videoRecorteInicioSegundos?: number | string | null
  videoRecorteFinSegundos?: number | string | null
  videoMimeType?: string | null
  activo?: boolean
  esExpress?: boolean
  tiempoEntregaMin?: number | null
  comercio?: ComercioCrudo | null
  categoria?: CategoriaCruda | null
  ofertas?: OfertaCruda[] | null
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
export function mapearProducto(crudo: any): Producto {
  if (crudo.esBannerDisplay) {
    return crudo as any
  }
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
    pesoKg: crudo.pesoKg != null ? aNumero(crudo.pesoKg) : null,
    diasAlistamientoMin: aNumero(crudo.diasAlistamientoMin),
    diasAlistamientoMax: aNumero(crudo.diasAlistamientoMax),
    alcance: crudo.alcance ?? 'LOCAL',
    fotoUrl: crudo.fotoUrl ?? undefined,
    imagenes: Array.isArray(crudo.imagenes) ? crudo.imagenes : undefined,
    videoUrl: crudo.videoUrl ?? undefined,
    videoPosterUrl: crudo.videoPosterUrl ?? undefined,
    videoDuracionSegundos: crudo.videoDuracionSegundos != null ? aNumero(crudo.videoDuracionSegundos) : null,
    videoDuracionOriginalSegundos: crudo.videoDuracionOriginalSegundos != null ? aNumero(crudo.videoDuracionOriginalSegundos) : null,
    videoRecorteInicioSegundos: crudo.videoRecorteInicioSegundos != null ? aNumero(crudo.videoRecorteInicioSegundos) : null,
    videoRecorteFinSegundos: crudo.videoRecorteFinSegundos != null ? aNumero(crudo.videoRecorteFinSegundos) : null,
    videoMimeType: crudo.videoMimeType ?? undefined,
    activo: crudo.activo ?? true,
    comercio: {
      nombre: comercio.nombre ?? '',
      municipio: comercio.municipio ?? '',
      departamento: comercio.departamento,
      verificado: comercio.verificado ?? false,
      totalVentas: aNumero(comercio.totalVentas),
      calificacion: aNumero(comercio.calificacion),
      totalReviews: aNumero(comercio.totalReviews),
      historia: comercio.historia,
      whatsappVisible: crudo.comercio?.whatsappVisible ?? false,
      comprableEnPlataforma: crudo.comercio?.comprableEnPlataforma ?? true,
      videoUrl: comercio.videoUrl ?? undefined,
      videoPosterUrl: comercio.videoPosterUrl ?? undefined,
      videoDuracionSegundos: comercio.videoDuracionSegundos != null ? aNumero(comercio.videoDuracionSegundos) : null,
      videoDuracionOriginalSegundos: comercio.videoDuracionOriginalSegundos != null ? aNumero(comercio.videoDuracionOriginalSegundos) : null,
      videoRecorteInicioSegundos: comercio.videoRecorteInicioSegundos != null ? aNumero(comercio.videoRecorteInicioSegundos) : null,
      videoRecorteFinSegundos: comercio.videoRecorteFinSegundos != null ? aNumero(comercio.videoRecorteFinSegundos) : null,
      videoMimeType: comercio.videoMimeType ?? undefined,
    },
    esExpress: crudo.esExpress ?? false,
    tiempoEntregaMin: crudo.tiempoEntregaMin ?? null,
    categoriaId: aId(crudo.categoriaId) || undefined,
    comercioId: aId(crudo.comercioId) || undefined,
    categoria: crudo.categoria
      ? { id: aId(crudo.categoria.id), nombre: crudo.categoria.nombre ?? '', slug: crudo.categoria.slug, grupo: crudo.categoria.grupo }
      : undefined,
    oferta: (() => {
      const o = crudo.ofertas?.[0]
      if (!o) return undefined
      const stockLimite = o.stockLimite ?? null
      const stockUsado = aNumero(o.stockUsado)
      if (stockLimite !== null && stockUsado >= stockLimite) return undefined
      const precio = aNumero(crudo.precio)
      const valor  = aNumero(o.valor)
      const tipo   = o.tipo as 'PORCENTAJE' | 'VALOR_FIJO'
      const precioFinal = tipo === 'PORCENTAJE'
        ? Math.round(precio * (1 - valor / 100))
        : Math.max(0, Math.round(precio - valor))
      return {
        id:          o.id !== undefined && o.id !== null ? Number(o.id) : undefined,
        tipo,
        valor,
        etiqueta:    o.etiqueta ?? undefined,
        precioFinal,
        fin:         o.fin ?? '',
        stockLimite,
        stockUsado,
      }
    })(),
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
