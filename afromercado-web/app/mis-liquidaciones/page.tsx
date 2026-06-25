'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'

type EstadoLiq = 'PENDIENTE' | 'PAGADA' | 'CANCELADA'

interface Liquidacion {
  id: number
  tipo: string
  estado: EstadoLiq
  monto: string | number
  periodoDesde: string
  periodoHasta: string
  cuentaDestino?: string | null
  notas?: string | null
  comprobante?: string | null
  pagadoAt?: string | null
  createdAt: string
}

function fecha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MisLiquidacionesPage() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth, usuario } = useAuth()
  const [items, setItems] = useState<Liquidacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cargandoAuth) return
    if (!autenticado) { router.replace('/ingresar?redirect=/mis-liquidaciones'); return }
    if (usuario && usuario.rol !== 'COMERCIANTE' && usuario.rol !== 'REPARTIDOR') {
      router.replace('/'); return
    }
  }, [autenticado, cargandoAuth, usuario, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    apiFetch<{ ok: boolean; data: Liquidacion[] }>('/liquidaciones/mis-liquidaciones')
      .then((r) => setItems(r.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar.'))
      .finally(() => setCargando(false))
  }, [autenticado, cargandoAuth])

  const pendiente = items
    .filter((l) => l.estado === 'PENDIENTE')
    .reduce((s, l) => s + Number(l.monto), 0)

  const pagado = items
    .filter((l) => l.estado === 'PAGADA')
    .reduce((s, l) => s + Number(l.monto), 0)

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 flex flex-col gap-8">
      {/* Encabezado */}
      <div>
        <h1
          className="text-3xl text-[#1A1A1A]"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Mis liquidaciones
        </h1>
        <p className="mt-1 text-sm text-[#1A1A1A]/60">
          Resumen de pagos que AfroMercado debe transferirte por tus ventas o entregas.
        </p>
      </div>

      {/* Tarjetas resumen */}
      {!cargando && !error && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9B7300]/70">
              Por cobrar
            </p>
            <p className="mt-2 text-3xl font-bold text-[#9B7300]">
              {formatearPrecio(pendiente)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#52B788]/30 bg-[#52B788]/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2D6A4F]/70">
              Total cobrado
            </p>
            <p className="mt-2 text-3xl font-bold text-[#2D6A4F]">
              {formatearPrecio(pagado)}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[#C0392B]/30 bg-[#C0392B]/5 px-4 py-4 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      {/* Lista */}
      <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm">
        <div className="border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Historial</h2>
        </div>

        {cargando ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            titulo="Aún no tienes liquidaciones"
            descripcion="Cuando el equipo de AfroMercado procese tu pago, aparecerá aquí."
          />
        ) : (
          <ul className="divide-y divide-[#1A1A1A]/5">
            {items.map((liq) => (
              <li key={liq.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      Período {fecha(liq.periodoDesde)} – {fecha(liq.periodoHasta)}
                    </p>
                    {liq.cuentaDestino && (
                      <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
                        Cuenta: {liq.cuentaDestino}
                      </p>
                    )}
                    {liq.notas && (
                      <p className="text-xs text-[#1A1A1A]/50 mt-0.5">{liq.notas}</p>
                    )}
                    {liq.estado === 'PAGADA' && liq.pagadoAt && (
                      <p className="text-xs text-[#2D6A4F] mt-1">
                        Pagado el {fecha(liq.pagadoAt)}
                        {liq.comprobante && (
                          <>
                            {' '}—{' '}
                            <a
                              href={liq.comprobante}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              ver comprobante
                            </a>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-[#2D6A4F]">
                      {formatearPrecio(Number(liq.monto))}
                    </p>
                    <span
                      className={[
                        'inline-flex mt-1 items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                        liq.estado === 'PAGADA'
                          ? 'border-[#52B788]/30 bg-[#52B788]/10 text-[#2D6A4F]'
                          : liq.estado === 'CANCELADA'
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : 'border-[#D4A017]/30 bg-[#D4A017]/10 text-[#9B7300]',
                      ].join(' ')}
                    >
                      {liq.estado === 'PAGADA' ? 'Pagada' : liq.estado === 'CANCELADA' ? 'Cancelada' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
