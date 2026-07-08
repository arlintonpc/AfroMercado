'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import type { EventoCultural } from '@/lib/api/cultura'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const iconoCultura = new L.DivIcon({
  html: `<div style="width:32px;height:32px;background:#1B4332;border:3px solid white;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px">🎭</div>`,
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34], className: '',
})

function AjustarVista({ eventos }: { eventos: EventoCultural[] }) {
  const map = useMap()
  useEffect(() => {
    const puntos: [number, number][] = eventos
      .filter(ev => ev.latitud && ev.longitud)
      .map(ev => [ev.latitud!, ev.longitud!])
    if (puntos.length === 0) return
    if (puntos.length === 1) { map.setView(puntos[0], 13); return }
    map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 13 })
  }, [eventos, map])
  return null
}

/**
 * Mapa de solo-lectura para eventos culturales (clon de `components/tours/MapaTours.tsx`).
 * Acepta un array de eventos: úsalo con muchos eventos (vista de mapa de la agenda) o con
 * un solo elemento (detalle de evento). Los eventos sin `latitud`/`longitud` se excluyen.
 */
export default function MapaCultura({ eventos }: { eventos: EventoCultural[] }) {
  const conCoordenadas = eventos.filter(ev => ev.latitud && ev.longitud)
  const markerRefs = useRef<Record<number, L.Marker>>({})

  const centro: [number, number] = conCoordenadas.length > 0
    ? [conCoordenadas[0].latitud!, conCoordenadas[0].longitud!]
    : [5.0, -76.6]

  useEffect(() => {
    if (conCoordenadas.length === 1) {
      setTimeout(() => markerRefs.current[conCoordenadas[0].id]?.openPopup(), 600)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-[50vh] min-h-[280px] max-h-[400px]">
      <MapContainer center={centro} zoom={conCoordenadas.length === 1 ? 13 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <AjustarVista eventos={eventos} />

        {conCoordenadas.map(ev => {
          const lat = ev.latitud!
          const lon = ev.longitud!
          const imagen = ev.portadaUrl || ev.fotos?.[0] || ''
          const fecha = new Date(ev.fechaInicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

          return (
            <Marker key={ev.id} position={[lat, lon]} icon={iconoCultura}
              ref={m => { if (m) markerRefs.current[ev.id] = m }}
            >
              <Popup minWidth={200}>
                <div className="space-y-1.5">
                  {imagen && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagen} alt={ev.titulo} className="w-full h-20 object-cover rounded-md" />
                  )}
                  <strong className="text-sm block">{ev.titulo}</strong>
                  <p className="text-xs text-gray-500">📍 {ev.municipio}, {ev.departamento}</p>
                  <p className="text-xs text-gray-500">🗓️ {fecha}</p>
                  <Link href={`/cultura/${ev.id}`} className="block mt-2 text-center text-xs font-bold bg-[#2D6A4F] text-white rounded-lg py-1.5 hover:bg-[#40916C] transition-colors">
                    Ver evento →
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {conCoordenadas.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', padding: '12px 20px', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.15)', zIndex: 1000, textAlign: 'center', fontSize: 13, color: '#666' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🎭</div>
            Los eventos aún no tienen ubicación registrada
          </div>
        )}
      </MapContainer>
    </div>
  )
}
