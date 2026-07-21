'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  toggleFavoritoEmpleo,
  postularseOferta,
  type OfertaEmpleo,
  type TipoContratoEmpleo,
  type PostulacionEmpleo,
  type EstadoPostulacionEmpleo,
} from '@/lib/api/empleo'

export const TIPO_LABEL: Record<TipoContratoEmpleo, string> = {
  TIEMPO_COMPLETO: 'Tiempo completo',
  MEDIO_TIEMPO: 'Medio tiempo',
  POR_DIAS: 'Por días',
  TEMPORAL: 'Temporal',
  OTRO: 'Otro',
}

export const ESTADO_POSTULACION_LABEL: Record<EstadoPostulacionEmpleo, string> = {
  ENVIADA: 'Enviada', VISTA: 'Vista', PRESELECCIONADO: 'Preseleccionado',
  RECHAZADA: 'No seleccionado', CONTRATADO: '¡Contratado!', RETIRADA: 'Retirada',
}

export function salarioTexto(o: OfertaEmpleo): string {
  const esServicio = o.tipoPublicacion === 'OFRECE_SERVICIO'
  if (o.salarioNegociable) return esServicio ? 'Tarifa negociable' : 'Salario negociable'
  if (o.salarioMin && o.salarioMax) return `${formatearPrecio(Number(o.salarioMin))} - ${formatearPrecio(Number(o.salarioMax))}`
  if (o.salarioMin) return `Desde ${formatearPrecio(Number(o.salarioMin))}`
  return esServicio ? 'Tarifa a convenir' : 'Salario a convenir'
}

export function haceTiempo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 60) return 'Publicada hace un momento'
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Publicada hace ${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `Publicada hace ${dias}d`
  return `Publicada el ${new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
}

export function BotonFavorito({ ofertaId, esFavorito, onToggle }: { ofertaId: number; esFavorito: boolean; onToggle: (id: number, favorito: boolean) => void }) {
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
      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-[#1A1A1A]/10 bg-white hover:bg-[#F8F5F0] transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill={esFavorito ? '#2D6A4F' : 'none'} stroke={esFavorito ? '#2D6A4F' : '#1A1A1A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}

export function BotonCompartir({ oferta }: { oferta: OfertaEmpleo }) {
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

export function AccionRapida({
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

  if (oferta.tipoPublicacion === 'OFRECE_SERVICIO') {
    if (usuarioId && String(oferta.publicadoPorId) === usuarioId) {
      return <span className="text-xs font-semibold text-[#1A1A1A]/40">Tu servicio</span>
    }
    if (!oferta.contactoWhatsapp) {
      return <Link href={`/empleo/${oferta.id}`} className="text-xs font-semibold text-[#2D6A4F] hover:underline">Ver detalle →</Link>
    }
    return (
      <a
        href={`https://wa.me/57${oferta.contactoWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, vi tu servicio "${oferta.titulo}" en Teravia y quiero más información.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D6A4F] shadow-sm transition-all"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Contactar
      </a>
    )
  }

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

export interface TarjetaOfertaEmpleoProps {
  oferta: OfertaEmpleo
  usuarioId: string | undefined
  postulacion: PostulacionEmpleo | undefined
  tieneHojaDeVida: boolean | null
  onPostulado: (p: PostulacionEmpleo) => void
  autenticado?: boolean
  esFavorito?: boolean
  onToggleFavorito?: (id: number, favorito: boolean) => void
}

