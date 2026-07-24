'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  obtenerEvento,
  crearReservaCultural,
  misReservasCultura,
  esFavoritoCultura,
  type EventoCultural,
  type EntradaCultural,
  type ReservaCultural,
} from '@/lib/api/cultura'
import { listarAlianzasPorRegion, type AlianzaResumen } from '@/lib/api/alianza'
import SeccionReviewsCultura from '@/components/cultura/SeccionReviewsCultura'
import BotonFavoritoCultura from '@/components/cultura/BotonFavoritoCultura'
import ModalGaleriaHistoria from '@/components/cultura/ModalGaleriaHistoria'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'
import {
  CulturaCard,
  CulturaHero,
  CulturaPageContainer,
  CulturaShell,
  CulturaSkeletonGrid,
  CulturaStateCard,
  CulturaStat,
} from '@/components/cultura/CulturaUI'

const MapaCultura = dynamic(() => import('@/components/cultura/MapaCultura'), { ssr: false })

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fechaCortaSinDe(iso: string): string {
  const f = new Date(iso)
  return `${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`
}

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

function formatoPrecio(valor: number | string): string {
  const numero = Number(valor)
  if (numero === 0) return 'Gratis'
  return `$${numero.toLocaleString('es-CO')}`
}

function CulturaShellLocal({ children }: { children: ReactNode }) {
  return <CulturaShell>{children}</CulturaShell>
}

