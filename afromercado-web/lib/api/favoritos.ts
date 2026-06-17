import { apiFetch } from './client'
import type { Producto } from '@/types/producto'

export interface FavoritoItem {
  id: number
  productoId: number
  createdAt: string
  producto: Producto
}

export async function toggleFavorito(productoId: number): Promise<{ esFavorito: boolean }> {
  return apiFetch(`/favoritos/${productoId}`, { method: 'POST' })
}

export async function listarFavoritos(): Promise<FavoritoItem[]> {
  const res = await apiFetch<{ ok: boolean; data: FavoritoItem[] }>('/favoritos')
  return res?.data ?? []
}

export async function listarIdsFavoritos(): Promise<number[]> {
  const res = await apiFetch<{ ok: boolean; data: number[] }>('/favoritos/ids')
  return res?.data ?? []
}
