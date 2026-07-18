'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { formatearPrecio } from '@/lib/formatearPrecio'

export interface ComercioMapaAdmin {
  id: number
  nombre: string
  municipio: string
  departamento: string | null
  latitud: number
  longitud: number
  calificacion: number | string
  totalReviews: number
  pedidos: number
  gmv: number
  comision: number
}

// Centro por defecto: Quibdó, Chocó — origen del proyecto.
const CENTRO_DEFECTO: [number, number] = [5.6947, -76.6584]

function AjustarVista({ comercios }: { comercios: ComercioMapaAdmin[] }) {
  const map = useMap()
  useEffect(() => {
    const puntos: [number, number][] = comercios.map(c => [c.latitud, c.longitud])
    if (puntos.length === 0) return
    if (puntos.length === 1) { map.setView(puntos[0], 12); return }
    map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 12 })
  }, [comercios, map])
  return null
}

/** Radio del círculo proporcional al GMV, con piso/techo para que no se vea invisible ni gigante. */
function radioPorGmv(gmv: number, gmvMax: number) {
  if (gmvMax <= 0) return 8
  const proporcion = Math.sqrt(gmv / gmvMax)
  return Math.max(6, Math.min(28, 6 + proporcion * 22))
}

export default function MapaAnaliticaTerritorial({ comercios }: { comercios: ComercioMapaAdmin[] }) {
  const gmvMax = comercios.reduce((max, c) => Math.max(max, c.gmv), 0)
  const centro: [number, number] = comercios.length > 0
    ? [comercios[0].latitud, comercios[0].longitud]
    : CENTRO_DEFECTO

  return (
    <div className="rounded-2xl overflow-hidden border border-[#1A1A1A]/10 shadow-sm h-[420px]">
      <MapContainer center={centro} zoom={7} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <AjustarVista comercios={comercios} />

        {comercios.map(c => (
          <CircleMarker
            key={c.id}
            center={[c.latitud, c.longitud]}
            radius={radioPorGmv(c.gmv, gmvMax)}
            pathOptions={{
              color: '#1B4332',
              weight: 1.5,
              fillColor: c.gmv > 0 ? '#2D6A4F' : '#999',
              fillOpacity: 0.55,
            }}
          >
            <Popup minWidth={200}>
              <div className="space-y-1">
                <strong className="text-sm block">{c.nombre}</strong>
                <p className="text-xs text-gray-500">📍 {c.municipio}{c.departamento ? `, ${c.departamento}` : ''}</p>
                <p className="text-xs text-gray-600">🛒 {c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''} en el periodo</p>
                <p className="text-xs text-gray-600">💰 GMV: <strong>{formatearPrecio(c.gmv)}</strong></p>
                <p className="text-xs text-gray-600">Comisión: {formatearPrecio(c.comision)}</p>
                {Number(c.totalReviews) > 0 && (
                  <p className="text-xs text-[#D4A017] font-semibold">★ {Number(c.calificacion).toFixed(1)} ({c.totalReviews})</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {comercios.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', padding: '12px 20px', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.15)', zIndex: 1000, textAlign: 'center', fontSize: 13, color: '#666' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🗺️</div>
            Ningún comercio tiene ubicación GPS registrada todavía
          </div>
        )}
      </MapContainer>
    </div>
  )
}