/** Sección "Aliados para tu visita": alianzas comerciales vigentes en la región del evento. */
function AliadosVisita({ departamento, municipio, fecha }: { departamento: string; municipio: string; fecha: string }) {
  const [alianzas, setAlianzas] = useState<AlianzaResumen[]>([])

  useEffect(() => {
    let activo = true
    listarAlianzasPorRegion({ departamento, municipio, fecha })
      .then((data) => {
        if (activo) setAlianzas(data)
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [departamento, municipio, fecha])

  if (alianzas.length === 0) return null

  return (
    <CulturaCard className="mt-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2D6A4F]">Aliados para tu visita</p>
          <h2 className="font-serif text-2xl text-[#1B4332]">Comercios de la ruta cultural</h2>
          <p className="mt-2 text-sm text-[#1A1A1A]/60">Descuentos y propuestas locales activas durante estas fechas.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {alianzas.map((a) => (
          <Link
            key={a.id}
            href={`/alianzas/${a.codigoCompartido}`}
            className="flex items-center gap-3 rounded-2xl border border-[#1A1A1A]/8 bg-[#F8F5F0] p-4 transition hover:-translate-y-0.5 hover:border-[#2D6A4F]/25 hover:bg-white"
          >
            <span className="text-2xl" aria-hidden="true">
              🤝
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base leading-tight text-[#1B4332]">{a.nombre}</p>
              {a.descripcion && <p className="mt-0.5 truncate text-xs text-[#1A1A1A]/55">{a.descripcion}</p>}
            </div>
          </Link>
        ))}
      </div>
    </CulturaCard>
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
  const [esFavorito, setEsFavorito] = useState(false)
  const [galeriaAbierta, setGaleriaAbierta] = useState(false)
  const [galeriaIndice, setGaleriaIndice] = useState(0)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const ev = await obtenerEvento(Number(id))
      setEvento(ev)
      const primera = (ev.entradas ?? []).find((e) => e.activa)
      setEntradaId(primera?.id ?? null)
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
    misReservasCultura()
      .then((rs) => {
        const elegible = rs.find((r) => r.eventoCulturalId === evento.id && r.estado === 'USADA' && !r.review)
        setReservaElegibleId(elegible?.id)
      })
      .catch(() => {})
  }, [usuario, evento])

  useEffect(() => {
    if (!usuario || !evento) {
      setEsFavorito(false)
      return
    }
    esFavoritoCultura(evento.id).then(setEsFavorito).catch(() => {})
  }, [usuario, evento])

  async function copiarEnlace(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard no disponible
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
      <CulturaShellLocal>
        <CulturaPageContainer className="space-y-6">
          <div className="h-72 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
          <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <div className="space-y-4">
              <CulturaSkeletonGrid columns="grid-cols-1 sm:grid-cols-2" items={2} />
              <div className="h-52 animate-pulse rounded-[1.5rem] bg-white/70" />
            </div>
            <div className="h-[34rem] animate-pulse rounded-[1.5rem] bg-white/70" />
          </div>
        </CulturaPageContainer>
      </CulturaShellLocal>
    )
  }

  if (error || !evento) {
    return (
      <CulturaShellLocal>
        <CulturaPageContainer className="py-14">
          <CulturaStateCard
            tone="error"
            icon="🎭"
            title="No encontramos este evento"
            description={error || 'El contenido solicitado no está disponible ahora mismo.'}
            action={
              <Link href="/cultura" className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]">
                Volver a la agenda
              </Link>
            }
          />
        </CulturaPageContainer>
      </CulturaShellLocal>
    )
  }

  const entradas = (evento.entradas ?? []).filter((e) => e.activa)
  const fotosEvento = evento.fotos ?? []
  const urlEvento = `${typeof window !== 'undefined' ? window.location.origin : 'https://afromercado.vercel.app'}/cultura/${evento.id}`
  const textoCompartir = `${evento.titulo} — ${urlEvento}`
  const desde = entradas.length > 0 ? Math.min(...entradas.map((e) => Number(e.precio))) : null

  return (
    <CulturaShellLocal>
      <CulturaPageContainer className="space-y-6">
        <Link href="/cultura" className="inline-flex items-center gap-2 text-sm font-semibold text-[#2D6A4F] hover:text-[#1B4332]">
          <span aria-hidden="true">←</span> Agenda cultural
        </Link>

        <CulturaHero
          eyebrow="Evento cultural"
          title={evento.titulo}
          description={`${rangoFechas(evento.fechaInicio, evento.fechaFin)} · ${evento.municipio}, ${evento.departamento}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(textoCompartir)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[#25D366]/20 bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#25D366]/18"
              >
                WhatsApp
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlEvento)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[#1877F2]/20 bg-[#1877F2]/10 px-3 py-2 text-xs font-semibold text-[#1877F2] transition hover:bg-[#1877F2]/18"
              >
                Facebook
              </a>
              <button
                type="button"
                onClick={() => copiarEnlace(urlEvento)}
                className="rounded-full border border-[#1A1A1A]/10 bg-white px-3 py-2 text-xs font-semibold text-[#1A1A1A]/65 transition hover:bg-[#F8F5F0]"
              >
                {copiado ? 'Enlace copiado' : 'Copiar enlace'}
              </button>
              <BotonFavoritoCultura eventoId={evento.id} esFavorito={esFavorito} onChange={setEsFavorito} variante="detalle" />
            </div>
          }
          badge={
            <div className="grid grid-cols-2 gap-2">
              <CulturaStat label="Inicio" value={fechaCortaSinDe(evento.fechaInicio)} />
              <CulturaStat label="Entradas" value={String(entradas.length)} accent="green" />
              <CulturaStat label="Desde" value={desde == null ? 'Libre' : desde === 0 ? 'Gratis' : `$${desde.toLocaleString('es-CO')}`} accent="gold" />
              <CulturaStat label="Fotos" value={String(fotosEvento.length)} />
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-6">
            <CulturaCard className="overflow-hidden">
              <div className="relative min-h-[18rem] bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#0D1F17] p-6 text-white">
                {evento.portadaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={evento.portadaUrl} alt={evento.titulo} className="absolute inset-0 h-full w-full object-cover opacity-55" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,31,23,0.18)_0%,rgba(13,31,23,0.82)_100%)]" />
                <div className="relative flex min-h-[18rem] flex-col justify-end">
                  <div className="flex flex-wrap gap-2">
                    {evento.categoria && <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#1B4332]">{evento.categoria}</span>}
                    {evento.destacado && <span className="rounded-full bg-[#D4A017] px-3 py-1 text-xs font-semibold text-[#1A1A1A]">Destacado</span>}
                    {evento.patrimonio && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">Patrimonio</span>}
                  </div>
                  <p className="mt-4 text-sm text-[#EAF3DE]">
                    📅 {rangoFechas(evento.fechaInicio, evento.fechaFin)} · {evento.municipio}, {evento.departamento}
                  </p>
                  <h1 className="mt-2 font-serif text-4xl leading-tight">{evento.titulo}</h1>
                  {evento.descripcion && <p className="mt-4 max-w-3xl text-sm leading-7 text-white/85 whitespace-pre-line">{evento.descripcion}</p>}
                </div>
              </div>
            </CulturaCard>

            {(evento.lugar || (evento.latitud != null && evento.longitud != null)) && (
              <CulturaCard className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2D6A4F]">Lugar</p>
                <p className="mt-2 text-base text-[#1A1A1A]/75">
                  📍 {evento.lugar ? evento.lugar : `${evento.municipio}, ${evento.departamento}`}
                </p>
                {evento.latitud != null && evento.longitud != null && (
                  <div className="mt-3">
                    <MapaCultura eventos={[evento]} />
                  </div>
                )}
              </CulturaCard>
            )}

            {evento.videoUrl && (
              <CulturaCard className="overflow-hidden p-4">
                <ReproductorVideo url={evento.videoUrl} />
              </CulturaCard>
            )}

            {fotosEvento.length > 0 && (
              <CulturaCard className="p-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2D6A4F]">Galería</p>
                    <h2 className="font-serif text-2xl text-[#1B4332]">Imágenes del evento</h2>
                  </div>
                  <Link href="/cultura/galeria" className="text-sm font-semibold text-[#2D6A4F] hover:text-[#1B4332]">
                    Ver más
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {fotosEvento.slice(0, 6).map((foto, index) => (
                    <button
                      key={`${foto}-${index}`}
                      type="button"
                      onClick={() => { setGaleriaIndice(index); setGaleriaAbierta(true) }}
                      className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto} alt={`${evento.titulo} ${index + 1}`} className="aspect-[4/3] w-full object-cover transition duration-300 hover:scale-[1.03]" />
                    </button>
                  ))}
                </div>
              </CulturaCard>
            )}

            {galeriaAbierta && (
              <ModalGaleriaHistoria
                titulo={evento.titulo}
                fotoUrls={fotosEvento}
                videoUrl={evento.videoUrl}
                indiceInicial={galeriaIndice}
                onCerrar={() => setGaleriaAbierta(false)}
              />
            )}

            {evento.departamento && evento.municipio && <AliadosVisita departamento={evento.departamento} municipio={evento.municipio} fecha={evento.fechaInicio} />}

            <SeccionReviewsCultura eventoCulturalId={evento.id} reservaElegibleId={reservaElegibleId} />
          </div>

          <aside className="space-y-4">
            <CulturaCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2D6A4F]">Reservas</p>
                  <h2 className="font-serif text-2xl text-[#1B4332]">Tus entradas</h2>
                </div>
                <span className="rounded-full bg-[#F8F5F0] px-3 py-1 text-xs font-semibold text-[#1A1A1A]/55">
                  {entradas.length === 0 ? 'Libre' : 'Con boletería'}
                </span>
              </div>

              {confirmacion ? (
                <CulturaStateCard
                  tone="success"
                  icon="✅"
                  title="Reserva confirmada"
                  description={`Tu código es ${confirmacion.codigo}. Guárdalo para el ingreso al evento.`}
                  action={<Link href="/cultura" className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]">Volver a la agenda</Link>}
                />
              ) : entradas.length === 0 ? (
                <CulturaStateCard
                  icon="🎟️"
                  title="Entrada libre"
                  description="Este evento no requiere reserva. Solo acércate y disfruta de la experiencia."
                />
              ) : !usuario ? (
                <div className="mt-4 space-y-3">
                  <ul className="space-y-2">
                    {entradas.map((e) => (
                      <li key={e.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[#1A1A1A]/8 bg-[#F8F5F0] p-3 text-sm">
                        <span className="text-[#1A1A1A]/82">{e.nombre}</span>
                        <span className="font-semibold text-[#1B4332]">{formatoPrecio(e.precio)}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => router.push(`/ingresar?redirect=/cultura/${evento.id}`)}
                    className="w-full rounded-full bg-[#1B4332] py-3 text-sm font-semibold text-white transition hover:bg-[#245a42]"
                  >
                    Ingresa para reservar
                  </button>
                </div>
              ) : (
                <form onSubmit={reservar} className="mt-4 space-y-4" noValidate>
                  <div className="space-y-2">
                    {entradas.map((e) => {
                      const disp = disponibles(e)
                      const agotada = disp === 0
                      return (
                        <label
                          key={e.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm transition ${
                            entradaId === e.id ? 'border-[#2D6A4F] bg-[#EAF3DE]/55' : 'border-[#1A1A1A]/10 bg-white'
                          } ${agotada ? 'opacity-50' : 'hover:border-[#2D6A4F]/25'}`}
                        >
                          <input
                            type="radio"
                            name="entrada"
                            checked={entradaId === e.id}
                            disabled={agotada}
                            onChange={() => setEntradaId(e.id)}
                            className="h-4 w-4 accent-[#2D6A4F]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-[#1A1A1A]/85">{e.nombre}</span>
                            {disp != null && (
                              <span className="block text-[11px] text-[#1A1A1A]/50">{agotada ? 'Agotada' : `${disp} disponibles`}</span>
                            )}
                          </span>
                          <span className="font-semibold text-[#1B4332]">{formatoPrecio(e.precio)}</span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="cantidad" className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1A1A1A]/45">
                        Cantidad
                      </label>
                      <input
                        id="cantidad"
                        type="number"
                        min={1}
                        max={10}
                        value={cantidad}
                        onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full rounded-2xl border border-[#1A1A1A]/12 px-4 py-3 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
                      />
                    </div>
                    <div>
                      <label htmlFor="metodo" className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1A1A1A]/45">
                        Pago
                      </label>
                      <input
                        id="metodo"
                        type="text"
                        value="Pago al organizar la reserva"
                        disabled
                        className="w-full rounded-2xl border border-[#1A1A1A]/8 bg-[#F8F5F0] px-4 py-3 text-sm text-[#1A1A1A]/55"
                      />
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full rounded-2xl border border-[#1A1A1A]/12 px-4 py-3 text-sm outline-none transition placeholder:text-[#1A1A1A]/35 focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Tu teléfono"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full rounded-2xl border border-[#1A1A1A]/12 px-4 py-3 text-sm outline-none transition placeholder:text-[#1A1A1A]/35 focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
                  />

                  {errorReserva && (
                    <p role="alert" className="rounded-2xl border border-[#C0392B]/15 bg-[#C0392B]/6 px-4 py-3 text-sm text-[#842029]">
                      {errorReserva}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={enviando || entradaId == null}
                    className="w-full rounded-full bg-[#1B4332] py-3 text-sm font-semibold text-white transition hover:bg-[#245a42] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {enviando ? 'Reservando...' : 'Reservar'}
                  </button>
                  <p className="text-center text-[11px] leading-5 text-[#1A1A1A]/50">
                    El organizador recibe su pago; la plataforma cobra su comisión.
                  </p>
                </form>
              )}
            </CulturaCard>
          </aside>
        </div>
      </CulturaPageContainer>
    </CulturaShellLocal>
  )
}
