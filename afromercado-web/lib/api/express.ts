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
  videoUrl?: string | null
  videoPosterUrl?: string | null
  horarios?: HorarioExpress[]
}

export interface ItemPedidoExpress {
  id: number
  productoId: number
  cantidad: number
  precioUnitario: number
  subtotal: number
  nota: string | null
  complementos?: Array<{ nombre: string; precio: number }> | null
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
  fechaProgramada: string | null
  tiempoEstimadoMin: number
  tiempoAjustadoMin: number | null
  creadoAt: string
  aceptadoAt: string | null
  entregadoAt: string | null
  expiresAt: string
  montoDescuento: number | null
  codigoCupon: string | null
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
  fotoPlato?: string | null
  abiertoAhora?: boolean
  tieneCupon?: boolean
  videoUrl?: string | null
  videoPosterUrl?: string | null
}

// ── CLIENTE ──────────────────────────────────────────────────

export interface MenuSeccion {
  id: number
  configExpressId: number
  nombre: string
  icono: string
  orden: number
  activo: boolean
  createdAt: string
}

export interface MenuComercioExpress extends ComercioExpress {
  abiertoAhora: boolean
  horarios?: HorarioExpress[]
  secciones?: MenuSeccion[]
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
    menuSeccionId: number | null
    menuSeccion?: { id: number; nombre: string; icono: string } | null
    gruposComplemento?: Array<{
      id: number
      productoId?: number
      nombre: string
      minimo: number
      maximo: number
      requerido: boolean
      orden?: number
      origen?: 'PRODUCTO' | 'BIBLIOTECA'
      grupoBibliotecaId?: number
      items: Array<{
        id: number
        nombre: string
        icono: string | null
        imagenUrl: string | null
        precio: number
        origen?: 'PRODUCTO' | 'BIBLIOTECA'
        itemBibliotecaId?: number
      }>
    }>
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
  items: { productoId: number; cantidad: number; nota?: string; complementos?: Array<{ nombre: string; precio: number }> }[]
  notaCliente?: string
  direccionTexto?: string
  municipioEntrega?: string
  codigoCupon?: string
  /** ISO datetime; si se omite el pedido es inmediato (comportamiento actual) */
  fechaProgramada?: string
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

// ── SECCIONES DE MENÚ ────────────────────────────────────────

export async function listarSeccionesExpress(): Promise<MenuSeccion[]> {
  const r = await apiFetch<{ ok: boolean; data: MenuSeccion[] }>('/express/config/secciones')
  return r.data ?? []
}

export async function crearSeccionExpress(datos: { nombre: string; icono?: string }): Promise<MenuSeccion> {
  const r = await apiFetch<{ ok: boolean; data: MenuSeccion }>('/express/config/secciones', { method: 'POST', body: datos })
  return r.data
}

export async function actualizarSeccionExpress(id: number, datos: Partial<MenuSeccion>): Promise<MenuSeccion> {
  const r = await apiFetch<{ ok: boolean; data: MenuSeccion }>(`/express/config/secciones/${id}`, { method: 'PATCH', body: datos })
  return r.data
}

export async function eliminarSeccionExpress(id: number): Promise<void> {
  await apiFetch(`/express/config/secciones/${id}`, { method: 'DELETE' })
}

export async function asignarSeccionProducto(productoId: number, menuSeccionId: number | null): Promise<void> {
  await apiFetch(`/express/config/secciones/productos/${productoId}`, { method: 'PATCH', body: { menuSeccionId } })
}

// ── CUPONES EXPRESS ────────────────────────────────────────────

export interface CuponExpress {
  id: number
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number
  minimoSubtotal: number | null
  usosMaximos: number | null
  usosActuales: number
  activo: boolean
  inicio: string
  fin: string
  configExpressId: number | null
  createdAt: string
  _count?: { usos: number }
}

export interface ValidacionCuponExpress {
  cupon: CuponExpress
  descuento: number
  subtotalConDescuento: number
}

export async function validarCuponExpress(codigo: string, subtotal: number, comercioId?: number): Promise<ValidacionCuponExpress> {
  const q = comercioId ? `?comercioId=${comercioId}` : ''
  const r = await apiFetch<{ ok: boolean; data: ValidacionCuponExpress }>(`/express/cupones/validar${q}`, {
    method: 'POST',
    body: { codigo, subtotal },
  })
  return r.data
}

export async function listarCuponesExpress(): Promise<CuponExpress[]> {
  const r = await apiFetch<{ ok: boolean; data: CuponExpress[] }>('/express/mis-cupones')
  return r.data ?? []
}

export async function crearCuponExpress(datos: {
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: number
  minimoSubtotal?: number
  usosMaximos?: number
  inicio: string
  fin: string
}): Promise<CuponExpress> {
  const r = await apiFetch<{ ok: boolean; data: CuponExpress }>('/express/mis-cupones', { method: 'POST', body: datos })
  return r.data
}

export async function eliminarCuponExpress(id: number): Promise<void> {
  await apiFetch(`/express/mis-cupones/${id}`, { method: 'DELETE' })
}

// ── ESTADÍSTICAS EXPRESS ───────────────────────────────────────

export interface EstadisticasExpress {
  hoy: { pedidos: number; ingresos: number; comision: number }
  semana: { pedidos: number; ingresos: number; comision: number }
  mes: { pedidos: number; ingresos: number; comision: number }
  horasPico: number[]
  topProductos: Array<{
    producto: { id: number; nombre: string; fotoUrl: string | null }
    cantidad: number
    pedidos: number
  }>
  topComplementos: Array<{ nombre: string; cantidad: number }>
  ultimosPedidos: Array<{
    id: number; codigo: string; estado: string; total: number; creadoAt: string; modalidad: string
  }>
  rango?: {
    pedidos: number
    ingresos: number
    comision: number
    topProductos: EstadisticasExpress['topProductos']
    topComplementos: Array<{ nombre: string; cantidad: number }>
    desde: string
    hasta: string
  }
}

export async function obtenerEstadisticasExpress(params?: { desde?: string; hasta?: string }): Promise<EstadisticasExpress> {
  const qs = params?.desde && params?.hasta
    ? `?${new URLSearchParams({ desde: params.desde, hasta: params.hasta }).toString()}`
    : ''
  const r = await apiFetch<{ ok: boolean; data: EstadisticasExpress }>(`/express/mis-estadisticas${qs}`)
  return r.data
}

// ── FAVORITOS EXPRESS ──────────────────────────────────────────

export async function toggleFavoritoExpress(configExpressId: number): Promise<{ favorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; data: { favorito: boolean } }>(`/express/favoritos/${configExpressId}/toggle`, { method: 'POST' })
  return r.data
}

