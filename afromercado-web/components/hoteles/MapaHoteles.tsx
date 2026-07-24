'use client'

import L from 'leaflet'
import Link from 'next/link'
import type { ConfigHotel } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import MapaBase, { distanciaKm, formatearDistancia, type MarcadorMapaBase } from '@/components/ui/MapaBase'

const iconoHotel = new L.DivIcon({
  html: `<div style="width:32px;height:32px;background:#2D6A4F;border:3px solid white;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px">🏨</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
  className: '',
})

export default function MapaHoteles({ hoteles, userLat, userLon }: { hoteles: ConfigHotel[]; userLat: number | null; userLon: number | null }) {
  const conCoordenadas = hoteles.filter(h => h.comercio.latitud && h.comercio.longitud)

  const marcadores: MarcadorMapaBase[] = conCoordenadas.map(hotel => {
    const lat = hotel.comercio.latitud!
    const lon = hotel.comercio.longitud!
    const dist = userLat && userLon ? distanciaKm(userLat, userLon, lat, lon) : null
    const desde = hotel.habitaciones.length > 0 ? Math.min(...hotel.habitaciones.map(h => Number(h.precioPorNoche))) : null

    return {
      id: hotel.id,
      position: [lat, lon],
      icon: iconoHotel,
      popupMinWidth: 220,
      popup: (
        <div className="space-y-1.5">
          <strong className="text-sm block">{hotel.comercio.nombre}</strong>
          <p className="text-xs text-gray-500">📍 {hotel.comercio.municipio}</p>
          {dist !== null && <p className="text-xs font-medium text-blue-600">📏 {formatearDistancia(dist)}</p>}
          {desde !== null && <p className="text-xs text-gray-600">Desde <strong>{formatearPrecio(desde)}</strong>/noche</p>}
          <Link href={`/hoteles/${hotel.id}`} className="block mt-2 text-center text-xs font-bold bg-[#2D6A4F] text-white rounded-lg py-1.5 hover:bg-[#40916C] transition-colors">
            Ver hotel →
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
      centroFallback={[5.0, -76.6]}
      zoomInicial={6}
      autoAbrir="cercania"
      emptyEmoji="🏨"
      emptyTexto="Los hoteles aún no tienen ubicación registrada"
    />
  )
}
