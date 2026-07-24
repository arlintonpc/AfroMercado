'use client'

import L from 'leaflet'
import Link from 'next/link'
import type { ConfigTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'
import MapaBase, { distanciaKm, formatearDistancia, type MarcadorMapaBase } from '@/components/ui/MapaBase'

const iconoTour = new L.DivIcon({
  html: `<div style="width:32px;height:32px;background:#40916C;border:3px solid white;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px">🗺️</div>`,
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34], className: '',
})

export default function MapaTours({ tours, userLat, userLon }: { tours: ConfigTour[]; userLat: number | null; userLon: number | null }) {
  const conCoordenadas = tours.filter(t => t.comercio.latitud && t.comercio.longitud)

  const marcadores: MarcadorMapaBase[] = conCoordenadas.map(tour => {
    const lat = tour.comercio.latitud!
    const lon = tour.comercio.longitud!
    const dist = userLat && userLon ? distanciaKm(userLat, userLon, lat, lon) : null

    return {
      id: tour.id,
      position: [lat, lon],
      icon: iconoTour,
      popup: (
        <div className="space-y-1.5">
          <strong className="text-sm block">{tour.nombre}</strong>
          <p className="text-xs text-gray-500">📍 {tour.comercio.municipio}</p>
          <p className="text-xs text-gray-500">⏱️ {tour.duracionHoras}h</p>
          {dist !== null && <p className="text-xs font-medium text-blue-600">📏 {formatearDistancia(dist)}</p>}
          <p className="text-xs text-gray-600">Desde <strong>{formatearPrecio(Number(tour.precioPersona))}</strong>/pers.</p>
          <Link href={`/tours/${tour.id}`} className="block mt-2 text-center text-xs font-bold bg-[#2D6A4F] text-white rounded-lg py-1.5 hover:bg-[#40916C] transition-colors">
            Ver tour →
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
      emptyEmoji="🗺️"
      emptyTexto="Los tours aún no tienen ubicación registrada"
    />
  )
}
