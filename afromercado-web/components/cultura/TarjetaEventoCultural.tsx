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

  return (
    <Link
      href={`/cultura/${ev.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#1A1A1A]/8 bg-white/95 transition duration-200 hover:-translate-y-0.5 hover:border-[#2D6A4F]/30 hover:shadow-[0_16px_40px_rgba(26,26,26,0.08)]"
    >
      <div className="relative h-44 overflow-hidden bg-[#1B4332] text-white">
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt={ev.titulo} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(212,160,23,0.18),_transparent_62%),linear-gradient(135deg,_#1B4332,_#2D6A4F)] text-5xl" aria-hidden="true">
            🎭
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgba(18,33,25,0.78)_100%)]" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {ev.destacado && (
            <span className="rounded-full bg-[#D4A017] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#412402] shadow-sm">
              Destacado
            </span>
          )}
          {ev.patrimonio && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#1B4332] shadow-sm">
              {ev.patrimonioNota || 'Patrimonio'}
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <BotonFavoritoCultura
            eventoId={ev.id}
            esFavorito={esFavorito}
            onChange={(nuevo) => onFavoritoChange?.(ev.id, nuevo)}
          />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#EAF3DE]">{rangoFechas(ev.fechaInicio, ev.fechaFin)}</p>
            <p className="mt-1 text-sm text-white/80">
              {ev.municipio}, {ev.departamento}
            </p>
          </div>
          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#1B4332] shadow-sm">
            {ev.categoria || 'Cultural'}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-serif text-xl leading-tight text-[#1B4332] transition group-hover:text-[#2D6A4F]">{ev.titulo}</h3>
          {ev.descripcion && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#1A1A1A]/65">{ev.descripcion}</p>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[#1B4332]">{formatearPrecio(desde)}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F8F5F0] px-3 py-1 text-xs font-semibold text-[#1A1A1A]/55 transition group-hover:bg-[#EAF3DE] group-hover:text-[#1B4332]">
            Ver detalle
            <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
