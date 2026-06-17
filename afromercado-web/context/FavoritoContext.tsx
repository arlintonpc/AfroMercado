'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { listarIdsFavoritos, toggleFavorito } from '@/lib/api/favoritos'

interface FavoritoCtx {
  ids: Set<number>
  toggle: (productoId: number) => Promise<void>
  esFavorito: (productoId: number) => boolean
}

const Ctx = createContext<FavoritoCtx>({ ids: new Set(), toggle: async () => {}, esFavorito: () => false })

export function FavoritoProvider({ children }: { children: React.ReactNode }) {
  const { autenticado } = useAuth()
  const [ids, setIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!autenticado) { setIds(new Set()); return }
    listarIdsFavoritos().then((lista) => setIds(new Set(lista))).catch(() => {})
  }, [autenticado])

  const toggle = useCallback(async (productoId: number) => {
    if (!autenticado) return
    // Optimistic update
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(productoId)) next.delete(productoId)
      else next.add(productoId)
      return next
    })
    try {
      const { esFavorito } = await toggleFavorito(productoId)
      setIds((prev) => {
        const next = new Set(prev)
        if (esFavorito) next.add(productoId)
        else next.delete(productoId)
        return next
      })
    } catch {
      // Revert on error
      setIds((prev) => {
        const next = new Set(prev)
        if (next.has(productoId)) next.delete(productoId)
        else next.add(productoId)
        return next
      })
    }
  }, [autenticado])

  const esFavorito = useCallback((id: number) => ids.has(id), [ids])

  return <Ctx.Provider value={{ ids, toggle, esFavorito }}>{children}</Ctx.Provider>
}

export function useFavoritos() { return useContext(Ctx) }
