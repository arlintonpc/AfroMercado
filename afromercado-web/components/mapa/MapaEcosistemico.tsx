'use client'

import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { Search, Navigation, MapPin } from 'lucide-react'

// Fix default marker icon issues in Leaflet with Next.js
const iconoCustom = (emoji: string, colorBg: string) =>
  L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="background-color: ${colorBg}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s;" class="hover:scale-110">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  })

const iconoUsuarioGPS = L.divIcon({
  className: 'custom-gps-user-pin',
  html: `<div style="background-color: #0077B6; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 0 15px rgba(0,119,182,0.8);" class="animate-bounce">📍</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -19],
})

export interface ItemMapa {
  id: string
  tipo: 'HOTEL' | 'EXPRESS' | 'TOUR' | 'TRANSPORTE' | 'BIENES_RAICES'
  titulo: string
  categoriaLabel: string
  municipio: string
  departamento?: string
  lat: number
  lng: number
  precio?: number
  precioSubtexto?: string
  fotoUrl?: string
  calificacion?: number
  linkUrl: string
}

const ITEMS_DEMO_ECOSISTEMA: ItemMapa[] = [
  {
    id: 'h1',
    tipo: 'HOTEL',
    titulo: 'Cabañas Río Atrato',
    categoriaLabel: 'Cabaña Ecológica',
    municipio: 'Quibdó',
    lat: 5.6923,
    lng: -76.6582,
    precio: 120000,
    precioSubtexto: '/noche',
    fotoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
    calificacion: 4.8,
    linkUrl: '/hoteles',
  },
  {
    id: 'h2',
    tipo: 'HOTEL',
    titulo: 'Resort Selva y Mar',
    categoriaLabel: 'Resort Ecológico',
    municipio: 'Capurganá',
    lat: 8.6385,
    lng: -77.3481,
    precio: 320000,
    precioSubtexto: '/noche',
    fotoUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    calificacion: 4.9,
    linkUrl: '/hoteles',
  },
  {
    id: 'e1',
    tipo: 'EXPRESS',
    titulo: 'Pescado y Patacón Tradicional',
    categoriaLabel: 'Restaurante Típico',
    municipio: 'Quibdó',
    lat: 5.698,
    lng: -76.654,
    precio: 25000,
    precioSubtexto: 'plato fuerte',
    fotoUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
    calificacion: 5.0,
    linkUrl: '/express',
  },
  {
    id: 't1',
    tipo: 'TOUR',
    titulo: 'Río Quito en Canoa Tradicional',
    categoriaLabel: 'Ecoturismo Fluvial',
    municipio: 'Tadó',
    lat: 5.4385,
    lng: -76.5592,
    precio: 85000,
    precioSubtexto: '/persona',
    fotoUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
    calificacion: 4.9,
    linkUrl: '/tours',
  },
  {
    id: 'tr1',
    tipo: 'TRANSPORTE',
    titulo: 'Ruta Fluvial Lancha Rápida Quibdó - Bellavista',
    categoriaLabel: 'Lancha Rápida',
    municipio: 'Quibdó',
    lat: 5.688,
    lng: -76.662,
    precio: 45000,
    precioSubtexto: 'pasaje',
    fotoUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=600&q=80',
    calificacion: 4.7,
    linkUrl: '/transportes',
  },
  {
    id: 'b1',
    tipo: 'BIENES_RAICES',
    titulo: 'Finca Agroforestal en Tadó',
    categoriaLabel: 'Finca',
    municipio: 'Tadó',
    lat: 5.421,
    lng: -76.549,
    precio: 220000000,
    precioSubtexto: 'venta',
    fotoUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80',
    linkUrl: '/bienes-raices',
  }
]

function CentrarMapa({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom || 11, { duration: 1.5 })
  }, [lat, lng, zoom, map])
  return null
}

export default function MapaEcosistemico() {
  const [capasActivas, setCapasActivas] = useState<Record<string, boolean>>({
    HOTEL: true,
    EXPRESS: true,
    TOUR: true,
    TRANSPORTE: true,
    BIENES_RAICES: true,
  })

  const [municipioFiltro, setMunicipioFiltro] = useState('TODOS')
  const [busquedaTexto, setBusquedaTexto] = useState('')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsCargando, setGpsCargando] = useState(false)
  const [centro, setCentro] = useState<{ lat: number; lng: number; zoom?: number }>({ lat: 5.6923, lng: -76.6582, zoom: 10 })

  function obtenerMiUbicacion() {
    if (!navigator.geolocation) {
      alert('Geolocalización no soportada por el navegador.')
      return
    }
    setGpsCargando(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserPos(coords)
        setCentro({ ...coords, zoom: 12 })
        setGpsCargando(false)
      },
      () => {
        setGpsCargando(false)
        alert('No pudimos acceder a tu ubicación actual. Revisa los permisos de GPS.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const itemsFiltrados = useMemo(() => {
    return ITEMS_DEMO_ECOSISTEMA.filter(item => {
      if (!capasActivas[item.tipo]) return false
      if (municipioFiltro !== 'TODOS' && item.municipio.toUpperCase() !== municipioFiltro.toUpperCase()) return false
      if (busquedaTexto.trim()) {
        const q = busquedaTexto.toLowerCase()
        const matchTitulo = item.titulo.toLowerCase().includes(q)
        const matchCat = item.categoriaLabel.toLowerCase().includes(q)
        const matchMuni = item.municipio.toLowerCase().includes(q)
        if (!matchTitulo && !matchCat && !matchMuni) return false
      }
      return true
    })
  }, [capasActivas, municipioFiltro, busquedaTexto])

  function toggleCapa(tipo: string) {
    setCapasActivas(prev => ({ ...prev, [tipo]: !prev[tipo] }))
  }

  function obtenerColorYIcono(tipo: string) {
    switch (tipo) {
      case 'HOTEL':
        return { emoji: '🏨', color: '#D4A017' }
      case 'EXPRESS':
        return { emoji: '🍲', color: '#2D6A4F' }
      case 'TOUR':
        return { emoji: '🌴', color: '#52B788' }
      case 'TRANSPORTE':
        return { emoji: '🚤', color: '#023E8A' }
      case 'BIENES_RAICES':
        return { emoji: '🏘️', color: '#1B4332' }
      default:
        return { emoji: '📍', color: '#1B4332' }
    }
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Controles de Capas, Búsqueda y GPS */}
      <div className="bg-white dark:bg-[#1A241F] p-4 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm flex flex-col gap-4 transition-colors">
        
        {/* Fila 1: Buscador en vivo + Botón Cerca de Mí */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={busquedaTexto}
              onChange={e => setBusquedaTexto(e.target.value)}
              placeholder="Buscar en el mapa (hotel, restaurante, tour, transporte, predio)..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
          </div>

          <button
            onClick={obtenerMiUbicacion}
            disabled={gpsCargando}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1B4332] dark:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl hover:bg-[#2D6A4F] transition-all shadow-md whitespace-nowrap"
          >
            {gpsCargando ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            <span>{userPos ? '📍 Mi Ubicación GPS' : 'Centrar cerca de mí'}</span>
          </button>
        </div>

        {/* Fila 2: Toggles de Capas y Municipio */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">
              Capas:
            </span>
            {[
              { key: 'HOTEL', label: 'Hoteles', emoji: '🏨' },
              { key: 'EXPRESS', label: 'Sabores', emoji: '🍲' },
              { key: 'TOUR', label: 'Tours', emoji: '🌴' },
              { key: 'TRANSPORTE', label: 'Transporte', emoji: '🚤' },
              { key: 'BIENES_RAICES', label: 'Predios', emoji: '🏘️' },
            ].map(c => {
              const activa = capasActivas[c.key]
              return (
                <button
                  key={c.key}
                  onClick={() => toggleCapa(c.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    activa
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm'
                      : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300'
                  }`}
                >
                  <span>{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Municipio:
            </span>
            <select
              value={municipioFiltro}
              onChange={e => {
                setMunicipioFiltro(e.target.value)
                if (e.target.value === 'QUIBDÓ') setCentro({ lat: 5.6923, lng: -76.6582, zoom: 11 })
                if (e.target.value === 'CAPURGANÁ') setCentro({ lat: 8.6385, lng: -77.3481, zoom: 11 })
                if (e.target.value === 'TADÓ') setCentro({ lat: 5.4385, lng: -76.5592, zoom: 11 })
              }}
              className="px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:outline-none"
            >
              <option value="TODOS">Todos los municipios</option>
              <option value="QUIBDÓ">Quibdó</option>
              <option value="CAPURGANÁ">Capurganá</option>
              <option value="TADÓ">Tadó</option>
            </select>
          </div>
        </div>

      </div>

      {/* Contenedor del Mapa Leaflet */}
      <div className="relative w-full h-[580px] rounded-3xl overflow-hidden shadow-xl border border-gray-200 dark:border-white/10">
        <MapContainer
          center={[centro.lat, centro.lng]}
          zoom={centro.zoom || 10}
          scrollWheelZoom={false}
          className="w-full h-full z-10"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <CentrarMapa lat={centro.lat} lng={centro.lng} zoom={centro.zoom} />

          {/* Marcador posición GPS usuario */}
          {userPos && (
            <Marker position={[userPos.lat, userPos.lng]} icon={iconoUsuarioGPS}>
              <Popup>
                <div className="p-1 font-bold text-xs text-gray-900">
                  📍 Tu ubicación actual (GPS)
                </div>
              </Popup>
            </Marker>
          )}

          {itemsFiltrados.map(item => {
            const { emoji, color } = obtenerColorYIcono(item.tipo)
            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`

            return (
              <Marker
                key={item.id}
                position={[item.lat, item.lng]}
                icon={iconoCustom(emoji, color)}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="p-1 min-w-[210px]">
                    {item.fotoUrl && (
                      <img
                        src={item.fotoUrl}
                        alt={item.titulo}
                        className="w-full h-28 object-cover rounded-xl mb-2"
                      />
                    )}
                    <span className="text-[10px] font-bold text-[#2D6A4F] uppercase tracking-wider">
                      {emoji} {item.categoriaLabel}
                    </span>
                    <h4 className="text-sm font-bold text-gray-900 leading-tight mt-0.5">
                      {item.titulo}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">📍 {item.municipio}</p>

                    {item.precio && (
                      <p className="text-sm font-black text-[#1B4332] mt-1.5">
                        {formatearPrecio(item.precio)}
                        {item.precioSubtexto && <span className="text-[10px] text-gray-500 font-normal"> {item.precioSubtexto}</span>}
                      </p>
                    )}

                    <div className="mt-3 flex flex-col gap-2">
                      <Link
                        href={item.linkUrl}
                        className="w-full bg-[#1B4332] text-white text-xs font-bold py-2 px-3 rounded-xl block text-center hover:bg-[#2D6A4F] transition-colors shadow-sm"
                      >
                        Ver Detalle en Teravia
                      </Link>

                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-[#D4A017] text-[#1A1A1A] text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#b88a14] transition-colors shadow-sm"
                      >
                        <MapPin size={14} className="text-[#1A1A1A]" />
                        <span>Cómo llegar en Google Maps</span>
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
