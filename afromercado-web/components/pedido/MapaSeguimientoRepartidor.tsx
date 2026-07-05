'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const iconoRepartidor = new L.DivIcon({
  html: `<div style="width:22px;height:22px;background:#D4A017;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px">🛵</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: '',
})

function RecentrarMapa({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.panTo([lat, lng]) }, [lat, lng, map])
  return null
}

export default function MapaSeguimientoRepartidor({ lat, lng }: { lat: number; lng: number }) {
  const [centroInicial] = useState<[number, number]>([lat, lng])

  return (
    <div className="rounded-2xl overflow-hidden border border-[#1A1A1A]/8 h-64">
      <MapContainer
        center={centroInicial}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecentrarMapa lat={lat} lng={lng} />
        <Marker position={[lat, lng]} icon={iconoRepartidor}>
          <Popup>Tu repartidor está aquí</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
