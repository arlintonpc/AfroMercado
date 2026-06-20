'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { CarritoProvider } from '@/context/CarritoContext'
import { NotificacionProvider } from '@/context/NotificacionContext'
import { FavoritoProvider } from '@/context/FavoritoContext'
import { PushProvider } from '@/context/PushContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PushProvider>
        <NotificacionProvider>
          <FavoritoProvider>
            <CarritoProvider>{children}</CarritoProvider>
          </FavoritoProvider>
        </NotificacionProvider>
      </PushProvider>
    </AuthProvider>
  )
}
