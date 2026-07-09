export interface Producto {
  id: string
  nombre: string
  descripcion?: string
  historia?: string
  precio: number
  unidad: string
  stock: number
  stockReservado?: number
  diasAlistamientoMin: number
  diasAlistamientoMax: number
  alcance: 'LOCAL' | 'NACIONAL' | 'AMBOS'
  fotoUrl?: string
  /** Galería: imágenes adicionales del producto (además de fotoUrl). */
  imagenes?: string[]
  videoUrl?: string | null
  videoPosterUrl?: string | null
  videoDuracionSegundos?: number | null
  videoDuracionOriginalSegundos?: number | null
  videoRecorteInicioSegundos?: number | null
  videoRecorteFinSegundos?: number | null
  videoMimeType?: string | null
  activo: boolean
  comercio: {
    nombre: string
    municipio: string
    verificado: boolean
    verificadoEtnico?: boolean
    totalVentas: number
    calificacion: number
    totalReviews: number
    historia?: string
    whatsappVisible?: boolean
    videoUrl?: string | null
    videoPosterUrl?: string | null
    videoDuracionSegundos?: number | null
    videoDuracionOriginalSegundos?: number | null
    videoRecorteInicioSegundos?: number | null
    videoRecorteFinSegundos?: number | null
    videoMimeType?: string | null
    ivaActivo?: boolean
    ivaPorcentaje?: number
  }
  categoriaId?: string
  comercioId?: string
  categoria?: { id: string; nombre: string; slug?: string; grupo?: 'ANCESTRAL' | 'LOCAL' }
  pesoKg?: number | null
  esExpress?: boolean
  tiempoEntregaMin?: number | null
  oferta?: {
    id?:         number
    tipo:        'PORCENTAJE' | 'VALOR_FIJO'
    valor:       number
    etiqueta?:   string
    precioFinal: number
    fin:         string
    stockLimite?: number | null
    stockUsado:  number
  }
}
