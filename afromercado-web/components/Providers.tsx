'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { CarritoProvider } from '@/context/CarritoContext'
import { NotificacionProvider } from '@/context/NotificacionContext'
import { FavoritoProvider } from '@/context/FavoritoContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificacionProvider>
        <FavoritoProvider>
          <CarritoProvider>{children}</CarritoProvider>
        </FavoritoProvider>
      </NotificacionProvider>
    </AuthProvider>
  )
}
