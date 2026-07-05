'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import {
  listarOfertasEmpleo,
  postularseOferta,
  obtenerMiHojaDeVida,
  misPostulacionesEmpleo,
  misFavoritosEmpleo,
  toggleFavoritoEmpleo,
  CATEGORIAS_EMPLEO,
  type OfertaEmpleo,
  type TipoContratoEmpleo,
  type PostulacionEmpleo,
  type EstadoPostulacionEmpleo,
} from '@/lib/api/empleo'
import { DEPARTAMENTOS } from '@/lib/data/colombia'

const TIPO_LABEL: Record<TipoContratoEmpleo, string> = {
  TIEMPO_COMPLETO: 'Tiempo completo',
  MEDIO_TIEMPO: 'Medio tiempo',
  POR_DIAS: 'Por días',
  TEMPORAL: 'Temporal',
  OTRO: 'Otro',
}

const ESTADO_POSTULACION_LABEL: Record<EstadoPostulacionEmpleo, string> = {
  ENVIADA: 'Enviada', VISTA: 'Vista', PRESELECCIONADO: 'Preseleccionado',
  RECHAZADA: 'No seleccionado', CONTRATADO: '¡Contratado!', RETIRADA: 'Retirada',
}

function salarioTexto(o: OfertaEmpleo): string {
  if (o.salarioNegociable) return 'Salario negociable'
  if (o.salarioMin && o.salarioMax) return `${formatearPrecio(Number(o.salarioMin))} - ${formatearPrecio(Number(o.salarioMax))}`
  if (o.salarioMin) return `Desde ${formatearPrecio(Number(o.salarioMin))}`
  return 'Salario a convenir'
}

