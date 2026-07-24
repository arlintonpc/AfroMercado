'use client'

import L from 'leaflet'
import Link from 'next/link'
import type { ConfigTransporte } from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'
import MapaBase, { distanciaKm, formatearDistancia, type MarcadorMapaBase } from '@/components/ui/MapaBase'

const TIPO_ICONO: Record<string, string> = { LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶' }

function iconoTransporte(tipo: string) {
  return new L.DivIcon({
    html: `<div style="width:32px;height:32px;background:#023E8A;border:3px solid white;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px">${TIPO_ICONO[tipo] ?? '🛥️'}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34], className: '',
  })
}

export default function MapaTransportes({ transportes, userLat, userLon }: { transportes: ConfigTransporte[]; userLat: number | null; userLon: number | null }) {
  const conCoordenadas = transportes.filter(t => t.comercio.latitud && t.comercio.longitud)

  const marcadores: MarcadorMapaBase[] = conCoordenadas.map(t => {
    const lat = t.comercio.latitud!
    const lon = t.comercio.longitud!
    const dist = userLat && userLon ? distanciaKm(userLat, userLon, lat, lon) : null
    const rutas = t.rutas.filter(r => r.activo)
    const precioMin = rutas.length > 0 ? Math.min(...rutas.map(r => Number(r.precioAsiento))) : null

    return {
      id: t.id,
      position: [lat, lon],
      icon: iconoTransporte(t.tipo),
      popup: (
        <div className="space-y-1.5">
          <strong className="text-sm block">{t.nombre}</strong>
          <p className="text-xs text-gray-500">📍 {t.comercio.municipio}</p>
          <p className="text-xs text-gray-500">{TIPO_ICONO[t.tipo] ?? '🛥️'} {t.tipo}</p>
          {dist !== null && <p className="text-xs font-medium text-blue-600">📏 {formatearDistancia(dist)}</p>}
          {precioMin !== null && <p className="text-xs text-gray-600">Desde <strong>{formatearPrecio(precioMin)}</strong>/asiento</p>}
          <Link href={`/transportes/${t.id}`} className="block mt-2 text-center text-xs font-bold bg-[#023E8A] text-white rounded-lg py-1.5 hover:bg-[#0077B6] transition-colors">
            Ver servicio →
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
      emptyEmoji="🛥️"
      emptyTexto="Los servicios aún no tienen ubicación registrada"
    />
  )
}
