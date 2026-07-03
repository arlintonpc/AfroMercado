'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import type { ConfigTransporte } from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TIPO_ICONO: Record<string, string> = { LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶' }

function iconoTransporte(tipo: string) {
  return new L.DivIcon({
    html: `<div style="width:32px;height:32px;background:#023E8A;border:3px solid white;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px">${TIPO_ICONO[tipo] ?? '🛥️'}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34], className: '',
  })
}

const iconoUsuario = new L.DivIcon({
  html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9], className: '',
})

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function AjustarVista({ transportes, userLat, userLon }: { transportes: ConfigTransporte[]; userLat: number | null; userLon: number | null }) {
  const map = useMap()
  useEffect(() => {
    const puntos: [number, number][] = transportes
      .filter(t => t.comercio.latitud && t.comercio.longitud)
      .map(t => [t.comercio.latitud!, t.comercio.longitud!])
    if (userLat && userLon) puntos.push([userLat, userLon])
    if (puntos.length === 0) return
    if (puntos.length === 1) { map.setView(puntos[0], 13); return }
    map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 13 })
  }, [transportes, userLat, userLon, map])
  return null
}

export default function MapaTransportes({ transportes, userLat, userLon }: { transportes: ConfigTransporte[]; userLat: number | null; userLon: number | null }) {
  const conCoordenadas = transportes.filter(t => t.comercio.latitud && t.comercio.longitud)
  const markerRefs = useRef<Record<number, L.Marker>>({})

  const centro: [number, number] = conCoordenadas.length > 0
    ? [conCoordenadas[0].comercio.latitud!, conCoordenadas[0].comercio.longitud!]
    : [5.0, -76.6]

  useEffect(() => {
    if (!userLat || !userLon || conCoordenadas.length === 0) return
    const masC = conCoordenadas.reduce((prev, curr) => {
      const dP = distanciaKm(userLat, userLon, prev.comercio.latitud!, prev.comercio.longitud!)
      const dC = distanciaKm(userLat, userLon, curr.comercio.latitud!, curr.comercio.longitud!)
      return dC < dP ? curr : prev
    })
    setTimeout(() => markerRefs.current[masC.id]?.openPopup(), 600)
  }, [userLat, userLon])

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-[50vh] min-h-[280px] max-h-[400px]">
      <MapContainer center={userLat && userLon ? [userLat, userLon] : centro} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <AjustarVista transportes={transportes} userLat={userLat} userLon={userLon} />

        {userLat && userLon && (
          <>
            <Marker position={[userLat, userLon]} icon={iconoUsuario}><Popup><strong>Tu ubicación</strong></Popup></Marker>
            <Circle center={[userLat, userLon]} radius={500} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.08, weight: 1.5 }} />
          </>
        )}

        {conCoordenadas.map(t => {
          const lat = t.comercio.latitud!
          const lon = t.comercio.longitud!
          const dist = userLat && userLon ? distanciaKm(userLat, userLon, lat, lon) : null
          const rutas = t.rutas.filter(r => r.activo)
          const precioMin = rutas.length > 0 ? Math.min(...rutas.map(r => Number(r.precioAsiento))) : null

          return (
            <Marker key={t.id} position={[lat, lon]} icon={iconoTransporte(t.tipo)}
              ref={m => { if (m) markerRefs.current[t.id] = m }}
            >
              <Popup minWidth={200}>
                <div className="space-y-1.5">
                  <strong className="text-sm block">{t.nombre}</strong>
                  <p className="text-xs text-gray-500">📍 {t.comercio.municipio}</p>
                  <p className="text-xs text-gray-500">{TIPO_ICONO[t.tipo] ?? '🛥️'} {t.tipo}</p>
                  {dist !== null && <p className="text-xs font-medium text-blue-600">📏 {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}</p>}
                  {precioMin !== null && <p className="text-xs text-gray-600">Desde <strong>{formatearPrecio(precioMin)}</strong>/asiento</p>}
                  <Link href={`/transportes/${t.id}`} className="block mt-2 text-center text-xs font-bold bg-[#023E8A] text-white rounded-lg py-1.5 hover:bg-[#0077B6] transition-colors">
                    Ver servicio →
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {conCoordenadas.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', padding: '12px 20px', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.15)', zIndex: 1000, textAlign: 'center', fontSize: 13, color: '#666' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🛥️</div>
            Los servicios aún no tienen ubicación registrada
          </div>
        )}
      </MapContainer>
    </div>
  )
}
