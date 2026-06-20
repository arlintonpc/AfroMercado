'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { suscribirPush, desuscribirPush } from '@/lib/push'

const PushContext = createContext<undefined>(undefined)

export function PushProvider({ children }: { children: ReactNode }) {
  const { token, autenticado } = useAuth()
  const suscritoRef = useRef(false)

  useEffect(() => {
    if (autenticado && token && !suscritoRef.current) {
      suscritoRef.current = true
      void suscribirPush(token)
    }
    if (!autenticado && suscritoRef.current && token) {
      suscritoRef.current = false
      void desuscribirPush(token)
    }
  }, [autenticado, token])

  return <PushContext.Provider value={undefined}>{children}</PushContext.Provider>
}

// Hook exportado por convención, aunque no expone valores.
export function usePush() {
  useContext(PushContext)
}
