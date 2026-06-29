'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import type { ComercioExpress } from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'

// Fix el icono por defecto de Leaflet que falla con webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const iconoRestaurante = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const iconoUsuario = new L.DivIcon({
  html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  className: '',
})

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function formatearDistancia(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

// Centra el mapa cuando cambia la ubicación del usuario
function CentrarMapa({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lon], map.getZoom()) }, [lat, lon, map])
  return null
}

interface Props {
  comercios: ComercioExpress[]
  userLat: number | null
  userLon: number | null
}

export default function MapaExpress({ comercios, userLat, userLon }: Props) {
  const conCoordenadas = comercios.filter(c => c.comercio.latitud && c.comercio.longitud)

  // Centro inicial: promedio de comercios con coords, o Colombia si no hay ninguno
  const centroInicial: [number, number] = conCoordenadas.length > 0
    ? [
        conCoordenadas.reduce((s, c) => s + c.comercio.latitud!, 0) / conCoordenadas.length,
        conCoordenadas.reduce((s, c) => s + c.comercio.longitud!, 0) / conCoordenadas.length,
      ]
    : [5.0, -75.5] // Colombia central

  const zoom = userLat && userLon ? 10 : conCoordenadas.length > 0 ? 8 : 6

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 420 }}>
      <MapContainer
        center={userLat && userLon ? [userLat, userLon] : centroInicial}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Posición del usuario */}
        {userLat && userLon && (
          <>
            <Marker position={[userLat, userLon]} icon={iconoUsuario}>
              <Popup><strong>Tu ubicación</strong></Popup>
            </Marker>
            <Circle
              center={[userLat, userLon]}
              radius={500}
              pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.08, weight: 1.5 }}
            />
            <CentrarMapa lat={userLat} lon={userLon} />
          </>
        )}

        {/* Marcadores de restaurantes */}
        {conCoordenadas.map(cfg => {
          const lat = cfg.comercio.latitud!
          const lon = cfg.comercio.longitud!
          const dist = userLat && userLon ? distanciaKm(userLat, userLon, lat, lon) : null

          return (
            <Marker key={cfg.id} position={[lat, lon]} icon={iconoRestaurante}>
              <Popup minWidth={200}>
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
              </Popup>
            </Marker>
          )
        })}

        {/* Aviso si no hay comercios con coordenadas */}
        {conCoordenadas.length === 0 && (
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'white', padding: '12px 20px',
              borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.15)',
              zIndex: 1000, textAlign: 'center', fontSize: 13, color: '#666'
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>📍</div>
            Los restaurantes aún no tienen ubicación registrada
          </div>
        )}
      </MapContainer>
    </div>
  )
}
