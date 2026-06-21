'use client'

import { useEffect, useState } from 'react'
import { calcularEnvio, listarTarifas } from '@/lib/api/envios'
import { formatearPrecio } from '@/lib/formatearPrecio'

/**
 * Estimador de envío: el comprador elige su departamento y ve cuánto costaría
 * el envío de este producto. Reusa el cálculo real del backend. El valor final
 * se confirma en el checkout.
 */
export default function EstimadorEnvio({ pesoKg }: { pesoKg?: number | null }) {
  const peso = pesoKg && pesoKg > 0 ? pesoKg : 1
  const [departamentos, setDepartamentos] = useState<string[]>([])
  const [depto, setDepto] = useState('')
  const [costo, setCosto] = useState<number | null>(null)
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'ok' | 'nodisp'>('idle')

  useEffect(() => {
    listarTarifas()
      .then((grupos) => {
        const deps = Object.keys(grupos)
          .filter((d) => d.toLowerCase() !== 'nacional')
          .sort((a, b) => a.localeCompare(b, 'es'))
        setDepartamentos(deps)
      })
      .catch(() => {})
  }, [])

  async function calcular(d: string) {
    setDepto(d)
    setCosto(null)
    if (!d) {
      setEstado('idle')
      return
    }
    setEstado('cargando')
    try {
      const r = await calcularEnvio(d, peso)
      setCosto(r.precio)
      setEstado('ok')
    } catch {
      setEstado('nodisp')
    }
  }

  return (
    <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A]">
        <span aria-hidden>🚚</span> Calcula tu envío
      </p>
      <select
        value={depto}
        onChange={(e) => calcular(e.target.value)}
        aria-label="Departamento de entrega"
        className="w-full rounded-xl border border-[#1A1A1A]/15 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
      >
        <option value="">Elige tu departamento…</option>
        {departamentos.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      {estado === 'cargando' && (
        <p className="mt-2 text-sm text-[#1A1A1A]/50">Calculando…</p>
      )}
      {estado === 'ok' && costo !== null && (
        <p className="mt-2 text-sm text-[#1A1A1A]/80">
          {costo === 0 ? (
            <span className="font-bold text-[#2D6A4F]">¡Envío gratis! 🎉</span>
          ) : (
            <>
              Envío a {depto}:{' '}
              <span className="font-bold text-[#2D6A4F]">{formatearPrecio(costo)}</span>
            </>
          )}
        </p>
      )}
      {estado === 'nodisp' && (
        <p className="mt-2 text-sm text-[#1A1A1A]/55">
          El envío a este destino se coordina al finalizar la compra.
        </p>
      )}

      <p className="mt-1.5 text-[11px] text-[#1A1A1A]/40">
        Estimado según el peso del producto. El valor final se confirma en el checkout.
      </p>
    </div>
  )
}
