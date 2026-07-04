import { apiFetch } from './client'

export interface ResultadoCupon {
  cupon: { id: number; codigo: string; tipo: string; valor: number }
  descuento: number
  totalConDescuento: number
}

export interface OpcionesCupon {
  /** IDs de los comercios presentes en el carrito (para cupones de tienda). */
  comercioIds?: number[]
  /** Subtotal por comercio { comercioId: subtotal } — hace que el descuento
   *  estimado coincida exactamente con el del checkout para cupones de tienda. */
  subtotalesPorComercio?: Record<number, number>
  /** Subtotal SIN ofertas por comercio. Cuando el cupón no es combinable con
   *  ofertas, el descuento se calcula sobre esta base menor. */
  subtotalesElegibles?: Record<number, number>
}

export async function validarCupon(
  codigo: string,
  subtotal: number,
  opciones: OpcionesCupon = {},
): Promise<ResultadoCupon> {
  const res = await apiFetch<{ ok: boolean; data: ResultadoCupon }>('/cupones/validar', {
    method: 'POST',
    body: {
      codigo,
      subtotal,
      ...(opciones.comercioIds?.length ? { comercioIds: opciones.comercioIds } : {}),
      ...(opciones.subtotalesPorComercio ? { subtotalesPorComercio: opciones.subtotalesPorComercio } : {}),
      ...(opciones.subtotalesElegibles ? { subtotalesElegibles: opciones.subtotalesElegibles } : {}),
    },
  })
  return res.data
}

// ── Módulo E: Programas y Subsidios ────────────────────────────

/** Lista alfabética de nombres de programa distintos, para poblar filtros. */
export async function listarProgramasCupon(): Promise<string[]> {
  const res = await apiFetch<{ ok: boolean; data: string[] }>('/cupones/programas')
  return res.data ?? []
}

export interface ComercioPorFiltro {
  id: number
  nombre: string
  municipio: string
  departamento: string | null
  usuarioId: number
}

/** Búsqueda estructurada de comercios activos y verificados por región, para asignación masiva de subsidios. */
export async function buscarComerciosPorFiltro(filtros: {
  departamento?: string
  municipio?: string
  organizacionTerritorialTipo?: string
}): Promise<ComercioPorFiltro[]> {
  const p = new URLSearchParams()
  if (filtros.departamento) p.set('departamento', filtros.departamento)
  if (filtros.municipio) p.set('municipio', filtros.municipio)
  if (filtros.organizacionTerritorialTipo) p.set('organizacionTerritorialTipo', filtros.organizacionTerritorialTipo)
  const res = await apiFetch<{ ok: boolean; data: ComercioPorFiltro[] }>(`/admin/comercios/buscar-por-filtro?${p}`)
  return res.data ?? []
}
