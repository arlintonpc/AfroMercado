'use client'

import Link from 'next/link'
import { precioDesde, type EventoCultural } from '@/lib/api/cultura'
import BotonFavoritoCultura from './BotonFavoritoCultura'

function rangoFechas(inicio: string, fin?: string | null): string {
  const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const i = new Date(inicio).toLocaleDateString('es-CO', opt)
  if (!fin) return i
  const f = new Date(fin).toLocaleDateString('es-CO', opt)
  return i === f ? i : `${i} – ${f}`
}

function formatearPrecio(valor: number | null): string {
  if (valor == null) return 'Entrada libre'
  if (valor === 0) return 'Gratis'
  return `Desde $${valor.toLocaleString('es-CO')}`
}

interface TarjetaEventoCulturalProps {
  ev: EventoCultural
  esFavorito?: boolean
  onFavoritoChange?: (eventoId: number, esFavorito: boolean) => void
}

export default function TarjetaEventoCultural({ ev, esFavorito = false, onFavoritoChange }: TarjetaEventoCulturalProps) {
  const desde = precioDesde(ev)
  const imagen = ev.portadaUrl || ev.fotos?.[0] || ''
  
  const esAnuncio = (ev as any).esAnuncio
  const enlaceDestino = esAnuncio ? ((ev as any).anuncioUrl || '#') : `/cultura/${ev.id}`

  return (
    <Link
      href={enlaceDestino}
      target={esAnuncio ? "_blank" : undefined}
      className="group relative flex flex-col justify-end overflow-hidden rounded-[2rem] bg-gray-900 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl aspect-[3/4] sm:aspect-[4/5] w-full"
    >
      {/* Background Image / Video */}
      <div className="absolute inset-0 z-0">
        {imagen ? (
          imagen.endsWith('.mp4') ? (
            <video src={imagen} autoPlay loop muted playsInline className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105 group-hover:opacity-100" />
          ) : (
            <img src={imagen} alt={ev.titulo} className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105 group-hover:opacity-100" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1B4332] to-[#2D6A4F]">
            <span className="text-6xl opacity-30">🎭</span>
          </div>
        )}
        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
      </div>

      {/* Top Badges */}
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        {esAnuncio && (
           <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md border border-white/20">
             Promocionado
           </span>
        )}
        {ev.destacado && !esAnuncio && (
          <span className="rounded-full bg-[#D4A017] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#412402] shadow-sm">
            Destacado
          </span>
        )}
        {ev.patrimonio && (
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1B4332] shadow-sm">
            {ev.patrimonioNota || 'Patrimonio'}
          </span>
        )}
      </div>
      
      {/* Favorite Button */}
      {!esAnuncio && (
        <div className="absolute right-4 top-4 z-10">
          <BotonFavoritoCultura
            eventoId={Number(ev.id)}
            esFavorito={esFavorito}
            onChange={(nuevo) => onFavoritoChange?.(Number(ev.id), nuevo)}
          />
        </div>
      )}

      {/* Content Bottom Overlay */}
      <div className="relative z-10 p-5 pt-12">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white backdrop-blur-md border border-white/10">
            {ev.categoria || 'Cultural'}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#EAF3DE]">
            {esAnuncio ? 'Patrocinado' : rangoFechas(ev.fechaInicio, ev.fechaFin)}
          </span>
        </div>
        
        <h3 className="mb-1 font-serif text-2xl leading-tight text-white drop-shadow-md transition-colors group-hover:text-[#D4A017]">
          {ev.titulo}
        </h3>
        
        <p className="mb-4 text-sm font-medium text-white/80 drop-shadow">
          📍 {ev.municipio}, {ev.departamento}
        </p>
        
        <div className="flex items-center justify-between border-t border-white/20 pt-3">
          <span className="text-lg font-black text-white drop-shadow-md">
            {esAnuncio ? 'Conocer más' : formatearPrecio(desde)}
          </span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-all group-hover:bg-[#D4A017] group-hover:text-black">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
      </div>
    </Link>
  )
}