export async function misFavoritosExpress(): Promise<ComercioExpress[]> {
  const r = await apiFetch<{ ok: boolean; data: ComercioExpress[] }>('/express/favoritos/mis')
  return r.data
}

export async function esFavoritoExpress(configExpressId: number): Promise<{ favorito: boolean }> {
  const r = await apiFetch<{ ok: boolean; data: { favorito: boolean } }>(`/express/favoritos/${configExpressId}`)
  return r.data
}

// ── VIDEO EXPRESS ─────────────────────────────────────────────

export async function subirVideoExpress(
  file: File,
  meta?: { duracionSegundos?: number; ancho?: number; alto?: number; bytes?: number; mimeType?: string; formato?: string; recorteInicioSegundos?: number; recorteFinSegundos?: number }
): Promise<{ videoUrl: string; videoPosterUrl?: string }> {
  const form = new FormData()
  form.append('video', file)
  if (meta?.duracionSegundos != null) form.append('duracionSegundos', String(meta.duracionSegundos))
  if (meta?.ancho != null) form.append('ancho', String(meta.ancho))
  if (meta?.alto != null) form.append('alto', String(meta.alto))
  if (meta?.bytes != null) form.append('bytes', String(meta.bytes))
  if (meta?.mimeType) form.append('mimeType', meta.mimeType)
  if (meta?.formato) form.append('formato', meta.formato)
  if (meta?.recorteInicioSegundos != null) form.append('recorteInicioSegundos', String(meta.recorteInicioSegundos))
  if (meta?.recorteFinSegundos != null) form.append('recorteFinSegundos', String(meta.recorteFinSegundos))
  const r = await apiFetch<{ ok: boolean; data: any }>('/express/config/video', { method: 'POST', body: form })
  return r.data
}

export async function quitarVideoExpress(): Promise<void> {
  await apiFetch('/express/config/video', { method: 'DELETE' })
}

export async function guardarVideoLinkExpress(videoUrl: string): Promise<void> {
  await apiFetch('/express/config/video-link', { method: 'PATCH', body: { videoUrl } as any })
}

// ── COMPLEMENTOS EXPRESS ──────────────────────────────────────

export interface ItemComplemento {
  id: number
  grupoComplementoId: number
  nombre: string
  icono: string | null
  imagenUrl: string | null
  precio: number
  disponible: boolean
  orden: number
}

export async function subirImagenItemComplemento(itemId: number, file: File): Promise<ItemComplemento> {
  const form = new FormData()
  form.append('imagen', file)
  const r = await apiFetch<{ ok: boolean; data: ItemComplemento }>(`/express/complementos/items/${itemId}/imagen`, {
    method: 'POST',
    body: form,
  })
  return r.data
}

export interface GrupoComplemento {
  id: number
  productoId: number
  nombre: string
  minimo: number
  maximo: number
  requerido: boolean
  orden: number
  activo: boolean
  items: ItemComplemento[]
}

export interface GrupoComplementoBiblioteca {
  id: number
  comercioId: number
  nombre: string
  minimo: number
  maximo: number
  requerido: boolean
  orden: number
  activo: boolean
  items: ItemComplementoBiblioteca[]
}

export interface ItemComplementoBiblioteca {
  id: number
  grupoBibliotecaId: number
  nombre: string
  icono: string | null
  imagenUrl: string | null
  precio: number
  disponible: boolean
  orden: number
}

