import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  obtenerVitrina,
  listarAgenda,
  obtenerEvento,
  misReservasCultura,
  misEventosCultura,
  listarPublicacionesCulturales,
  listarMisPublicacionesVitrina,
  misFavoritosCultura,
  toggleLikePublicacion,
  toggleFavoritoPublicacionCultural,
  type PublicacionCultural,
  type EventoCultural,
  type ReservaCultural,
} from '@/lib/api/cultura'

/** Hook para la Vitrina digital de video y fotos */
export function useVitrinaQuery(params: {
  departamento?: string
  municipio?: string
  modulo?: string
  search?: string
  page?: number
} = {}) {
  return useQuery({
    queryKey: ['vitrina', params],
    queryFn: () => obtenerVitrina(params),
    staleTime: 1000 * 60 * 3, // 3 minutos
  })
}

/** Hook para la agenda de eventos culturales */
export function useAgendaCulturaQuery(params: {
  departamento?: string
  municipio?: string
  categoria?: string
  search?: string
  patrimonio?: boolean
  fechaDesde?: string
  fechaHasta?: string
} = {}) {
  return useQuery({
    queryKey: ['agenda-cultura', params],
    queryFn: () => listarAgenda(params),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })
}

/** Hook para detalle de un evento cultural */
export function useEventoCulturalQuery(id: number | null) {
  return useQuery({
    queryKey: ['evento-cultural', id],
    queryFn: () => (id ? obtenerEvento(id) : Promise.reject('No ID')),
    enabled: typeof id === 'number' && id > 0,
  })
}

/** Hook para las reservas culturales del usuario autenticado */
export function useMisReservasCulturaQuery(autenticado: boolean = true) {
  return useQuery({
    queryKey: ['mis-reservas-cultura'],
    queryFn: misReservasCultura,
    enabled: autenticado,
    staleTime: 1000 * 60 * 2,
  })
}

/** Hook para los eventos del comerciante autenticado */
export function useMisEventosCulturaQuery(autenticado: boolean = true) {
  return useQuery({
    queryKey: ['mis-eventos-cultura'],
    queryFn: misEventosCultura,
    enabled: autenticado,
    staleTime: 1000 * 60 * 2,
  })
}

/** Hook para publicaciones culturales de la galería */
export function usePublicacionesCulturalesQuery(params: { departamento?: string; municipio?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['publicaciones-culturales', params],
    queryFn: () => listarPublicacionesCulturales(params),
    staleTime: 1000 * 60 * 3,
  })
}

/** Hook para mis publicaciones de la vitrina */
export function useMisPublicacionesVitrinaQuery(params: { page?: number } = {}, autenticado: boolean = true) {
  return useQuery({
    queryKey: ['mis-publicaciones-vitrina', params],
    queryFn: () => listarMisPublicacionesVitrina(params),
    enabled: autenticado,
  })
}

/** Hook para eventos favoritos del usuario */
export function useMisFavoritosCulturaQuery(autenticado: boolean = true) {
  return useQuery({
    queryKey: ['mis-favoritos-cultura'],
    queryFn: misFavoritosCultura,
    enabled: autenticado,
    staleTime: 1000 * 60 * 5,
  })
}

/** Mutation para dar o quitar me gusta a una publicación */
export function useToggleLikePublicacionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => toggleLikePublicacion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitrina'] })
      queryClient.invalidateQueries({ queryKey: ['publicaciones-culturales'] })
    },
  })
}

/** Mutation para marcar/desmarcar publicación como favorita */
export function useToggleFavoritoPublicacionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => toggleFavoritoPublicacionCultural(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitrina'] })
      queryClient.invalidateQueries({ queryKey: ['publicaciones-culturales'] })
    },
  })
}
