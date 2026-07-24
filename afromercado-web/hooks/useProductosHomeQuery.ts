'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { listarProductos } from '@/lib/api/productos'
import { mapearProductos, type ProductoCrudo } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'

interface ProductosHomePagina {
  items: Producto[]
  pagina: number
  paginas: number
  total: number
}

interface ProductosHomeQueryParams {
  departamento?: string | null
  categoriaId?: string
}

export function useProductosHomeQuery({ departamento, categoriaId }: ProductosHomeQueryParams) {
  const query = useInfiniteQuery({
    queryKey: ['home-productos', departamento ?? 'all', categoriaId ?? 'todos'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<ProductosHomePagina> => {
      const resultado = await listarProductos({
        categoriaId: categoriaId && categoriaId !== 'todos' ? categoriaId : undefined,
        departamento: departamento ?? undefined,
        porPagina: 24,
        pagina: Number(pageParam) || 1,
      })

      return {
        items: mapearProductos(resultado.items as ProductoCrudo[]),
        pagina: resultado.pagina,
        paginas: resultado.paginas,
        total: resultado.total,
      }
    },
    getNextPageParam: (ultimaPagina) => (
      ultimaPagina.pagina < ultimaPagina.paginas
        ? ultimaPagina.pagina + 1
        : undefined
    ),
    staleTime: 1000 * 60 * 5,
  })

  const productos = (query.data?.pages ?? []).flatMap((pagina) => pagina.items)

  return {
    ...query,
    productos,
  }
}
