'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { CarritoProvider } from '@/context/CarritoContext'

/**
 * Combina los providers globales. CarritoProvider va dentro de AuthProvider
 * porque el carrito depende del estado de autenticación.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CarritoProvider>{children}</CarritoProvider>
    </AuthProvider>
  )
}
