'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { RegionProvider } from '@/context/RegionContext'
import { CarritoProvider } from '@/context/CarritoContext'
import { NotificacionProvider } from '@/context/NotificacionContext'
import { FavoritoProvider } from '@/context/FavoritoContext'
import { PushProvider } from '@/context/PushContext'
import BannerRegionDetectada from '@/components/region/BannerRegionDetectada'
import IrruptorBienvenida from '@/components/publicidad/IrruptorBienvenida'
import IndicadorSinConexion from '@/components/IndicadorSinConexion'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RegionProvider>
        <PushProvider>
          <NotificacionProvider>
            <FavoritoProvider>
              <CarritoProvider>
                {children}
                <BannerRegionDetectada />
                <IrruptorBienvenida />
                <IndicadorSinConexion />
              </CarritoProvider>
            </FavoritoProvider>
          </NotificacionProvider>
        </PushProvider>
      </RegionProvider>
    </AuthProvider>
  )
}
