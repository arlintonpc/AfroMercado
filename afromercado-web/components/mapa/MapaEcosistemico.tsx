'use client'

import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { formatearPrecio } from '@/lib/formatearPrecio'

// Fix default marker icon issues in Leaflet with Next.js
const iconoCustom = (emoji: string, colorBg: string) =>
  L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="background-color: ${colorBg}; width: 36px; height: 36px; rounded-full; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s;" class="hover:scale-110">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
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

function CentrarMapa({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 11, { duration: 1.5 })
  }, [lat, lng, map])
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
  const [centro, setCentro] = useState<{ lat: number; lng: number }>({ lat: 5.6923, lng: -76.6582 })

  const itemsFiltrados = useMemo(() => {
    return ITEMS_DEMO_ECOSISTEMA.filter(item => {
      if (!capasActivas[item.tipo]) return false
      if (municipioFiltro !== 'TODOS' && item.municipio.toUpperCase() !== municipioFiltro.toUpperCase()) return false
      return true
    })
  }, [capasActivas, municipioFiltro])

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
      {/* Controles de Capas y Municipios */}
      <div className="bg-white dark:bg-[#1A241F] p-4 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        {/* Toggles de Capas */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">
            Capas:
          </span>
          {[
            { key: 'HOTEL', label: 'Hoteles', emoji: '🏨', color: '#D4A017' },
            { key: 'EXPRESS', label: 'Sabores', emoji: '🍲', color: '#2D6A4F' },
            { key: 'TOUR', label: 'Tours', emoji: '🌴', color: '#52B788' },
            { key: 'TRANSPORTE', label: 'Transporte', emoji: '🚤', color: '#023E8A' },
            { key: 'BIENES_RAICES', label: 'Predios', emoji: '🏘️', color: '#1B4332' },
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

        {/* Filtro por Municipio */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Municipio:
          </span>
          <select
            value={municipioFiltro}
            onChange={e => {
              setMunicipioFiltro(e.target.value)
              if (e.target.value === 'QUIBDÓ') setCentro({ lat: 5.6923, lng: -76.6582 })
              if (e.target.value === 'CAPURGANÁ') setCentro({ lat: 8.6385, lng: -77.3481 })
              if (e.target.value === 'TADÓ') setCentro({ lat: 5.4385, lng: -76.5592 })
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

      {/* Contenedor del Mapa Leaflet */}
      <div className="relative w-full h-[550px] rounded-3xl overflow-hidden shadow-xl border border-gray-200 dark:border-white/10">
        <MapContainer
          center={[centro.lat, centro.lng]}
          zoom={10}
          scrollWheelZoom={false}
          className="w-full h-full z-10"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <CentrarMapa lat={centro.lat} lng={centro.lng} />

          {itemsFiltrados.map(item => {
            const { emoji, color } = obtenerColorYIcono(item.tipo)
            return (
              <Marker
                key={item.id}
                position={[item.lat, item.lng]}
                icon={iconoCustom(emoji, color)}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="p-1 min-w-[200px]">
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

                    <Link
                      href={item.linkUrl}
                      className="mt-2.5 w-full bg-[#1B4332] text-white text-xs font-bold py-1.5 px-3 rounded-lg block text-center hover:bg-[#2D6A4F] transition-colors"
                    >
                      Ver Detalle
                    </Link>
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
