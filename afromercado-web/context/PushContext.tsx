'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { suscribirPush, desuscribirPush } from '@/lib/push'

const PushContext = createContext<undefined>(undefined)

export function PushProvider({ children }: { children: ReactNode }) {
  const { token, autenticado } = useAuth()
  const suscritoRef = useRef(false)
  const tokenSuscripcionRef = useRef<string | null>(null)
  const colaRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    colaRef.current = colaRef.current.then(async () => {
      const tokenAnterior = tokenSuscripcionRef.current

      if (!autenticado || !token) {
        if (suscritoRef.current && tokenAnterior) {
          try {
            await desuscribirPush(tokenAnterior)
          } finally {
            suscritoRef.current = false
            tokenSuscripcionRef.current = null
          }
        } else {
          tokenSuscripcionRef.current = null
        }
        return
      }

      if (tokenAnterior && tokenAnterior !== token && suscritoRef.current) {
        await desuscribirPush(tokenAnterior)
        suscritoRef.current = false
        tokenSuscripcionRef.current = null
      }

      if (tokenSuscripcionRef.current === token && suscritoRef.current) return

      tokenSuscripcionRef.current = token
      const ok = await suscribirPush(token)
      suscritoRef.current = ok
      if (!ok) {
        tokenSuscripcionRef.current = null
      }
    }).catch(() => {
      suscritoRef.current = false
      tokenSuscripcionRef.current = null
    })
  }, [autenticado, token])

  return <PushContext.Provider value={undefined}>{children}</PushContext.Provider>
}

// Hook exportado por convención, aunque no expone valores.
export function usePush() {
  useContext(PushContext)
}
