'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import {
  miPerfilFidelizacion,
  misMovimientosPuntos,
  canjearPuntos,
  type PerfilFidelizacion,
  type MovimientoPuntos,
} from '@/lib/api/fidelizacion'
import { formatearPrecio } from '@/lib/formatearPrecio'

const TIPO_LABEL: Record<string, string> = {
  GANADO_COMPRA: 'Ganado por compra',
  GANADO_REFERIDO: 'Bono por referido',
  CANJEADO: 'Canjeado',
  AJUSTE_ADMIN: 'Ajuste',
}

function fechaLegible(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PaginaMisPuntos() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [perfil, setPerfil] = useState<PerfilFidelizacion | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoPuntos[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [puntosACanjear, setPuntosACanjear] = useState('')
  const [canjeando, setCanjeando] = useState(false)
  const [cuponGenerado, setCuponGenerado] = useState<{ codigo: string; valor: string | number } | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/mi-cuenta/puntos')
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    Promise.all([miPerfilFidelizacion(), misMovimientosPuntos()])
      .then(([p, m]) => { setPerfil(p); setMovimientos(m) })
      .catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar tus puntos.'))
      .finally(() => setCargando(false))
  }, [autenticado, cargandoAuth])

  const linkReferido = perfil ? `${typeof window !== 'undefined' ? window.location.origin : ''}/ingresar?ref=${perfil.codigoReferido}` : ''

  async function copiarLink() {
    if (!linkReferido) return
    await navigator.clipboard.writeText(linkReferido)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function handleCanjear() {
    const cant = Number(puntosACanjear)
    if (!Number.isFinite(cant) || cant <= 0) return
    setCanjeando(true)
    setError(null)
    try {
      const cupon = await canjearPuntos(cant)
      setCuponGenerado(cupon)
      const p = await miPerfilFidelizacion()
      setPerfil(p)
      setPuntosACanjear('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo canjear.')
    } finally {
      setCanjeando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        <h1 className="text-3xl text-[#1A1A1A] mb-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Mis puntos
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-7">Gana puntos con tus compras y canjéalos por descuentos.</p>

        {error && (
          <div className="rounded-xl border border-[#C0392B]/20 bg-[#C0392B]/5 px-4 py-3 text-sm text-[#C0392B] mb-6">{error}</div>
        )}

        {cargando || cargandoAuth ? (
          <div className="h-40 rounded-2xl bg-white border border-[#1A1A1A]/8 animate-pulse" />
        ) : perfil ? (
          <>
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/40">Saldo disponible</p>
              <p className="text-4xl font-bold text-[#2D6A4F] mt-1">{perfil.puntos} pts</p>
              <p className="text-xs text-[#1A1A1A]/45 mt-1">{perfil.puntosAcumuladosTotal} puntos acumulados en total</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 mb-4">
              <h2 className="font-semibold text-[#1A1A1A] mb-2">Invita y gana</h2>
              <p className="text-sm text-[#1A1A1A]/60 mb-3">
                Comparte tu link — cuando la persona que invitas haga su primera compra, ganas puntos de bono.
              </p>
              <div className="flex items-center gap-2">
                <input readOnly value={linkReferido} className="flex-1 rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-xs text-[#1A1A1A]/70 bg-[#F8F5F0]" />
                <button onClick={copiarLink} className="rounded-lg bg-[#2D6A4F] px-3 py-2 text-xs font-semibold text-white hover:bg-[#245a42] transition-colors whitespace-nowrap">
                  {copiado ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 mb-4">
              <h2 className="font-semibold text-[#1A1A1A] mb-2">Canjear puntos</h2>
              {cuponGenerado ? (
                <div className="rounded-lg border border-[#52B788]/30 bg-[#52B788]/8 px-3 py-2.5">
                  <p className="text-sm text-[#1A1A1A]/70">¡Listo! Usa este código en tu próxima compra:</p>
                  <p className="text-lg font-bold text-[#2D6A4F] mt-1">{cuponGenerado.codigo}</p>
                  <p className="text-xs text-[#1A1A1A]/45 mt-0.5">Descuento de {formatearPrecio(Number(cuponGenerado.valor))}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={puntosACanjear}
                    onChange={(e) => setPuntosACanjear(e.target.value)}
                    placeholder="Puntos a canjear"
                    className="flex-1 rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleCanjear}
                    disabled={canjeando || !puntosACanjear}
                    className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b88a14] transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {canjeando ? 'Canjeando…' : 'Canjear'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6">
              <h2 className="font-semibold text-[#1A1A1A] mb-3">Historial</h2>
              {movimientos.length === 0 ? (
                <p className="text-sm text-[#1A1A1A]/50">Todavía no tienes movimientos.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {movimientos.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm border-b border-[#1A1A1A]/5 pb-2 last:border-0">
                      <div>
                        <p className="text-[#1A1A1A]/80">{TIPO_LABEL[m.tipo] ?? m.tipo}</p>
                        <p className="text-xs text-[#1A1A1A]/40">{fechaLegible(m.createdAt)}</p>
                      </div>
                      <span className={`font-bold ${m.puntos >= 0 ? 'text-[#2D6A4F]' : 'text-[#C0392B]'}`}>
                        {m.puntos >= 0 ? '+' : ''}{m.puntos}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  )
}