export default function TarjetaOfertaEmpleo({
  oferta,
  usuarioId,
  postulacion,
  tieneHojaDeVida,
  onPostulado,
  autenticado = false,
  esFavorito = false,
  onToggleFavorito,
}: TarjetaOfertaEmpleoProps) {
  const nombreOrganizador = oferta.comercio?.nombre ?? oferta.publicadoPor?.nombre ?? '?'
  const tieneImagen = !!oferta.imagenUrl
  const esServicio = oferta.tipoPublicacion === 'OFRECE_SERVICIO'

  const accionesFlotantes = (
    <div className={tieneImagen ? 'flex items-center gap-1.5 rounded-full bg-white/85 backdrop-blur-sm p-1 shadow-sm' : 'flex items-center gap-1.5 shrink-0'}>
      {oferta.anuncioActivo && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-[#9C6F0F] bg-[#D4A017]/15 px-2 py-1 rounded-full mr-1 whitespace-nowrap">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
          Destacado
        </span>
      )}
      <BotonCompartir oferta={oferta} />
      {autenticado && onToggleFavorito && (
        <BotonFavorito ofertaId={oferta.id} esFavorito={esFavorito} onToggle={onToggleFavorito} />
      )}
    </div>
  )

  return (
    <div className={`group rounded-2xl border overflow-hidden transition-all duration-200 ${oferta.anuncioActivo ? 'bg-gradient-to-b from-[#FFFDF0] to-white border-[#D4A017]/30 hover:border-[#D4A017]/50 hover:shadow-[0_8px_24px_rgba(212,160,23,0.12)]' : 'bg-white border-[#1A1A1A]/8 hover:border-[#2D6A4F]/25 hover:shadow-[0_8px_24px_rgba(45,106,79,0.08)]'}`}>
      {tieneImagen && (
        <Link href={`/empleo/${oferta.id}`} className="relative block h-40 w-full overflow-hidden bg-[#1B4332]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={oferta.imagenUrl!} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          <div className="absolute right-3 top-3">{accionesFlotantes}</div>
        </Link>
      )}

      <div className="p-5">
        <div className="flex items-start gap-3">
          {!tieneImagen && (
            <Link href={`/empleo/${oferta.id}`} className="shrink-0">
              <div className={`w-14 h-14 overflow-hidden flex items-center justify-center shadow-sm ${esServicio ? 'rounded-full bg-gradient-to-br from-[#D4A017] to-[#9C6F0F]' : 'rounded-xl bg-gradient-to-br from-[#2D6A4F] to-[#1B4332]'}`}>
                {oferta.comercio?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={oferta.comercio.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xl font-bold">{nombreOrganizador.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/empleo/${oferta.id}`} className="block min-w-0">
                <p className={`font-bold leading-snug transition-colors ${esServicio ? 'text-[#1A1A1A] group-hover:text-[#D4A017] text-[15px]' : 'text-[#1A1A1A] group-hover:text-[#2D6A4F]'}`}>{oferta.titulo}</p>
                {esServicio ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-xs font-semibold text-[#1A1A1A]/80 truncate">{nombreOrganizador}</p>
                    <span className="flex items-center gap-0.5 text-[11px] text-[#D4A017] font-bold bg-[#D4A017]/10 px-1.5 py-0.5 rounded-md">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      5.0 <span className="text-[#1A1A1A]/40 font-normal ml-0.5">(Nuevo)</span>
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-[#1A1A1A]/50 mt-0.5 truncate">{nombreOrganizador}</p>
                )}
              </Link>
              {!tieneImagen && accionesFlotantes}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2D6A4F]/8 text-[#2D6A4F] text-xs font-semibold px-2.5 py-1">
                📍 {oferta.municipio}
              </span>
              {oferta.tipoPublicacion === 'OFRECE_SERVICIO' ? (
                <span className="inline-flex items-center rounded-full bg-[#52B788]/12 text-[#1B4332] text-xs font-semibold px-2.5 py-1">
                  🛠️ Servicio
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[#1A1A1A]/6 text-[#1A1A1A]/60 text-xs font-semibold px-2.5 py-1">
                  {TIPO_LABEL[oferta.tipoContrato]}
                </span>
              )}
              {oferta.categoria && (
                <span className="inline-flex items-center rounded-full bg-[#D4A017]/10 text-[#9C6F0F] text-xs font-semibold px-2.5 py-1">
                  {oferta.categoria}
                </span>
              )}
            </div>

            <Link href={`/empleo/${oferta.id}`} className="block">
              <p className="text-sm text-[#1A1A1A]/60 mt-2.5 line-clamp-2 leading-relaxed">{oferta.descripcion}</p>
            </Link>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 mt-4 pt-3.5 border-t border-[#1A1A1A]/6">
          <div>
            {esServicio && <p className="text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-wider mb-0.5">TARIFA BASE</p>}
            <p className={`text-base font-bold ${esServicio ? 'text-[#D4A017]' : 'text-[#1B4332]'}`}>{salarioTexto(oferta)}</p>
            <p className="text-[11px] text-[#1A1A1A]/35 mt-0.5">{haceTiempo(oferta.createdAt)}</p>
          </div>
          <AccionRapida
            oferta={oferta}
            usuarioId={usuarioId}
            postulacion={postulacion}
            tieneHojaDeVida={tieneHojaDeVida}
            onPostulado={onPostulado}
          />
        </div>
      </div>
    </div>
  )
}
