/**
 * Funciones de API específicas del área del comerciante.
 *
 * Reutiliza `apiFetch` (que adjunta el token automáticamente) de
 * lib/api/client. Vive bajo components/comerciante para no modificar
 * lib/api/*, según las reglas del proyecto.
 *
 * Rutas backend verificadas en vivo:
 *  - GET  /comercios/mi-comercio   → { ok, comercio } | 404
 *  - POST /comercios               → { ok, comercio }
 *  - GET  /productos/mis/productos → { ok, productos }
 *  - POST /productos               → { ok, producto }
 *  - GET  /categorias              → { ok, categorias }
 */
import { apiFetch } from '@/lib/api/client'

/** Comercio tal como lo devuelve el backend. */
export interface Comercio {
  id: number
  usuarioId: number
  nombre: string
  municipio: string
  descripcion?: string | null
  historia?: string | null
  whatsapp?: string | null
  logoUrl?: string | null
  /** El backend lo serializa como string (Decimal). */
  calificacion: string | number
  totalReviews: number
  totalVentas: number
  verificado: boolean
  activo: boolean
}

/** Producto propio del comerciante (forma de /productos/mis/productos). */
export interface ProductoComerciante {
  id: number
  comercioId: number
  categoriaId: number | null
  nombre: string
  descripcion: string | null
  /** El backend lo serializa como string (Decimal). */
  precio: string | number
  unidad: string
  stock: number
  stockReservado: number
  fotoUrl: string | null
  activo: boolean
  diasAlistamientoMin: number
  diasAlistamientoMax: number
  alcance: 'LOCAL' | 'NACIONAL' | 'AMBOS'
}

export interface CategoriaComerciante {
  id: number
  nombre: string
  slug: string
  icono?: string | null
  activa: boolean
}

export interface DatosComercio {
  nombre: string
  municipio: string
  descripcion?: string
  historia?: string
  whatsapp?: string
}

export interface DatosProducto {
  nombre: string
  descripcion?: string
  precio: number
  unidad: string
  stock: number
  diasAlistamientoMin: number
  diasAlistamientoMax: number
  alcance: 'LOCAL' | 'NACIONAL' | 'AMBOS'
  fotoUrl?: string
}

/**
 * Obtiene el comercio del comerciante autenticado.
 * Devuelve null si todavía no tiene comercio (404).
 */
export async function obtenerMiComercio(): Promise<Comercio | null> {
  try {
    const datos = await apiFetch<{ ok: boolean; comercio: Comercio }>(
      '/comercios/mi-comercio',
    )
    return datos.comercio ?? null
  } catch (err) {
    // El backend responde 404 cuando aún no hay comercio registrado.
    const mensaje = err instanceof Error ? err.message : ''
    if (/no tienes un comercio/i.test(mensaje)) return null
    throw err
  }
}

/**
 * Crea el comercio del comerciante.
 * POST /comercios → { ok, comercio }
 */
export async function crearComercio(datos: DatosComercio): Promise<Comercio> {
  const resp = await apiFetch<{ ok: boolean; comercio: Comercio }>('/comercios', {
    method: 'POST',
    body: datos,
  })
  return resp.comercio
}

/**
 * Lista los productos del comerciante autenticado.
 * GET /productos/mis/productos → { ok, productos }
 */
export async function listarMisProductos(): Promise<ProductoComerciante[]> {
  const resp = await apiFetch<{ ok: boolean; productos: ProductoComerciante[] }>(
    '/productos/mis/productos',
  )
  return resp.productos ?? []
}

/**
 * Publica un nuevo producto.
 * POST /productos → { ok, producto }
 *
 * Nota: NO se envía `historia` porque el modelo Producto del backend no
 * tiene ese campo y enviarlo provoca un error 500.
 */
export async function crearProducto(
  datos: DatosProducto,
): Promise<ProductoComerciante> {
  const resp = await apiFetch<{ ok: boolean; producto: ProductoComerciante }>(
    '/productos',
    { method: 'POST', body: datos },
  )
  return resp.producto
}

export interface DatosActualizarProducto {
  nombre?: string
  descripcion?: string
  precio?: number
  stock?: number
  alcance?: 'LOCAL' | 'NACIONAL' | 'AMBOS'
  fotoUrl?: string
}

/**
 * Busca uno de los productos del comerciante por id (desde su propia lista).
 * Devuelve null si no se encuentra.
 */
export async function obtenerMiProducto(
  id: number,
): Promise<ProductoComerciante | null> {
  const productos = await listarMisProductos()
  return productos.find((p) => p.id === id) ?? null
}

/**
 * Actualiza un producto propio.
 * PATCH /productos/:id → { ok, producto }
 *
 * Nota: NO se envía `historia` (el modelo Producto no lo tiene en el backend).
 */
export async function actualizarProducto(
  id: number,
  datos: DatosActualizarProducto,
): Promise<ProductoComerciante> {
  const resp = await apiFetch<{ ok: boolean; producto: ProductoComerciante }>(
    `/productos/${id}`,
    { method: 'PATCH', body: datos },
  )
  return resp.producto
}

/**
 * Lista las categorías activas.
 * GET /categorias → { ok, categorias }
 */
export async function listarCategorias(): Promise<CategoriaComerciante[]> {
  const datos = await apiFetch<{
    ok?: boolean
    categorias?: CategoriaComerciante[]
  }>('/categorias', { auth: false })
  return datos.categorias ?? []
}
