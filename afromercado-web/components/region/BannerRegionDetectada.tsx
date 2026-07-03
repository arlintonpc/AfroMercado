'use client'

import { useRegion } from '@/context/RegionContext'
import { CENTROS_DEPARTAMENTOS } from '@/lib/data/departamentos-geo'

export default function BannerRegionDetectada() {
  const { sugerencia, confirmarSugerencia, descartarSugerencia } = useRegion()

  if (!sugerencia) return null

  const centro = CENTROS_DEPARTAMENTOS.find((c) => c.departamento === sugerencia)
  const etiqueta = centro ? `cerca de ${centro.ciudadReferencia} (${centro.departamento})` : `en ${sugerencia}`

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-[#1A1A1A]/10 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
    >
      <p className="text-sm text-[#1A1A1A]">
        <span aria-hidden="true">📍</span> Detectamos que estás {etiqueta} — ¿mostramos primero lo de tu región?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirmarSugerencia}
          className="rounded-full bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153627]"
        >
          Sí, usar esta región
        </button>
        <button
          type="button"
          onClick={descartarSugerencia}
          className="rounded-full border border-[#1A1A1A]/15 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
