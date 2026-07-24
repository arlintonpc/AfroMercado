'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { listarCategorias } from '@/lib/api/productos'
import { listarHoteles, type ConfigHotel } from '@/lib/api/hotel'
import { listarTours, type ConfigTour } from '@/lib/api/tour'
import { listarTransportes, type ConfigTransporte } from '@/lib/api/transporte'
import { mapearProductos, type ProductoCrudo } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'
import type { Categoria } from '@/types/categoria'

interface VisibilidadInicioItem {
  tipo?: 'HOME_DESTACADO' | 'CATALOGO' | string
  etiqueta?: string | null
  producto?: ProductoCrudo | null
}

export interface InicioQueryData {
  categorias: Categoria[]
  hoteles: ConfigHotel[]
  tours: ConfigTour[]
  transportes: ConfigTransporte[]
  destHome: Producto[]
  destHomeEtiquetas: Map<string, string>
  destCatalogo: Map<string, string>
}

async function obtenerVisibilidadesInicio(departamento?: string | null): Promise<Pick<InicioQueryData, 'destHome' | 'destHomeEtiquetas' | 'destCatalogo'>> {
  const qs = departamento ? `?departamento=${encodeURIComponent(departamento)}` : ''
  const datos = await apiFetch<{ ok: boolean; items: VisibilidadInicioItem[] }>(`/productos/destacados${qs}`, {
    auth: false,
  })
  const visibilidades = Array.isArray(datos.items) ? datos.items : []

  const homeVisibilidades = visibilidades.filter(
    (v): v is VisibilidadInicioItem & { producto: ProductoCrudo } => v.tipo === 'HOME_DESTACADO' && Boolean(v.producto),
  )
  const catalogoVisibilidades = visibilidades.filter(
    (v): v is VisibilidadInicioItem & { producto: ProductoCrudo } => v.tipo === 'CATALOGO' && Boolean(v.producto),
  )

  return {
    destHome: mapearProductos(homeVisibilidades.map((v) => v.producto)),
    destHomeEtiquetas: new Map(
      homeVisibilidades.map((v) => [
        String(v.producto.id),
        v.etiqueta?.trim() || 'Patrocinado',
      ] as [string, string]),
    ),
    destCatalogo: new Map(
      catalogoVisibilidades.map((v) => [
        String(v.producto.id),
        v.etiqueta?.trim() || 'Patrocinado',
      ] as [string, string]),
    ),
  }
}

export function useInicioQuery(departamento?: string | null) {
  return useQuery({
    queryKey: ['home-bootstrap', departamento ?? 'all'],
    queryFn: async (): Promise<InicioQueryData> => {
      const departamentoQuery = departamento ?? undefined
      const [categorias, hoteles, tours, transportes, visibilidades] = await Promise.all([
        listarCategorias().catch(() => []),
        listarHoteles({ departamento: departamentoQuery }).catch(() => []),
        listarTours({ departamento: departamentoQuery }).catch(() => []),
        listarTransportes({ departamento: departamentoQuery }).catch(() => []),
        obtenerVisibilidadesInicio(departamento).catch(() => ({
          destHome: [],
          destHomeEtiquetas: new Map<string, string>(),
          destCatalogo: new Map<string, string>(),
        })),
      ])

      return {
        categorias,
        hoteles,
        tours,
        transportes,
        destHome: visibilidades.destHome,
        destHomeEtiquetas: visibilidades.destHomeEtiquetas,
        destCatalogo: visibilidades.destCatalogo,
      }
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: (previous) => previous,
  })
}
