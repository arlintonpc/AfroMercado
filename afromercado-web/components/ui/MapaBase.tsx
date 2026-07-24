'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix el icono por defecto de Leaflet que falla con webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

/** Icono genérico para la posición del usuario (no depende de ningún dominio). */
const iconoUsuario = new L.DivIcon({
  html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  className: '',
})

export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatearDistancia(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export const CLASE_CONTENEDOR_MAPA_DEFAULT =
  'rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-[50vh] min-h-[280px] max-h-[400px]'

export interface MarcadorMapaBase {
  id: number | string
  position: [number, number]
  icon: L.Icon | L.DivIcon
  popup: ReactNode
  popupMinWidth?: number
}

interface AjustarVistaProps {
  posiciones: [number, number][]
  userLat?: number | null
  userLon?: number | null
}

/** Centra el mapa y ajusta el zoom para mostrar todos los puntos (marcadores + usuario). */
function AjustarVista({ posiciones, userLat, userLon }: AjustarVistaProps) {
  const map = useMap()
  useEffect(() => {
    const puntos: [number, number][] = [...posiciones]
    if (userLat && userLon) puntos.push([userLat, userLon])
    if (puntos.length === 0) return
    if (puntos.length === 1) { map.setView(puntos[0], 13); return }
    map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 13 })
  }, [posiciones, userLat, userLon, map])
  return null
}

export interface MapaBaseProps {
  /** Marcadores ya filtrados a los que tienen coordenadas válidas. */
  marcadores: MarcadorMapaBase[]
  userLat?: number | null
  userLon?: number | null
  /** Centro a usar cuando no hay marcadores. */
  centroFallback: [number, number]
  /** Zoom inicial del MapContainer (antes de que AjustarVista corrija). */
  zoomInicial?: number
  /**
   * Estrategia para abrir automáticamente un popup 600ms después del montaje:
   * - 'individual': abre el único marcador cuando hay exactamente uno (ignora ubicación de usuario).
   * - 'cercania': abre el marcador más cercano a userLat/userLon (solo si hay ubicación de usuario).
   * - undefined: no abre ningún popup automáticamente.
   */
  autoAbrir?: 'individual' | 'cercania'
  emptyEmoji: string
  emptyTexto: string
  claseContenedor?: string
  popupMinWidth?: number
}

/**
 * Base genérica para los mapas de solo-lectura de AfroMercado (cultura, express, hoteles,
 * transportes, tours). Absorbe el setup de Leaflet (fix de íconos, TileLayer de OSM), el
 * patrón de centrar/ajustar zoom sobre los marcadores, el marcador+círculo de "tu ubicación"
 * y el estado vacío. No conoce nada específico de un dominio: los marcadores y su contenido
 * de popup los arma el componente que lo usa.
 */
export default function MapaBase({
  marcadores,
  userLat = null,
  userLon = null,
  centroFallback,
  zoomInicial = 6,
  autoAbrir,
  emptyEmoji,
  emptyTexto,
  claseContenedor = CLASE_CONTENEDOR_MAPA_DEFAULT,
  popupMinWidth = 200,
}: MapaBaseProps) {
  const markerRefs = useRef<Record<string | number, L.Marker>>({})

  const centro: [number, number] = marcadores.length > 0 ? marcadores[0].position : centroFallback

  useEffect(() => {
    let idAAbrir: number | string | null = null

    if (autoAbrir === 'cercania' && userLat && userLon && marcadores.length > 0) {
      const masCercano = marcadores.reduce((prev, curr) => {
        const dPrev = distanciaKm(userLat, userLon, prev.position[0], prev.position[1])
        const dCurr = distanciaKm(userLat, userLon, curr.position[0], curr.position[1])
        return dCurr < dPrev ? curr : prev
      })
      idAAbrir = masCercano.id
    } else if (autoAbrir === 'individual' && marcadores.length === 1) {
      idAAbrir = marcadores[0].id
    }

    if (idAAbrir !== null) {
      const id = idAAbrir
      setTimeout(() => markerRefs.current[id]?.openPopup(), 600)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLat, userLon])

  return (
    <div className={claseContenedor}>
      <MapContainer
        center={userLat && userLon ? [userLat, userLon] : centro}
        zoom={zoomInicial}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AjustarVista posiciones={marcadores.map(m => m.position)} userLat={userLat} userLon={userLon} />

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
          </>
        )}

        {marcadores.map(m => (
          <Marker
            key={m.id}
            position={m.position}
            icon={m.icon}
            ref={ref => { if (ref) markerRefs.current[m.id] = ref }}
          >
            <Popup minWidth={m.popupMinWidth ?? popupMinWidth}>{m.popup}</Popup>
          </Marker>
        ))}

        {marcadores.length === 0 && (
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'white', padding: '12px 20px',
              borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.15)',
              zIndex: 1000, textAlign: 'center', fontSize: 13, color: '#666'
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>{emptyEmoji}</div>
            {emptyTexto}
          </div>
        )}
      </MapContainer>
    </div>
  )
}
