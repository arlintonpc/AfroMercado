'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { listarTarifas, type TarifaEnvio } from '@/lib/api/envios'

function formatearPrecio(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export default function PaginaEnvios() {
  const [tarifas, setTarifas] = useState<Record<string, TarifaEnvio[]>>({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    listarTarifas()
      .then(setTarifas)
      .finally(() => setCargando(false))
  }, [])

  const departamentos = Object.keys(tarifas).sort((a, b) =>
    a === 'Nacional' ? 1 : b === 'Nacional' ? -1 : a.localeCompare(b)
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-10">
        <div className="mb-8">
          <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-1">Logística</p>
          <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Costos de envío
          </h1>
          <p className="text-sm text-[#1A1A1A]/55 mt-2 max-w-xl">
            Enviamos tu pedido a cualquier parte de Colombia. Los costos dependen del departamento de destino y el peso del pedido.
          </p>
        </div>

        {cargando ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#1A1A1A]/8 h-32 animate-pulse" />
            ))}
          </div>
        ) : departamentos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-8 text-center text-[#1A1A1A]/40">
            No hay tarifas disponibles en este momento.
          </div>
        ) : (
          <div className="space-y-4">
            {departamentos.map((dep) => (
              <div key={dep} className="bg-white rounded-2xl border border-[#1A1A1A]/8 overflow-hidden">
                <div className="px-5 py-3 bg-[#2D6A4F]/5 border-b border-[#1A1A1A]/8 flex items-center gap-2">
                  <span className="text-sm font-bold text-[#2D6A4F]">📍 {dep}</span>
                  {dep === 'Nacional' && (
                    <span className="text-xs text-[#1A1A1A]/40 font-normal">— Resto del país</span>
                  )}
                </div>
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-[#F8F5F0]/60">
                      <th className="px-5 py-2 text-left text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide">Peso máximo</th>
                      <th className="px-5 py-2 text-right text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide">Costo de envío</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {tarifas[dep].map((t) => (
                      <tr key={t.id} className="hover:bg-[#2D6A4F]/3 transition-colors">
                        <td className="px-5 py-3 text-sm text-[#1A1A1A]">
                          Hasta {t.pesoMaxKg % 1 === 0 ? t.pesoMaxKg.toFixed(0) : t.pesoMaxKg} kg
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-[#1A1A1A] text-right">
                          {formatearPrecio(t.precio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-[#D4A017]/10 border border-[#D4A017]/20 rounded-2xl">
          <p className="text-sm text-[#1A1A1A]/70">
            <span className="font-semibold text-[#9B7300]">Nota: </span>
            Los costos son referenciales. Cada comerciante coordina el envío directamente con el comprador.
            Para pedidos con productos de varios comercios, el costo de envío puede variar por comercio.
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm font-semibold text-[#2D6A4F] hover:underline">
            ← Explorar productos
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
