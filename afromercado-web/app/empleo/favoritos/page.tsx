'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { misFavoritosEmpleo, toggleFavoritoEmpleo, type OfertaEmpleo, type TipoContratoEmpleo } from '@/lib/api/empleo'

const TIPO_LABEL: Record<TipoContratoEmpleo, string> = {
  TIEMPO_COMPLETO: 'Tiempo completo',
  MEDIO_TIEMPO: 'Medio tiempo',
  POR_DIAS: 'Por días',
  TEMPORAL: 'Temporal',
  OTRO: 'Otro',
}

function salarioTexto(o: OfertaEmpleo): string {
  if (o.salarioNegociable) return 'Salario negociable'
  if (o.salarioMin && o.salarioMax) return `${formatearPrecio(Number(o.salarioMin))} - ${formatearPrecio(Number(o.salarioMax))}`
  if (o.salarioMin) return `Desde ${formatearPrecio(Number(o.salarioMin))}`
  return 'Salario a convenir'
}

export default function PaginaFavoritosEmpleo() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [ofertas, setOfertas] = useState<OfertaEmpleo[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/empleo/favoritos')
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    misFavoritosEmpleo().then(setOfertas).catch(() => {}).finally(() => setCargando(false))
  }, [autenticado, cargandoAuth])

  async function quitar(id: number) {
    await toggleFavoritoEmpleo(id)
    setOfertas((prev) => prev.filter((o) => o.id !== id))
  }

  if (cargandoAuth || cargando) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        <Link href="/empleo" className="text-xs text-[#2D6A4F] hover:underline">← Volver a empleo</Link>
        <h1 className="text-3xl text-[#1A1A1A] mt-2 mb-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Empleos favoritos
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-6">{ofertas.length} {ofertas.length === 1 ? 'oferta guardada' : 'ofertas guardadas'}</p>

        {ofertas.length === 0 ? (
          <EmptyState titulo="Sin favoritos aún" descripcion="Guarda ofertas tocando el corazón para revisarlas después." />
        ) : (
          <div className="flex flex-col gap-3">
            {ofertas.map((o) => {
              const nombreOrganizador = o.comercio?.nombre ?? o.publicadoPor?.nombre ?? '?'
              return (
                <div key={o.id} className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
                  <div className="flex items-start gap-3">
                    <Link href={`/empleo/${o.id}`} className="shrink-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#2D6A4F] flex items-center justify-center">
                        {o.comercio?.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.comercio.logoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-lg font-bold">{nombreOrganizador.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/empleo/${o.id}`} className="block min-w-0">
                          <p className="font-semibold text-[#1A1A1A] leading-snug">{o.titulo}</p>
                          <p className="text-xs text-[#1A1A1A]/50 mt-0.5 truncate">{nombreOrganizador}</p>
                        </Link>
                        <button
                          type="button"
                          onClick={() => quitar(o.id)}
                          aria-label="Quitar de favoritos"
                          title="Quitar de favoritos"
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-[#1A1A1A]/10 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#2D6A4F]/8 text-[#2D6A4F] text-xs font-semibold px-2.5 py-1">
                          📍 {o.municipio}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-[#1A1A1A]/6 text-[#1A1A1A]/60 text-xs font-semibold px-2.5 py-1">
                          {TIPO_LABEL[o.tipoContrato]}
                        </span>
                      </div>
                      <Link href={`/empleo/${o.id}`} className="block">
                        <p className="text-sm text-[#1A1A1A]/60 mt-2.5 line-clamp-2 leading-relaxed">{o.descripcion}</p>
                      </Link>
                      <p className="text-base font-bold text-[#1B4332] mt-3">{salarioTexto(o)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
