'use client'

import { useEffect, useState } from 'react'
import { listarMisLiquidaciones, type Liquidacion } from '@/components/comerciante/api'

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function cop(v: number) {
  return `$${Number(v).toLocaleString('es-CO')} COP`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg
        className="animate-spin text-[#2D6A4F]"
        width="36"
        height="36"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export default function LiquidacionesPage() {
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarMisLiquidaciones()
      .then(setLiquidaciones)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar liquidaciones'))
      .finally(() => setCargando(false))
  }, [])

  const totalPagado = liquidaciones
    .filter((l) => l.estado === 'PAGADA')
    .reduce((acc, l) => acc + l.monto, 0)

  const totalPendiente = liquidaciones
    .filter((l) => l.estado === 'PENDIENTE')
    .reduce((acc, l) => acc + l.monto, 0)

  return (
    <div>
      <h1
        className="mb-6 text-2xl font-bold text-[#1A1A1A]"
        style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
      >
        Mis liquidaciones
      </h1>

      {/* Resumen */}
      {!cargando && !error && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#2D6A4F]/20 bg-[#52B788]/8 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2D6A4F]/70">
              Total pagado
            </p>
            <p className="mt-1 text-2xl font-bold text-[#2D6A4F]">{cop(totalPagado)}</p>
          </div>
          <div className="rounded-xl border border-[#D4A017]/20 bg-[#D4A017]/8 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#A07810]/80">
              Total pendiente
            </p>
            <p className="mt-1 text-2xl font-bold text-[#A07810]">{cop(totalPendiente)}</p>
          </div>
        </div>
      )}

      {/* Contenido */}
      {cargando ? (
        <Spinner />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : liquidaciones.length === 0 ? (
        <div className="rounded-xl border border-[#1A1A1A]/8 bg-white p-12 text-center">
          <p className="text-base text-[#1A1A1A]/60">
            Aún no tienes liquidaciones registradas.
          </p>
          <p className="mt-2 text-sm text-[#1A1A1A]/40">
            El equipo de Teravia procesará tu liquidación una vez acumulado el saldo mínimo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {liquidaciones.map((liq) => (
            <div
              key={liq.id}
              className="rounded-xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-[#1A1A1A]">
                    Liquidación #{liq.id}
                  </p>
                  <p className="mt-0.5 text-sm text-[#1A1A1A]/50">
                    {formatearFecha(liq.createdAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    liq.estado === 'PAGADA'
                      ? 'bg-[#2D6A4F]/15 text-[#2D6A4F]'
                      : liq.estado === 'CANCELADA'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-[#D4A017]/15 text-[#A07810]'
                  }`}
                >
                  {liq.estado === 'PAGADA' ? 'Pagada' : liq.estado === 'CANCELADA' ? 'Cancelada' : 'Pendiente'}
                </span>
              </div>

              <div className="space-y-1 border-t border-[#1A1A1A]/8 pt-3 text-sm">
                <p className="text-[#1A1A1A]/70">
                  <span className="font-medium text-[#1A1A1A]">Período: </span>
                  {formatearFecha(liq.periodoDesde)} — {formatearFecha(liq.periodoHasta)}
                </p>

                {liq.cuentaDestino && (
                  <p className="text-[#1A1A1A]/70">
                    <span className="font-medium text-[#1A1A1A]">Cuenta destino: </span>
                    {liq.cuentaDestino}
                  </p>
                )}

                {liq.pagadoAt && (
                  <p className="text-[#1A1A1A]/70">
                    <span className="font-medium text-[#1A1A1A]">Pagado el: </span>
                    {formatearFecha(liq.pagadoAt)}
                  </p>
                )}

                {liq.comprobante && (
                  <p className="text-[#1A1A1A]/70">
                    <span className="font-medium text-[#1A1A1A]">Comprobante: </span>
                    <a
                      href={liq.comprobante}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2D6A4F] underline"
                    >
                      Ver comprobante
                    </a>
                  </p>
                )}

                {liq.notas && (
                  <p className="text-[#1A1A1A]/70">
                    <span className="font-medium text-[#1A1A1A]">Notas: </span>
                    {liq.notas}
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-end">
                <p className="text-base font-bold text-[#2D6A4F]">{cop(liq.monto)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
