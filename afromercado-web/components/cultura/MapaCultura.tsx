'use client'

import L from 'leaflet'
import Link from 'next/link'
import type { EventoCultural } from '@/lib/api/cultura'
import MapaBase, { type MarcadorMapaBase } from '@/components/ui/MapaBase'

const iconoCultura = new L.DivIcon({
  html: `<div style="width:32px;height:32px;background:#1B4332;border:3px solid white;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px">🎭</div>`,
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34], className: '',
})

/**
 * Mapa de solo-lectura para eventos culturales. Acepta un array de eventos: úsalo con muchos
 * eventos (vista de mapa de la agenda) o con un solo elemento (detalle de evento). Los eventos
 * sin `latitud`/`longitud` se excluyen. Wrapper delgado sobre `components/ui/MapaBase`.
 */
export default function MapaCultura({ eventos }: { eventos: EventoCultural[] }) {
  const conCoordenadas = eventos.filter(ev => ev.latitud && ev.longitud)

  const marcadores: MarcadorMapaBase[] = conCoordenadas.map(ev => {
    const imagen = ev.portadaUrl || ev.fotos?.[0] || ''
    const fecha = new Date(ev.fechaInicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

    return {
      id: ev.id,
      position: [ev.latitud!, ev.longitud!],
      icon: iconoCultura,
      popup: (
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
      ),
    }
  })

  return (
    <MapaBase
      marcadores={marcadores}
      centroFallback={[5.0, -76.6]}
      zoomInicial={conCoordenadas.length === 1 ? 13 : 6}
      autoAbrir="individual"
      emptyEmoji="🎭"
      emptyTexto="Los eventos aún no tienen ubicación registrada"
    />
  )
}
