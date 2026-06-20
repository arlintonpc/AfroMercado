import { apiFetch } from './client'
import type { Producto } from '@/types/producto'
import type { ProductoCrudo } from '@/lib/mapearProducto'

export interface FavoritoItemApi {
  id: number
  productoId: number
  createdAt: string
  producto: ProductoCrudo | Producto
}

export async function toggleFavorito(productoId: number): Promise<{ esFavorito: boolean }> {
  return apiFetch(`/favoritos/${productoId}`, { method: 'POST' })
}

export async function listarFavoritos(): Promise<FavoritoItemApi[]> {
  const res = await apiFetch<{ ok: boolean; data: FavoritoItemApi[] }>('/favoritos')
  return res?.data ?? []
}

export async function listarIdsFavoritos(): Promise<number[]> {
  const res = await apiFetch<{ ok: boolean; data: number[] }>('/favoritos/ids')
  return res?.data ?? []
}
