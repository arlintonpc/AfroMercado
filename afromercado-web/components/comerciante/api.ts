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
import { apiFetch, obtenerToken } from '@/lib/api/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

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
  estadoRegistro?: 'PENDIENTE_REVISION' | 'APROBADO' | 'RECHAZADO' | 'SUSPENDIDO'
  motivoRechazo?: string | null
  fotoDocumentoUrl?: string | null
  whatsappVisible?: boolean
  vereda?: string | null
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
  imagenes: string[]
  activo: boolean
  diasAlistamientoMin: number
  diasAlistamientoMax: number
  alcance: 'LOCAL' | 'NACIONAL' | 'AMBOS'
  pesoKg?: string | number | null
}

export interface CategoriaComerciante {
  id: number
  nombre: string
  slug: string
  icono?: string | null
  activa: boolean
}

export type TipoDocumento = 'CC' | 'TI' | 'CE' | 'PEP' | 'PASAPORTE' | 'NIT'

export interface DatosComercio {
  nombre: string
  municipio: string
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  descripcion?: string
  historia?: string
  whatsapp?: string
  vereda?: string
  logoUrl?: string
  fotoDocumentoUrl?: string
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
  categoriaId?: number
  pesoKg?: number
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
  pesoKg?: number | null
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

/**
 * Sube una o varias imágenes a un producto (multipart, campo "imagenes").
 * POST /productos/:id/imagenes → { ok, producto }
 */
export async function subirImagenesProducto(
  id: number,
  files: File[],
): Promise<ProductoComerciante> {
  const fd = new FormData()
  files.forEach((f) => fd.append('imagenes', f))
  const token = obtenerToken()
  const res = await fetch(`${API_URL}/productos/${id}/imagenes`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  if (!res.ok) {
    let msg = 'No pudimos subir las imágenes.'
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
      else if (j?.message) msg = j.message
    } catch {
      // sin cuerpo
    }
    throw new Error(msg)
  }
  const j = await res.json()
  return j.producto
}

// ── Estadísticas del comerciante ──────────────────────────────

export interface ItemPedidoComerciante {
  id: number
  cantidad: number
  producto: { nombre: string; fotoUrl?: string | null }
}

export interface SubPedidoComerciante {
  id: number
  neto: number
  pedido: {
    id: number
    estado: string
    createdAt: string
    direccionTexto?: string | null
    comprador?: { nombre: string; telefono?: string | null }
  }
  items: ItemPedidoComerciante[]
}

export interface TopProducto {
  id: number
  nombre: string
  fotoUrl?: string | null
  cantidadVendida: number
}

export interface EstadisticasComerciante {
  ingresosNetos: number
  porPreparar: SubPedidoComerciante[]
  recientes: SubPedidoComerciante[]
  topProductos: TopProducto[]
}

export async function obtenerMisEstadisticas(): Promise<EstadisticasComerciante> {
  const res = await apiFetch<{ ok: boolean; data: EstadisticasComerciante }>(
    '/comercios/mis-estadisticas'
  )
  return res.data
}

/** Quita una imagen del producto. DELETE /productos/:id/imagenes */
export async function quitarImagenProducto(
  id: number,
  url: string,
): Promise<ProductoComerciante> {
  const resp = await apiFetch<{ ok: boolean; producto: ProductoComerciante }>(
    `/productos/${id}/imagenes`,
    { method: 'DELETE', body: { url } },
  )
  return resp.producto
}

/** Marca una imagen como principal. PATCH /productos/:id/foto-principal */
export async function fotoPrincipalProducto(
  id: number,
  url: string,
): Promise<ProductoComerciante> {
  const resp = await apiFetch<{ ok: boolean; producto: ProductoComerciante }>(
    `/productos/${id}/foto-principal`,
    { method: 'PATCH', body: { url } },
  )
  return resp.producto
}

export interface ItemPedido {
  id: number
  cantidad: number
  precioUnitario: number
  subtotal: number
  producto: { nombre: string; fotoUrl?: string | null }
}

export interface MiSubPedido {
  id: number
  estado: 'CONFIRMADO' | 'EN_PREPARACION' | 'LISTO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO'
  neto: number
  pedido: {
    id: number
    estado: string
    createdAt: string
    direccionTexto: string
    notas?: string | null
    comprador: { nombre: string; telefono?: string | null; email: string }
  }
  items: ItemPedido[]
}

export async function listarMisPedidos(): Promise<MiSubPedido[]> {
  const res = await apiFetch<{ ok: boolean; data: MiSubPedido[] }>('/comercios/mis-pedidos')
  return res.data ?? []
}

export async function actualizarComercio(datos: Partial<DatosComercio>): Promise<Comercio> {
  const resp = await apiFetch<{ ok: boolean; comercio: Comercio }>('/comercios', {
    method: 'PATCH',
    body: datos,
  })
  return resp.comercio
}

export async function subirDocumentoComercio(file: File): Promise<{ url: string }> {
  const token = obtenerToken()
  const fd = new FormData()
  fd.append('documento', file)
  const res = await fetch(`${API_URL}/comercios/subir-documento`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  if (!res.ok) {
    let msg = 'No se pudo subir el documento.'
    try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* sin cuerpo */ }
    throw new Error(msg)
  }
  return res.json()
}

// ── Ofertas ───────────────────────────────────────────────────

export interface Oferta {
  id: number
  productoId: number
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number | string
  etiqueta: string | null
  inicio: string
  fin: string
  stockLimite: number | null
  activa: boolean
  createdAt: string
  producto: { id: number; nombre: string; precio: number | string; fotoUrl: string | null }
}

export interface DatosOferta {
  productoId: number
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number
  inicio: string
  fin: string
  etiqueta?: string
  stockLimite?: number
}

export async function listarMisOfertas(): Promise<Oferta[]> {
  const res = await apiFetch<{ ok: boolean; items: Oferta[] }>('/ofertas/mis-ofertas')
  return res.items ?? []
}

export async function crearOferta(datos: DatosOferta): Promise<Oferta> {
  const res = await apiFetch<{ ok: boolean; oferta: Oferta }>('/ofertas', {
    method: 'POST',
    body: datos,
  })
  return res.oferta
}

export async function desactivarOferta(id: number): Promise<void> {
  await apiFetch(`/ofertas/${id}/desactivar`, { method: 'PATCH' })
}

// ── Liquidaciones ─────────────────────────────────────────────

export interface Liquidacion {
  id: number
  tipo: 'COMERCIANTE' | 'REPARTIDOR'
  monto: number
  estado: 'PENDIENTE' | 'PAGADA'
  periodoDesde: string
  periodoHasta: string
  cuentaDestino: string | null
  comprobante: string | null
  notas: string | null
  createdAt: string
  pagadoAt: string | null
}

export async function listarMisLiquidaciones(): Promise<Liquidacion[]> {
  const res = await apiFetch<{ ok: boolean; data: Liquidacion[] }>('/comercios/liquidaciones')
  return res.data ?? []
}

export async function avanzarEstadoPedido(subPedidoId: number): Promise<MiSubPedido> {
  const res = await apiFetch<{ ok: boolean; subPedido: MiSubPedido }>(
    `/comercios/mis-pedidos/${subPedidoId}/estado`,
    { method: 'PATCH', body: {} }
  )
  return res.subPedido
}

// ── Cupones del vendedor ──────────────────────────────────────

export interface CuponVendedor {
  id: number
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number | string
  minimoCompra: number | string | null
  usosMaximos: number | null
  usosMaximosPorUsuario: number | null
  usosActuales: number
  activo: boolean
  inicio: string
  fin: string
  soloNuevos: boolean
  createdAt: string
  _count?: { usos: number }
}

/** Reglas vigentes que gobiernan los cupones del vendedor (vienen del Centro de Reglas). */
export interface ReglasCupon {
  permitido: boolean
  maxPct: number
}

export interface DatosCuponVendedor {
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number
  inicio: string
  fin: string
  minimoCompra?: number
  usosMaximos?: number
  usosMaximosPorUsuario?: number
  soloNuevos?: boolean
}

export async function listarMisCupones(): Promise<{ items: CuponVendedor[]; reglas: ReglasCupon }> {
  const res = await apiFetch<{ ok: boolean; data: { items: CuponVendedor[]; reglas: ReglasCupon } }>(
    '/cupones/mis-cupones'
  )
  return res.data ?? { items: [], reglas: { permitido: true, maxPct: 50 } }
}

export async function crearCuponVendedor(datos: DatosCuponVendedor): Promise<CuponVendedor> {
  const res = await apiFetch<{ ok: boolean; data: CuponVendedor }>('/cupones/mis-cupones', {
    method: 'POST',
    body: datos,
  })
  return res.data
}

export async function desactivarCuponVendedor(id: number): Promise<void> {
  await apiFetch(`/cupones/mis-cupones/${id}/desactivar`, { method: 'PATCH' })
}
