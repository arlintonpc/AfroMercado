'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import {
  obtenerEvento,
  crearReservaCultural,
  misReservasCultura,
  type EventoCultural,
  type EntradaCultural,
  type ReservaCultural,
} from '@/lib/api/cultura'
import { listarAlianzasPorRegion, type AlianzaResumen } from '@/lib/api/alianzas'
import SeccionReviewsCultura from '@/components/cultura/SeccionReviewsCultura'

function rangoFechas(inicio: string, fin?: string | null): string {
  const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const i = new Date(inicio).toLocaleDateString('es-CO', opt)
  if (!fin) return i
  const f = new Date(fin).toLocaleDateString('es-CO', opt)
  return i === f ? i : `${i} – ${f}`
}

function disponibles(e: EntradaCultural): number | null {
  return e.cupo == null ? null : Math.max(0, e.cupo - e.vendidas)
}

/** Sección "Aliados para tu visita": alianzas comerciales vigentes en la región del evento. */
function AliadosVisita({ departamento, municipio, fecha }: { departamento: string; municipio: string; fecha: string }) {
  const [alianzas, setAlianzas] = useState<AlianzaResumen[]>([])

  useEffect(() => {
    let activo = true
    listarAlianzasPorRegion({ departamento, municipio, fecha })
      .then((data) => { if (activo) setAlianzas(data) })
      .catch(() => {})
    return () => { activo = false }
  }, [departamento, municipio, fecha])

  if (alianzas.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="font-serif text-lg text-[#1B4332]">Aliados para tu visita</h2>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">
        Comercios de la región con descuentos especiales durante estas fechas.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {alianzas.map((a) => (
          <Link
            key={a.id}
            href={`/alianzas/${a.codigoCompartido}`}
            className="flex items-center gap-3 rounded-2xl border border-[#1A1A1A]/8 bg-white p-4 transition hover:border-[#2D6A4F]/40 hover:shadow-sm"
          >
            <span className="text-2xl" aria-hidden="true">🤝</span>
            <div className="flex-1 min-w-0">
              <p className="font-serif text-base leading-tight text-[#1B4332]">{a.nombre}</p>
              {a.descripcion && <p className="mt-0.5 truncate text-xs text-[#1A1A1A]/55">{a.descripcion}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function CulturaShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

export default function EventoCulturalPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { usuario } = useAuth()

  const [evento, setEvento] = useState<EventoCultural | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [entradaId, setEntradaId] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorReserva, setErrorReserva] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<ReservaCultural | null>(null)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
  const [copiado, setCopiado] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const ev = await obtenerEvento(Number(id))
      setEvento(ev)
      const primera = (ev.entradas ?? []).find((e) => e.activa)
      if (primera) setEntradaId(primera.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No encontramos este evento.')
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (usuario) setNombre((n) => n || usuario.nombre || '')
  }, [usuario])

  useEffect(() => {
    if (!usuario || !evento) return
    misReservasCultura().then((rs) => {
      const elegible = rs.find((r) => r.eventoCulturalId === evento.id && r.estado === 'USADA' && !r.review)
      setReservaElegibleId(elegible?.id)
    }).catch(() => {})
  }, [usuario, evento])

  async function copiarEnlace(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard no disponible — no es crítico
    }
  }

  async function reservar(ev: React.FormEvent) {
    ev.preventDefault()
    if (enviando || entradaId == null) return
    setErrorReserva(null)
    if (!nombre.trim() || !telefono.trim()) {
      setErrorReserva('Escribe tu nombre y teléfono de contacto.')
      return
    }
    setEnviando(true)
    try {
      const reserva = await crearReservaCultural({
        entradaCulturalId: entradaId,
        cantidad,
        nombreContacto: nombre.trim(),
        telefonoContacto: telefono.trim(),
      })
      setConfirmacion(reserva)
    } catch (e) {
      setErrorReserva(e instanceof Error ? e.message : 'No pudimos completar la reserva.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <CulturaShell>
        <div className="mx-auto w-full max-w-4xl px-4 py-10">
          <div className="h-56 animate-pulse rounded-2xl bg-[#1A1A1A]/5" />
        </div>
      </CulturaShell>
    )
  }

  if (error || !evento) {
    return (
      <CulturaShell>
        <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden="true">🎭</p>
        <p className="mt-3 font-serif text-2xl text-[#1B4332]">{error || 'Evento no encontrado'}</p>
        <Link href="/cultura" className="mt-4 inline-block rounded-full bg-[#1B4332] px-5 py-2 text-sm text-white">
          Ver la agenda
        </Link>
        </div>
      </CulturaShell>
    )
  }

  const entradas = (evento.entradas ?? []).filter((e) => e.activa)
  const fotosEvento = evento.fotos ?? []
  const urlEvento = `${typeof window !== 'undefined' ? window.location.origin : 'https://afromercado.vercel.app'}/cultura/${evento.id}`
  const textoCompartir = `${evento.titulo} — ${urlEvento}`

  return (
    <CulturaShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <Link href="/cultura" className="text-sm text-[#2D6A4F] hover:underline">
        ← Agenda cultural
      </Link>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[#1A1A1A]/8">
        <div className="relative flex min-h-[160px] flex-col justify-end bg-[#2D6A4F] p-6 text-white">
          {evento.portadaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={evento.portadaUrl} alt={evento.titulo} className="absolute inset-0 h-full w-full object-cover opacity-70" />
          )}
          {evento.patrimonio && (
            <span className="relative mb-2 w-fit rounded-full bg-[#D4A017] px-3 py-1 text-xs font-semibold text-[#412402]">
              ★ {evento.patrimonioNota || 'Patrimonio'}
            </span>
          )}
          <span className="relative text-sm text-[#EAF3DE]">
            📅 {rangoFechas(evento.fechaInicio, evento.fechaFin)} · {evento.municipio}, {evento.departamento}
          </span>
          <h1 className="relative font-serif text-3xl leading-tight">{evento.titulo}</h1>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            {evento.categoria ? (
              <span className="rounded-full bg-[#EAF3DE] px-3 py-1 text-xs text-[#3B6D11]">{evento.categoria}</span>
            ) : <span />}
            <div className="flex items-center gap-1.5">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(textoCompartir)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Compartir por WhatsApp"
                title="Compartir por WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#25D366]/30 bg-[#25D366]/8 text-[#128C7E] transition-colors hover:bg-[#25D366]/20"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlEvento)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Compartir en Facebook"
                title="Compartir en Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1877F2]/30 bg-[#1877F2]/8 text-[#1877F2] transition-colors hover:bg-[#1877F2]/20"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
                </svg>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(urlEvento)}&text=${encodeURIComponent(evento.titulo)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Compartir en Telegram"
                title="Compartir en Telegram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#26A5E4]/30 bg-[#26A5E4]/8 text-[#26A5E4] transition-colors hover:bg-[#26A5E4]/20"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-2 1.92c-.24.24-.44.44-.82.44Z" />
                </svg>
              </a>
              <button
                type="button"
                onClick={() => copiarEnlace(urlEvento)}
                aria-label="Copiar enlace"
                title="Copiar enlace (también sirve para compartir en Instagram)"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1A1A1A]/10 text-[#1A1A1A]/60 transition-colors hover:bg-[#1A1A1A]/5"
              >
                {copiado ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {evento.descripcion && (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-[#1A1A1A]/80">{evento.descripcion}</p>
          )}
          {evento.lugar && (
            <p className="mt-4 text-sm text-[#1A1A1A]/60">📍 {evento.lugar}</p>
          )}
          {evento.videoUrl && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-[#10251C]">
              <video
                src={evento.videoUrl}
                poster={evento.portadaUrl ?? undefined}
                controls
                className="aspect-video w-full bg-[#10251C] object-cover"
              />
            </div>
          )}
          {fotosEvento.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fotosEvento.slice(0, 6).map((foto, index) => (
                <div key={`${foto}-${index}`} className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto} alt={`${evento.titulo} ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {evento.departamento && evento.municipio && (
            <AliadosVisita departamento={evento.departamento} municipio={evento.municipio} fecha={evento.fechaInicio} />
          )}

          <SeccionReviewsCultura eventoCulturalId={evento.id} reservaElegibleId={reservaElegibleId} />
        </div>

        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
            <h2 className="font-serif text-lg text-[#1B4332]">Entradas</h2>

            {entradas.length === 0 ? (
              <p className="mt-3 text-sm text-[#1A1A1A]/60">
                Evento de entrada libre. ¡Te esperamos!
              </p>
            ) : confirmacion ? (
              <div className="mt-3 rounded-xl bg-[#EAF3DE] p-4 text-center">
                <p className="text-2xl" aria-hidden="true">✅</p>
                <p className="mt-1 font-semibold text-[#1B4332]">¡Reserva confirmada!</p>
                <p className="mt-1 text-sm text-[#1A1A1A]/70">
                  Código <span className="font-mono font-semibold">{confirmacion.codigo}</span>
                </p>
                <Link href="/cultura" className="mt-3 inline-block text-sm text-[#2D6A4F] hover:underline">
                  Volver a la agenda
                </Link>
              </div>
            ) : !usuario ? (
              <div className="mt-3">
                <ul className="space-y-2">
                  {entradas.map((e) => (
                    <li key={e.id} className="flex items-center justify-between text-sm">
                      <span className="text-[#1A1A1A]/80">{e.nombre}</span>
                      <span className="font-semibold text-[#1B4332]">
                        {Number(e.precio) === 0 ? 'Gratis' : `$${Number(e.precio).toLocaleString('es-CO')}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push(`/ingresar?redirect=/cultura/${evento.id}`)}
                  className="mt-4 w-full rounded-full bg-[#1B4332] py-2.5 text-sm text-white"
                >
                  Ingresa para reservar
                </button>
              </div>
            ) : (
              <form onSubmit={reservar} className="mt-3 space-y-3" noValidate>
                <div className="space-y-2">
                  {entradas.map((e) => {
                    const disp = disponibles(e)
                    const agotada = disp === 0
                    return (
                      <label
                        key={e.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${
                          entradaId === e.id ? 'border-[#2D6A4F] bg-[#EAF3DE]/40' : 'border-[#1A1A1A]/10'
                        } ${agotada ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="radio"
                          name="entrada"
                          checked={entradaId === e.id}
                          disabled={agotada}
                          onChange={() => setEntradaId(e.id)}
                        />
                        <span className="flex-1">
                          <span className="block text-[#1A1A1A]/85">{e.nombre}</span>
                          {disp != null && (
                            <span className="block text-[11px] text-[#1A1A1A]/50">
                              {agotada ? 'Agotada' : `${disp} disponibles`}
                            </span>
                          )}
                        </span>
                        <span className="font-semibold text-[#1B4332]">
                          {Number(e.precio) === 0 ? 'Gratis' : `$${Number(e.precio).toLocaleString('es-CO')}`}
                        </span>
                      </label>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="cantidad" className="text-sm text-[#1A1A1A]/70">
                    Cantidad
                  </label>
                  <input
                    id="cantidad"
                    type="number"
                    min={1}
                    max={10}
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-sm"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Tu teléfono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
                />

                {errorReserva && (
                  <p role="alert" className="text-sm text-[#C0392B]">
                    {errorReserva}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando || entradaId == null}
                  className="w-full rounded-full bg-[#1B4332] py-2.5 text-sm text-white disabled:opacity-60"
                >
                  {enviando ? 'Reservando…' : 'Reservar'}
                </button>
                <p className="text-center text-[11px] text-[#1A1A1A]/50">
                  El organizador recibe su pago; la plataforma cobra su comisión.
                </p>
              </form>
            )}
          </div>
        </aside>
      </div>
      </div>
    </CulturaShell>
  )
}
