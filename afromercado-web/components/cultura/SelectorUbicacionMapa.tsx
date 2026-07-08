'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const iconoEvento = new L.DivIcon({
  html: `<div style="width:32px;height:32px;background:#D4A017;border:3px solid white;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px">🎭</div>`,
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34], className: '',
})

const CENTRO_DEFECTO: [number, number] = [5.0, -76.6]

function CapturarClic({ onClic }: { onClic: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onClic(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function AjustarVista({ posicion }: { posicion: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (posicion) map.setView(posicion, 14)
  }, [posicion, map])
  return null
}

interface Props {
  latitud: number | null
  longitud: number | null
  onCambiar: (lat: number, lon: number) => void
}

export default function SelectorUbicacionMapa({ latitud, longitud, onCambiar }: Props) {
  const posicion: [number, number] | null = latitud != null && longitud != null ? [latitud, longitud] : null
  // Solo recentra el mapa en el montaje inicial (modo edición) o tras usar geolocalización;
  // un clic para mover el marcador no debe "saltar" la vista del usuario.
  const [foco, setFoco] = useState<[number, number] | null>(posicion)

  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setErrorUbicacion('Tu navegador no permite obtener la ubicación.')
      return
    }
    setErrorUbicacion(null)
    setBuscandoUbicacion(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nuevo: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        onCambiar(nuevo[0], nuevo[1])
        setFoco(nuevo)
        setBuscandoUbicacion(false)
      },
      () => {
        setErrorUbicacion('No pudimos obtener tu ubicación. Revisa los permisos del navegador o marca el punto en el mapa.')
        setBuscandoUbicacion(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#1A1A1A]/60">Toca el mapa para marcar dónde es el evento.</p>
        <button
          type="button"
          onClick={usarMiUbicacion}
          disabled={buscandoUbicacion}
          className="rounded-full border border-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-[#2D6A4F] hover:bg-[#2D6A4F]/10 disabled:opacity-60"
        >
          {buscandoUbicacion ? 'Ubicando…' : '📍 Usar mi ubicación actual'}
        </button>
      </div>
      {errorUbicacion && <p role="alert" className="text-xs text-[#C0392B]">{errorUbicacion}</p>}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-[40vh] min-h-[240px] max-h-[360px]">
        <MapContainer center={posicion ?? CENTRO_DEFECTO} zoom={posicion ? 14 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CapturarClic onClic={onCambiar} />
          <AjustarVista posicion={foco} />
          {posicion && <Marker position={posicion} icon={iconoEvento} />}
        </MapContainer>
      </div>
      {posicion && (
        <p className="text-xs text-[#1A1A1A]/45">
          Ubicación marcada: {posicion[0].toFixed(5)}, {posicion[1].toFixed(5)}
        </p>
      )}
    </div>
  )
}
