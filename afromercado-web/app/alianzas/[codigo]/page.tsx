'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { obtenerAlianzaPorCodigo, type AlianzaPublica, type ModuloAlianza, type SocioAlianzaPublico } from '@/lib/api/alianzas'

const ICONO_MODULO: Record<ModuloAlianza, string> = {
  EXPRESS: '🍽️',
  HOTEL: '🏨',
  TOUR: '🗺️',
  TRANSPORTE: '🛥️',
  PEDIDO: '🛍️',
}

const LABEL_MODULO: Record<ModuloAlianza, string> = {
  EXPRESS: 'Restaurante',
  HOTEL: 'Hotel',
  TOUR: 'Tour',
  TRANSPORTE: 'Transporte',
  PEDIDO: 'Tienda',
}

/** URL pública del socio según su módulo, o null si no hay suficiente información para enlazar. */
function urlSocio(socio: SocioAlianzaPublico): string | null {
  switch (socio.modulo) {
    case 'EXPRESS':
      return `/express/${socio.comercioId}`
    case 'HOTEL':
      return socio.moduloConfigId != null ? `/hoteles/${socio.moduloConfigId}` : null
    case 'TOUR':
      return socio.moduloConfigId != null ? `/tours/${socio.moduloConfigId}` : null
    case 'TRANSPORTE':
      return socio.moduloConfigId != null ? `/transportes/${socio.moduloConfigId}` : null
    case 'PEDIDO':
      return `/comercio/${socio.comercioId}`
    default:
      return null
  }
}

function rangoFechas(inicio: string, fin: string): string {
  const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const i = new Date(inicio).toLocaleDateString('es-CO', opt)
  const f = new Date(fin).toLocaleDateString('es-CO', opt)
  return i === f ? i : `${i} – ${f}`
}

function AlianzaShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

function BotonCopiarCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Silencioso: algunos navegadores/contexto sin HTTPS bloquean el clipboard.
    }
  }

  return (
    <button
      onClick={copiar}
      className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {copiado ? '¡Copiado!' : 'Copiar código'}
    </button>
  )
}

function TarjetaSocio({ socio }: { socio: SocioAlianzaPublico }) {
  const href = urlSocio(socio)
  const contenido = (
    <>
      <span className="text-3xl" aria-hidden="true">{ICONO_MODULO[socio.modulo]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-serif text-lg leading-tight text-[#1B4332]">{socio.nombre}</p>
        <p className="text-sm text-[#1A1A1A]/55">
          {LABEL_MODULO[socio.modulo]}
          {socio.municipio ? ` · ${socio.municipio}` : ''}
        </p>
      </div>
    </>
  )

  if (!href) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-[#1A1A1A]/8 bg-white p-4">
        {contenido}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-[#1A1A1A]/8 bg-white p-4 transition hover:border-[#2D6A4F]/40 hover:shadow-sm"
    >
      {contenido}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-[#1A1A1A]/30">
        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

export default function AlianzaPage() {
  const { codigo } = useParams<{ codigo: string }>()

  const [alianza, setAlianza] = useState<AlianzaPublica | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setAlianza(await obtenerAlianzaPorCodigo(String(codigo)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No encontramos esta alianza.')
    } finally {
      setCargando(false)
    }
  }, [codigo])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (cargando) {
    return (
      <AlianzaShell>
        <div className="mx-auto w-full max-w-4xl px-4 py-10">
          <div className="h-56 animate-pulse rounded-2xl bg-[#1A1A1A]/5" />
        </div>
      </AlianzaShell>
    )
  }

  if (error || !alianza) {
    return (
      <AlianzaShell>
        <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
          <p className="text-4xl" aria-hidden="true">🤝</p>
          <p className="mt-3 font-serif text-2xl text-[#1B4332]">{error || 'Alianza no encontrada'}</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-[#1B4332] px-5 py-2 text-sm text-white">
            Volver al inicio
          </Link>
        </div>
      </AlianzaShell>
    )
  }

  const region = [alianza.municipio, alianza.departamento].filter(Boolean).join(', ')

  return (
    <AlianzaShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8">
          <div className="flex flex-col gap-3 bg-[#2D6A4F] p-6 text-white">
            <span className="w-fit rounded-full bg-[#D4A017] px-3 py-1 text-xs font-semibold text-[#412402]">
              ★ Alianza comercial
            </span>
            <h1 className="font-serif text-3xl leading-tight">{alianza.nombre}</h1>
            <span className="text-sm text-[#EAF3DE]">
              📅 Vigente {rangoFechas(alianza.inicio, alianza.fin)}
              {region ? ` · 📍 ${region}` : ''}
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-black/20 px-4 py-2 font-mono text-lg font-semibold tracking-wider">
                {alianza.codigoCompartido}
              </span>
              <BotonCopiarCodigo codigo={alianza.codigoCompartido} />
            </div>
          </div>
        </div>

        {alianza.descripcion && (
          <p className="mt-6 whitespace-pre-line leading-relaxed text-[#1A1A1A]/80">{alianza.descripcion}</p>
        )}

        <div className="mt-8">
          <h2 className="font-serif text-xl text-[#1B4332]">Comercios aliados</h2>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">
            Usa el código <span className="font-mono font-semibold">{alianza.codigoCompartido}</span> al reservar o
            comprar con cualquiera de estos comercios para acceder al descuento de la alianza.
          </p>

          {alianza.socios.length === 0 ? (
            <p className="mt-4 text-sm text-[#1A1A1A]/50">Esta alianza aún no tiene socios activos.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {alianza.socios.map((socio) => (
                <TarjetaSocio key={`${socio.comercioId}-${socio.modulo}`} socio={socio} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AlianzaShell>
  )
}
