'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import { formatearPrecio } from '@/lib/formatearPrecio'
import ModalDenunciarOferta from '@/components/empleo/ModalDenunciarOferta'
import TarjetaOfertaEmpleo from '@/components/empleo/TarjetaOfertaEmpleo'
import {
  obtenerOfertaEmpleo,
  postularseOferta,
  obtenerMiHojaDeVida,
  misPostulacionesEmpleo,
  otrasOfertasDelPublicador,
  toggleFavoritoEmpleo,
  esFavoritoEmpleo,
  yaDenuncieOferta,
  type OfertaEmpleo,
  type TipoContratoEmpleo,
  type EstadoPostulacionEmpleo,
  type PostulacionEmpleo,
} from '@/lib/api/empleo'

const TIPO_LABEL: Record<TipoContratoEmpleo, string> = {
  TIEMPO_COMPLETO: 'Tiempo completo',
  MEDIO_TIEMPO: 'Medio tiempo',
  POR_DIAS: 'Por días',
  TEMPORAL: 'Temporal',
  OTRO: 'Otro',
}

const ESTADO_POSTULACION_LABEL: Record<EstadoPostulacionEmpleo, string> = {
  ENVIADA: 'Enviada', VISTA: 'Vista por el empleador', PRESELECCIONADO: 'Preseleccionado',
  RECHAZADA: 'No seleccionado', CONTRATADO: '¡Contratado!', RETIRADA: 'Retirada',
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PaginaDetalleEmpleo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { autenticado, usuario } = useAuth()
  const [oferta, setOferta] = useState<OfertaEmpleo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tieneHojaDeVida, setTieneHojaDeVida] = useState<boolean | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [miEstadoPostulacion, setMiEstadoPostulacion] = useState<EstadoPostulacionEmpleo | null>(null)
  const [errorPostular, setErrorPostular] = useState<string | null>(null)
  const [favorito, setFavorito] = useState(false)
  const [otrasOfertas, setOtrasOfertas] = useState<OfertaEmpleo[]>([])
  const [otrasPostulaciones, setOtrasPostulaciones] = useState<Record<number, PostulacionEmpleo>>({})
  const [copiado, setCopiado] = useState(false)
  const [yaDenuncio, setYaDenuncio] = useState(false)
  const [mostrarModalDenuncia, setMostrarModalDenuncia] = useState(false)

  useEffect(() => {
    obtenerOfertaEmpleo(Number(id))
      .then(setOferta)
      .catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar esta oferta.'))
      .finally(() => setCargando(false))
    otrasOfertasDelPublicador(Number(id)).then(setOtrasOfertas).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!autenticado) return
    obtenerMiHojaDeVida().then((h) => setTieneHojaDeVida(!!h)).catch(() => setTieneHojaDeVida(false))
    esFavoritoEmpleo(Number(id)).then((r) => setFavorito(r.favorito)).catch(() => {})
    yaDenuncieOferta(Number(id)).then((r) => setYaDenuncio(r.denunciado)).catch(() => {})
    misPostulacionesEmpleo()
      .then((lista) => {
        const existente = lista.find((p) => p.ofertaEmpleoId === Number(id))
        if (existente && existente.estado !== 'RETIRADA') setMiEstadoPostulacion(existente.estado)
      })
      .catch(() => {})
  }, [autenticado, id])

  async function handleToggleFavorito() {
    try {
      const r = await toggleFavoritoEmpleo(Number(id))
      setFavorito(r.favorito)
    } catch {
      // silencioso — no bloquea la lectura de la oferta
    }
  }

  async function copiarEnlace() {
    const url = `${window.location.origin}/empleo/${id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard no disponible — no es crítico
    }
  }

  async function handlePostular() {
    setEnviando(true)
    setErrorPostular(null)
    try {
      const respuestasEnviar = (oferta?.preguntas ?? []).map((p) => ({ preguntaId: p.id, respuesta: respuestas[p.id] ?? '' }))
      const postulacion = await postularseOferta(Number(id), mensaje.trim() || undefined, respuestasEnviar)
      setMiEstadoPostulacion(postulacion.estado)
    } catch (e) {
      setErrorPostular(e instanceof Error ? e.message : 'No se pudo enviar tu postulación.')
    } finally {
      setEnviando(false)
    }
  }

  const esPropia = oferta && usuario && String(oferta.publicadoPorId) === usuario.id
  const cerrada = !!oferta?.fechaCierre && new Date(oferta.fechaCierre) < new Date()
  const faltanRespuestas = (oferta?.preguntas ?? []).some((p) => !respuestas[p.id]?.trim())

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        {cargando ? (
          <div className="h-40 rounded-2xl bg-white border border-[#1A1A1A]/8 animate-pulse" />
        ) : error || !oferta ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
            {error || 'Oferta no encontrada'}
          </div>
        ) : (
          <>
            <Link href="/empleo" className="text-xs text-[#2D6A4F] hover:underline">← Volver a empleo</Link>
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 overflow-hidden mt-3">
              {oferta.imagenUrl && (
                <div className="relative h-48 md:h-64 w-full bg-[#1B4332]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={oferta.imagenUrl} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="p-6">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                  {oferta.titulo}
                </h1>
                <div className="flex items-center gap-1.5 shrink-0">
                  {autenticado && (
                    <button
                      type="button"
                      onClick={handleToggleFavorito}
                      aria-label={favorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                      title={favorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                      className="w-9 h-9 flex items-center justify-center rounded-full border border-[#1A1A1A]/10 hover:bg-[#F8F5F0] transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill={favorito ? '#2D6A4F' : 'none'} stroke={favorito ? '#2D6A4F' : '#1A1A1A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  )}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${oferta.titulo} — ${typeof window !== 'undefined' ? window.location.origin : 'https://afromercado.vercel.app'}/empleo/${id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Compartir por WhatsApp"
                    title="Compartir por WhatsApp"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-[#25D366]/30 bg-[#25D366]/8 text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                  <button
                    type="button"
                    onClick={copiarEnlace}
                    aria-label="Copiar enlace"
                    title="Copiar enlace"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-[#1A1A1A]/10 hover:bg-[#F8F5F0] transition-colors"
                  >
                    {copiado ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm text-[#1A1A1A]/55 mt-1">
                📍 {oferta.municipio}{oferta.departamento ? `, ${oferta.departamento}` : ''} · {TIPO_LABEL[oferta.tipoContrato]}
                {(oferta.comercio?.nombre ?? oferta.publicadoPor?.nombre) && ` · ${oferta.comercio?.nombre ?? oferta.publicadoPor?.nombre}`}
              </p>
              <p className="text-base font-semibold text-[#2D6A4F] mt-2">
                {oferta.salarioNegociable
                  ? 'Salario negociable'
                  : oferta.salarioMin && oferta.salarioMax
                  ? `${formatearPrecio(Number(oferta.salarioMin))} - ${formatearPrecio(Number(oferta.salarioMax))}`
                  : 'Salario a convenir'}
              </p>

              <div className="mt-4 whitespace-pre-wrap text-sm text-[#1A1A1A]/75 leading-relaxed">{oferta.descripcion}</div>

              {oferta.requisitos && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/40 mb-1">Requisitos</p>
                  <p className="text-sm text-[#1A1A1A]/70 whitespace-pre-wrap">{oferta.requisitos}</p>
                </div>
              )}

              <p className="text-xs text-[#1A1A1A]/40 mt-4">
                {oferta.vacantes} vacante{oferta.vacantes !== 1 ? 's' : ''}
                {oferta.fechaCierre && ` · Postulaciones hasta el ${fmtFecha(oferta.fechaCierre)}`}
              </p>

              {autenticado && !esPropia && (
                <p className="mt-3 text-xs">
                  {yaDenuncio ? (
                    <span className="text-[#1A1A1A]/35">Ya denunciaste esta oferta</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMostrarModalDenuncia(true)}
                      className="text-[#1A1A1A]/35 hover:text-[#C0392B] transition-colors underline-offset-2 hover:underline"
                    >
                      🚩 Denunciar esta oferta
                    </button>
                  )}
                </p>
              )}

              {oferta.contactoWhatsapp && (
                <a
                  href={`https://wa.me/57${oferta.contactoWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, vi tu oferta "${oferta.titulo}" en AfroMercado y quiero más información.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white font-semibold text-sm transition-colors"
                  style={{ background: '#25D366' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Contactar por WhatsApp
                </a>
              )}
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#D4A017]/25 bg-[#D4A017]/8 px-4 py-3">
              <span className="text-base leading-none" aria-hidden="true">⚠️</span>
              <p className="text-xs leading-relaxed text-[#6B4E0D]">
                <span className="font-semibold">Nunca pagues por inscribirte, tomar un curso o &quot;asegurar&quot; tu cupo.</span> Ninguna oferta real te pedirá dinero para postularte. Si te lo piden, es una estafa — denúnciala.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 mt-4">
              {!autenticado ? (
                <Link href={`/ingresar?redirect=/empleo/${id}`} className="block text-center rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors">
                  Inicia sesión para postularte
                </Link>
              ) : esPropia ? (
                <p className="text-sm text-[#1A1A1A]/50 text-center">Esta es tu propia oferta.</p>
              ) : cerrada ? (
                <p className="text-sm text-[#1A1A1A]/50 text-center">Esta oferta ya cerró el plazo de postulaciones.</p>
              ) : miEstadoPostulacion ? (
                <div className="text-center">
                  <p className="text-sm text-[#2D6A4F] font-semibold">✓ Ya te postulaste · {ESTADO_POSTULACION_LABEL[miEstadoPostulacion]}</p>
                  <p className="mt-1 text-xs text-[#1A1A1A]/40">Recuerda: nunca debes pagar para continuar tu proceso de selección.</p>
                </div>
              ) : tieneHojaDeVida === false ? (
                <div className="text-center">
                  <p className="text-sm text-[#1A1A1A]/60 mb-3">Necesitas completar tu hoja de vida antes de postularte.</p>
                  <Link href="/empleo/mi-hoja-de-vida" className="inline-block rounded-xl bg-[#D4A017] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b88a14] transition-colors">
                    Completar hoja de vida
                  </Link>
                </div>
              ) : (
                <>
                  {oferta.preguntas.length > 0 && (
                    <div className="flex flex-col gap-3 mb-3">
                      {oferta.preguntas.map((p) => (
                        <div key={p.id}>
                          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">{p.texto}</label>
                          {p.tipo === 'SI_NO' ? (
                            <div className="grid grid-cols-2 gap-2">
                              {(['Sí', 'No'] as const).map((opcion) => (
                                <button
                                  key={opcion}
                                  type="button"
                                  onClick={() => setRespuestas((prev) => ({ ...prev, [p.id]: opcion }))}
                                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                                    respuestas[p.id] === opcion
                                      ? 'border-[#2D6A4F] bg-[#2D6A4F]/10 text-[#2D6A4F]'
                                      : 'border-[#1A1A1A]/15 text-[#1A1A1A]/60 hover:bg-[#F8F5F0]'
                                  }`}
                                >
                                  {opcion}
                                </button>
                              ))}
                            </div>
                          ) : p.tipo === 'OPCION_MULTIPLE' ? (
                            <select
                              value={respuestas[p.id] ?? ''}
                              onChange={(e) => setRespuestas((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none"
                            >
                              <option value="">Elige una opción…</option>
                              {p.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              value={respuestas[p.id] ?? ''}
                              onChange={(e) => setRespuestas((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    rows={3}
                    placeholder="Mensaje para el empleador (opcional)"
                    className="w-full resize-none rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                  />
                  {errorPostular && <p className="mt-2 text-xs text-[#C0392B]">{errorPostular}</p>}
                  <button
                    onClick={handlePostular}
                    disabled={enviando || faltanRespuestas}
                    className="mt-3 w-full rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors disabled:opacity-50"
                  >
                    {enviando ? 'Enviando…' : 'Postularme'}
                  </button>
                </>
              )}
            </div>

            {otrasOfertas.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 mt-4">
                <p className="text-sm font-semibold text-[#1A1A1A] mb-3">
                  Otras ofertas de {oferta.comercio?.nombre ?? oferta.publicadoPor?.nombre}
                </p>
                <div className="flex flex-col gap-4">
                  {otrasOfertas.map((o) => (
                    <TarjetaOfertaEmpleo
                      key={o.id}
                      oferta={o}
                      usuarioId={usuario?.id}
                      postulacion={otrasPostulaciones[o.id]}
                      tieneHojaDeVida={tieneHojaDeVida}
                      onPostulado={(p) => setOtrasPostulaciones((prev) => ({ ...prev, [o.id]: p }))}
                      autenticado={autenticado}
                    />
                  ))}
                </div>
              </div>
            )}

            {mostrarModalDenuncia && (
              <ModalDenunciarOferta
                ofertaId={Number(id)}
                onCerrar={() => setMostrarModalDenuncia(false)}
                onExito={() => setYaDenuncio(true)}
              />
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
