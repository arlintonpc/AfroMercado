'use client'

import L from 'leaflet'
import Link from 'next/link'
import type { ComercioExpress } from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'
import MapaBase, { distanciaKm, formatearDistancia, type MarcadorMapaBase } from '@/components/ui/MapaBase'

const iconoRestaurante = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

interface Props {
  comercios: ComercioExpress[]
  userLat: number | null
  userLon: number | null
}

export default function MapaExpress({ comercios, userLat, userLon }: Props) {
  const conCoordenadas = comercios.filter(c => c.comercio.latitud && c.comercio.longitud)

  const marcadores: MarcadorMapaBase[] = conCoordenadas.map(cfg => {
    const lat = cfg.comercio.latitud!
    const lon = cfg.comercio.longitud!
    const dist = userLat && userLon ? distanciaKm(userLat, userLon, lat, lon) : null

    return {
      id: cfg.id,
      position: [lat, lon],
      icon: iconoRestaurante,
      popup: (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.abierto ? 'bg-green-500' : 'bg-red-400'}`} />
            <strong className="text-sm">{cfg.comercio.nombre}</strong>
          </div>
          <p className="text-xs text-gray-500">📍 {cfg.comercio.municipio}</p>
          {dist !== null && (
            <p className="text-xs font-medium text-blue-600">📏 {formatearDistancia(dist)}</p>
          )}
          <div className="text-xs text-gray-500 flex gap-2 flex-wrap">
            <span>⏱ ~{cfg.tiempoPrepMinutos} min</span>
            {cfg.modalidades.includes('DOMICILIO') && (
              <span>🛵 {formatearPrecio(Number(cfg.costoEnvioBase))}</span>
            )}
          </div>
          <Link
            href={`/express/${cfg.comercio.id}`}
            className="block mt-2 text-center text-xs font-bold bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700 transition-colors"
          >
            Ver menú →
          </Link>
        </div>
      ),
    }
  })

  return (
    <MapaBase
      marcadores={marcadores}
      userLat={userLat}
      userLon={userLon}
      centroFallback={[5.0, -75.5]}
      zoomInicial={6}
      autoAbrir="cercania"
      emptyEmoji="📍"
      emptyTexto="Los restaurantes aún no tienen ubicación registrada"
      claseContenedor="rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-[50vh] min-h-[280px] max-h-[420px]"
    />
  )
}