export interface ProductoGrupoComplemento {
  id: number
  productoId: number
  grupoBibliotecaId: number
  minimoOverride: number | null
  maximoOverride: number | null
  requeridoOverride: boolean | null
  orden: number
  activo: boolean
  grupo: GrupoComplementoBiblioteca
}

export async function listarBibliotecaComplementos(productoId: number): Promise<{
  grupos: GrupoComplementoBiblioteca[]
  asignaciones: ProductoGrupoComplemento[]
}> {
  const r = await apiFetch<{ ok: boolean; data: { grupos: GrupoComplementoBiblioteca[]; asignaciones: ProductoGrupoComplemento[] } }>(
    `/express/complementos/${productoId}/biblioteca`
  )
  return r.data ?? { grupos: [], asignaciones: [] }
}

export async function crearGrupoBiblioteca(
  datos: { nombre: string; minimo?: number; maximo?: number; requerido?: boolean; orden?: number }
): Promise<GrupoComplementoBiblioteca> {
  const r = await apiFetch<{ ok: boolean; data: GrupoComplementoBiblioteca }>('/express/complementos/biblioteca/grupos', {
    method: 'POST',
    body: datos,
  })
  return r.data
}

export async function crearItemBiblioteca(
  grupoId: number,
  datos: { nombre: string; icono?: string; precio?: number; disponible?: boolean; orden?: number }
): Promise<ItemComplementoBiblioteca> {
  const r = await apiFetch<{ ok: boolean; data: ItemComplementoBiblioteca }>(`/express/complementos/biblioteca/grupos/${grupoId}/items`, {
    method: 'POST',
    body: datos,
  })
  return r.data
}

export async function subirImagenItemBiblioteca(itemId: number, file: File): Promise<ItemComplementoBiblioteca> {
  const form = new FormData()
  form.append('imagen', file)
  const r = await apiFetch<{ ok: boolean; data: ItemComplementoBiblioteca }>(`/express/complementos/biblioteca/items/${itemId}/imagen`, {
    method: 'POST',
    body: form,
  })
  return r.data
}

export async function vincularGrupoBiblioteca(productoId: number, grupoId: number): Promise<ProductoGrupoComplemento> {
  const r = await apiFetch<{ ok: boolean; data: ProductoGrupoComplemento }>(`/express/complementos/${productoId}/biblioteca/${grupoId}`, {
    method: 'POST',
  })
  return r.data
}

export async function desvincularGrupoBiblioteca(productoId: number, grupoId: number): Promise<void> {
  await apiFetch(`/express/complementos/${productoId}/biblioteca/${grupoId}`, { method: 'DELETE' })
}

export async function listarComplementos(productoId: number): Promise<GrupoComplemento[]> {
  const r = await apiFetch<{ ok: boolean; data: GrupoComplemento[] }>(`/express/complementos/${productoId}`)
  return r.data ?? []
}

export async function crearGrupoComplemento(
  productoId: number,
  datos: { nombre: string; minimo?: number; maximo?: number; requerido?: boolean; orden?: number }
): Promise<GrupoComplemento> {
  const r = await apiFetch<{ ok: boolean; data: GrupoComplemento }>(`/express/complementos/${productoId}/grupos`, {
    method: 'POST', body: datos,
  })
  return r.data
}

export async function actualizarGrupoComplemento(
  id: number,
  datos: Partial<{ nombre: string; minimo: number; maximo: number; requerido: boolean; orden: number; activo: boolean }>
): Promise<GrupoComplemento> {
  const r = await apiFetch<{ ok: boolean; data: GrupoComplemento }>(`/express/complementos/grupos/${id}`, {
    method: 'PATCH', body: datos,
  })
  return r.data
}

export async function eliminarGrupoComplemento(id: number): Promise<void> {
  await apiFetch(`/express/complementos/grupos/${id}`, { method: 'DELETE' })
}

export async function crearItemComplemento(
  grupoId: number,
  datos: { nombre: string; icono?: string; precio?: number; disponible?: boolean; orden?: number }
): Promise<ItemComplemento> {
  const r = await apiFetch<{ ok: boolean; data: ItemComplemento }>(`/express/complementos/grupos/${grupoId}/items`, {
    method: 'POST', body: datos,
  })
  return r.data
}

export async function actualizarItemComplemento(
  id: number,
  datos: Partial<{ nombre: string; icono: string | null; precio: number; disponible: boolean; orden: number }>
): Promise<ItemComplemento> {
  const r = await apiFetch<{ ok: boolean; data: ItemComplemento }>(`/express/complementos/items/${id}`, {
    method: 'PATCH', body: datos,
  })
  return r.data
}

export async function eliminarItemComplemento(id: number): Promise<void> {
  await apiFetch(`/express/complementos/items/${id}`, { method: 'DELETE' })
}

export async function copiarGrupoATodos(grupoId: number): Promise<{ productosActualizados: number }> {
  const r = await apiFetch<{ ok: boolean; data: { productosActualizados: number } }>(`/express/complementos/${grupoId}/copiar-a-todos`, { method: 'POST' })
  return r.data
}
