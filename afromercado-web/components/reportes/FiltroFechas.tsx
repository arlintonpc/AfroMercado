'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Preset = 'hoy' | '7dias' | 'mes' | 'mesPasado' | 'anio'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'hoy',       label: 'Hoy' },
  { id: '7dias',     label: '7 días' },
  { id: 'mes',       label: 'Este mes' },
  { id: 'mesPasado', label: 'Mes pasado' },
  { id: 'anio',      label: 'Este año' },
]

function iso(d: Date) { return d.toISOString().slice(0, 10) }

function rangoPreset(preset: Preset): { desde: string; hasta: string } {
  const hoy  = new Date()
  const ini  = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  switch (preset) {
    case 'hoy':       return { desde: iso(hoy), hasta: iso(hoy) }
    case '7dias':     return { desde: iso(new Date(Date.now() - 6 * 864e5)), hasta: iso(hoy) }
    case 'mes':       return { desde: iso(ini), hasta: iso(hoy) }
    case 'mesPasado': {
      const i = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      const f = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      return { desde: iso(i), hasta: iso(f) }
    }
    case 'anio':      return { desde: iso(new Date(hoy.getFullYear(), 0, 1)), hasta: iso(hoy) }
  }
}

/** Preset activo detectado por comparación de fechas. */
function detectarPreset(desde: string, hasta: string): Preset | null {
  for (const p of PRESETS) {
    const r = rangoPreset(p.id)
    if (r.desde === desde && r.hasta === hasta) return p.id
  }
  return null
}

interface FiltroFechasProps {
  /** Permite pasar también la variante "mes" como activa por defecto */
  defaultPreset?: Preset
}

export default function FiltroFechas({ defaultPreset = 'mes' }: FiltroFechasProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const defRango = rangoPreset(defaultPreset)
  const desde = params.get('desde') ?? defRango.desde
  const hasta = params.get('hasta') ?? defRango.hasta
  const presetActivo = detectarPreset(desde, hasta)

  function aplicar(next: { desde: string; hasta: string }) {
    const sp = new URLSearchParams(params.toString())
    sp.set('desde', next.desde)
    sp.set('hasta', next.hasta)
    router.replace(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => aplicar(rangoPreset(p.id))}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            presetActivo === p.id
              ? 'border-[#2D6A4F] bg-[#52B788]/15 text-[#2D6A4F]'
              : 'border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/60 hover:bg-[#52B788]/10 hover:text-[#2D6A4F]'
          }`}
        >
          {p.label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-[#1A1A1A]/15" />
      <input
        type="date"
        value={desde}
        onChange={(e) => aplicar({ desde: e.target.value, hasta })}
        className="rounded-lg border border-[#1A1A1A]/10 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
      />
      <span className="text-xs text-[#1A1A1A]/40">→</span>
      <input
        type="date"
        value={hasta}
        onChange={(e) => aplicar({ desde, hasta: e.target.value })}
        className="rounded-lg border border-[#1A1A1A]/10 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
      />
    </div>
  )
}
