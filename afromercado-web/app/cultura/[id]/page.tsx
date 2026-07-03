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
          {evento.categoria && (
            <span className="rounded-full bg-[#EAF3DE] px-3 py-1 text-xs text-[#3B6D11]">{evento.categoria}</span>
          )}
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