function haceTiempo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 60) return 'Publicada hace un momento'
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Publicada hace ${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `Publicada hace ${dias}d`
  return `Publicada el ${new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
}

function BotonFavorito({ ofertaId, esFavorito, onToggle }: { ofertaId: number; esFavorito: boolean; onToggle: (id: number, favorito: boolean) => void }) {
  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const r = await toggleFavoritoEmpleo(ofertaId)
    onToggle(ofertaId, r.favorito)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      title={esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-[#1A1A1A]/10 hover:bg-[#F8F5F0] transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill={esFavorito ? '#2D6A4F' : 'none'} stroke={esFavorito ? '#2D6A4F' : '#1A1A1A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}

function BotonCompartir({ oferta }: { oferta: OfertaEmpleo }) {
  const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://afromercado.vercel.app'}/empleo/${oferta.id}`
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(`${oferta.titulo} — ${url}`)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label="Compartir por WhatsApp"
      title="Compartir por WhatsApp"
      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-[#25D366]/30 bg-[#25D366]/8 text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  )
}

function AccionRapida({
  oferta,
  usuarioId,
  postulacion,
  tieneHojaDeVida,
  onPostulado,
}: {
  oferta: OfertaEmpleo
  usuarioId: string | undefined
  postulacion: PostulacionEmpleo | undefined
  tieneHojaDeVida: boolean | null
  onPostulado: (p: PostulacionEmpleo) => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function postularme() {
    setEnviando(true)
    setError(null)
    try {
      const p = await postularseOferta(oferta.id)
      onPostulado(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar tu postulación.')
    } finally {
      setEnviando(false)
    }
  }

  if (usuarioId && String(oferta.publicadoPorId) === usuarioId) {
    return <span className="text-xs font-semibold text-[#1A1A1A]/40">Tu oferta</span>
  }
  if (postulacion && postulacion.estado !== 'RETIRADA') {
    return <span className="text-xs font-semibold text-[#2D6A4F]">✓ Ya te postulaste · {ESTADO_POSTULACION_LABEL[postulacion.estado]}</span>
  }
  if (!usuarioId) {
    return <Link href="/ingresar?redirect=/empleo" className="text-xs font-semibold text-[#2D6A4F] hover:underline">Inicia sesión para postularte</Link>
  }
  if (tieneHojaDeVida === false) {
    return <Link href="/empleo/mi-hoja-de-vida" className="text-xs font-semibold text-[#D4A017] hover:underline">Completa tu hoja de vida para postularte</Link>
  }
  if (oferta.preguntas.length > 0) {
    return <Link href={`/empleo/${oferta.id}`} className="text-xs font-semibold text-[#2D6A4F] hover:underline">Responder preguntas y postularme →</Link>
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={postularme}
        disabled={enviando}
        className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#245a42] transition-colors disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : postulacion?.estado === 'RETIRADA' ? 'Postularme de nuevo' : 'Postularme'}
      </button>
      {error && <span className="text-[11px] text-[#C0392B]">{error}</span>}
    </div>
  )
}

export default function PaginaEmpleo() {
  const { usuario, autenticado } = useAuth()
  const [ofertas, setOfertas] = useState<OfertaEmpleo[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [municipio, setMunicipio] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [tipoContrato, setTipoContrato] = useState<TipoContratoEmpleo | ''>('')
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [misPostulaciones, setMisPostulaciones] = useState<Map<number, PostulacionEmpleo>>(new Map())
  const [tieneHojaDeVida, setTieneHojaDeVida] = useState<boolean | null>(null)
  const [categoria, setCategoria] = useState('')
  const [favoritos, setFavoritos] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!autenticado) return
    misPostulacionesEmpleo()
      .then((lista) => setMisPostulaciones(new Map(lista.map((p) => [p.ofertaEmpleoId, p]))))
      .catch(() => {})
    obtenerMiHojaDeVida().then((h) => setTieneHojaDeVida(!!h)).catch(() => setTieneHojaDeVida(false))
    misFavoritosEmpleo().then((lista) => setFavoritos(new Set(lista.map((o) => o.id)))).catch(() => {})
  }, [autenticado])

  useEffect(() => {
    setCargando(true)
    setPagina(1)
    listarOfertasEmpleo({ municipio: municipio || undefined, departamento: departamento || undefined, categoria: categoria || undefined, tipoContrato: tipoContrato || undefined, page: 1 })
      .then((r) => { setOfertas(r.items); setTotal(r.total) })
      .catch(() => { setOfertas([]); setTotal(0) })
      .finally(() => setCargando(false))
  }, [municipio, departamento, categoria, tipoContrato])

  async function cargarMas() {
    setCargandoMas(true)
    try {
      const siguiente = pagina + 1
      const r = await listarOfertasEmpleo({ municipio: municipio || undefined, departamento: departamento || undefined, categoria: categoria || undefined, tipoContrato: tipoContrato || undefined, page: siguiente })
      setOfertas((prev) => [...prev, ...r.items])
      setTotal(r.total)
      setPagina(siguiente)
    } finally {
      setCargandoMas(false)
    }
  }

  function alternarFavorito(id: number, favorito: boolean) {
    setFavoritos((prev) => {
      const next = new Set(prev)
      if (favorito) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const hayMas = ofertas.length < total

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-8 pb-12">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              Empleo
            </h1>
            <p className="mt-1 text-sm text-[#1A1A1A]/55">Bolsa de trabajo comunitaria — ofertas locales del Chocó y todo el país.</p>
          </div>
          <Link href="/empleo/publicar" className="rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors whitespace-nowrap">
            Publicar oferta
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <select
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            placeholder="Filtrar por municipio…"
            className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          />
          <select
            value={tipoContrato}
            onChange={(e) => setTipoContrato(e.target.value as TipoContratoEmpleo | '')}
            className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Todos los tipos de contrato</option>
            {Object.entries(TIPO_LABEL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS_EMPLEO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {cargando ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : ofertas.length === 0 ? (
          <EmptyState titulo="No hay ofertas disponibles" descripcion="Prueba con otro municipio o tipo de contrato, o vuelve más tarde." />
        ) : (
          <div className="flex flex-col gap-3">
            {ofertas.map((o) => {
              const nombreOrganizador = o.comercio?.nombre ?? o.publicadoPor?.nombre ?? '?'
              return (
              <div key={o.id} className="group bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 hover:border-[#2D6A4F]/25 hover:shadow-[0_8px_24px_rgba(45,106,79,0.08)] transition-all duration-200">
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
                        <p className="font-semibold text-[#1A1A1A] leading-snug group-hover:text-[#2D6A4F] transition-colors">{o.titulo}</p>
                        <p className="text-xs text-[#1A1A1A]/50 mt-0.5 truncate">{nombreOrganizador}</p>
                      </Link>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <BotonCompartir oferta={o} />
                        {autenticado && (
                          <BotonFavorito ofertaId={o.id} esFavorito={favoritos.has(o.id)} onToggle={alternarFavorito} />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#2D6A4F]/8 text-[#2D6A4F] text-xs font-semibold px-2.5 py-1">
                        📍 {o.municipio}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-[#1A1A1A]/6 text-[#1A1A1A]/60 text-xs font-semibold px-2.5 py-1">
                        {TIPO_LABEL[o.tipoContrato]}
                      </span>
                      {o.categoria && (
                        <span className="inline-flex items-center rounded-full bg-[#D4A017]/10 text-[#9C6F0F] text-xs font-semibold px-2.5 py-1">
                          {o.categoria}
                        </span>
                      )}
                    </div>

                    <Link href={`/empleo/${o.id}`} className="block">
                      <p className="text-sm text-[#1A1A1A]/60 mt-2.5 line-clamp-2 leading-relaxed">{o.descripcion}</p>
                    </Link>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-3 mt-4 pt-3.5 border-t border-[#1A1A1A]/6">
                  <div>
                    <p className="text-base font-bold text-[#1B4332]">{salarioTexto(o)}</p>
                    <p className="text-[11px] text-[#1A1A1A]/35 mt-0.5">{haceTiempo(o.createdAt)}</p>
                  </div>
                  <AccionRapida
                    oferta={o}
                    usuarioId={usuario?.id}
                    postulacion={misPostulaciones.get(o.id)}
                    tieneHojaDeVida={tieneHojaDeVida}
                    onPostulado={(p) => setMisPostulaciones((prev) => new Map(prev).set(o.id, p))}
                  />
                </div>
              </div>
              )
            })}
            {hayMas && (
              <button
                type="button"
                onClick={cargarMas}
                disabled={cargandoMas}
                className="self-center rounded-xl border border-[#1A1A1A]/15 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/70 hover:bg-white disabled:opacity-50"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar más ofertas'}
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
