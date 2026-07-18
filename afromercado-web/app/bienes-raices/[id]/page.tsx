'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { formatearPrecio } from '@/lib/formatearPrecio'
import ModalDenunciarInmueble from '@/components/bienes-raices/ModalDenunciarInmueble'
import {
  obtenerInmueble,
  LABEL_TIPO_INMUEBLE,
  ICONO_TIPO_INMUEBLE,
  LABEL_TIPO_OPERACION_INMUEBLE,
  type Inmueble,
} from '@/lib/api/bienes-raices'

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PaginaDetalleInmueble({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [inmueble, setInmueble] = useState<Inmueble | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fotoActiva, setFotoActiva] = useState(0)
  const [copiado, setCopiado] = useState(false)
  const [mostrarModalDenuncia, setMostrarModalDenuncia] = useState(false)
  const [denunciaEnviada, setDenunciaEnviada] = useState(false)

  useEffect(() => {
    setCargando(true)
    obtenerInmueble(Number(id))
      .then((data) => { setInmueble(data); setFotoActiva(0) })
      .catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar esta publicación.'))
      .finally(() => setCargando(false))
  }, [id])

  async function copiarEnlace() {
    const url = `${window.location.origin}/bienes-raices/${id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard no disponible — no es crítico
    }
  }

  const fotos = inmueble?.fotoUrls ?? []
  const tieneFotos = fotos.length > 0

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        {cargando ? (
          <div className="h-64 rounded-2xl bg-white border border-[#1A1A1A]/8 animate-pulse" />
        ) : error || !inmueble ? (
          <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white px-5 py-12 text-center">
            <p className="text-3xl mb-2">🏘️</p>
            <p className="font-semibold text-[#1A1A1A] mb-1">Publicación no encontrada</p>
            <p className="text-sm text-[#1A1A1A]/55 mb-5">
              {error || 'Puede que ya no esté disponible o que todavía esté en revisión por un administrador.'}
            </p>
            <Link href="/bienes-raices" className="inline-block rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors">
              Ver todas las publicaciones
            </Link>
          </div>
        ) : (
          <>
            <Link href="/bienes-raices" className="text-xs text-[#2D6A4F] hover:underline">← Volver a bienes raíces</Link>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 overflow-hidden mt-3">
              {/* Galería */}
              {tieneFotos ? (
                <div>
                  <div className="relative h-56 md:h-72 w-full bg-[#1B4332]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotos[fotoActiva]} alt={inmueble.titulo} className="h-full w-full object-cover" />
                  </div>
                  {fotos.length > 1 && (
                    <div className="flex gap-1.5 p-2 overflow-x-auto">
                      {fotos.map((url, i) => (
                        <button
                          key={url + i}
                          type="button"
                          onClick={() => setFotoActiva(i)}
                          className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                            i === fotoActiva ? 'border-[#2D6A4F]' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="relative h-56 md:h-72 w-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #1B4332, #2D6A4F)' }}
                >
                  <span className="text-6xl" aria-hidden="true">{ICONO_TIPO_INMUEBLE[inmueble.tipoInmueble]}</span>
                </div>
              )}

              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                    {inmueble.titulo}
                  </h1>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${inmueble.titulo} — ${typeof window !== 'undefined' ? window.location.origin : 'https://afromercado.vercel.app'}/bienes-raices/${id}`)}`}
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

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="rounded-full bg-[#1B4332]/8 text-[#1B4332] px-2.5 py-1 text-xs font-semibold">
                    {ICONO_TIPO_INMUEBLE[inmueble.tipoInmueble]} {LABEL_TIPO_INMUEBLE[inmueble.tipoInmueble]}
                  </span>
                  <span className="rounded-full bg-[#D4A017]/12 text-[#8a6a10] px-2.5 py-1 text-xs font-semibold">
                    {LABEL_TIPO_OPERACION_INMUEBLE[inmueble.tipoOperacion]}
                  </span>
                </div>

                <p className="text-sm text-[#1A1A1A]/55 mt-2">
                  📍 {inmueble.municipio}, {inmueble.departamento}
                </p>

                <p className="text-2xl font-bold text-[#2D6A4F] mt-2">
                  {formatearPrecio(Number(inmueble.precio))}
                  {inmueble.tipoOperacion === 'ARRIENDO' && (
                    <span className="text-sm font-medium text-[#1A1A1A]/45">/mes</span>
                  )}
                </p>

                {(inmueble.areaM2 != null || inmueble.habitaciones != null || inmueble.banos != null) && (
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[#1A1A1A]/70">
                    {inmueble.areaM2 != null && (
                      <span className="flex items-center gap-1">📐 {inmueble.areaM2} m²</span>
                    )}
                    {inmueble.habitaciones != null && (
                      <span className="flex items-center gap-1">🛏️ {inmueble.habitaciones} habitación{inmueble.habitaciones !== 1 ? 'es' : ''}</span>
                    )}
                    {inmueble.banos != null && (
                      <span className="flex items-center gap-1">🚿 {inmueble.banos} baño{inmueble.banos !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}

                {inmueble.descripcion && (
                  <div className="mt-4 whitespace-pre-wrap text-sm text-[#1A1A1A]/75 leading-relaxed">
                    {inmueble.descripcion}
                  </div>
                )}

                {inmueble.folioMatricula && (
                  <div className="mt-4 rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/6 px-4 py-3">
                    <p className="text-xs font-semibold text-[#1B4332]">
                      ✓ Folio de matrícula inmobiliaria: {inmueble.folioMatricula}
                    </p>
                    <p className="text-xs text-[#1A1A1A]/60 mt-1 leading-relaxed">
                      Puedes verificarlo de forma independiente en la Ventanilla Única de Registro de la Superintendencia de Notariado y Registro antes de cualquier acuerdo.
                    </p>
                  </div>
                )}

                <p className="text-xs text-[#1A1A1A]/40 mt-4">
                  Publicado el {fmtFecha(inmueble.createdAt)}
                </p>

                <p className="mt-3 text-xs">
                  {denunciaEnviada ? (
                    <span className="text-[#1A1A1A]/35">Ya reportaste esta publicación</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMostrarModalDenuncia(true)}
                      className="text-[#1A1A1A]/35 hover:text-[#C0392B] transition-colors underline-offset-2 hover:underline"
                    >
                      🚩 Reportar esta publicación
                    </button>
                  )}
                </p>

                {inmueble.contactoWhatsapp && (
                  <a
                    href={`https://wa.me/57${inmueble.contactoWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, vi tu publicación "${inmueble.titulo}" en Teravia y quiero más información.`)}`}
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
                <span className="font-semibold">Nunca pagues por adelantado, reserves ni &quot;asegures&quot; este predio antes de verificarlo en persona y confirmar el título en notaría.</span> Ninguna transacción real de bienes raíces ocurre dentro de esta plataforma. Si te piden dinero por adelantado, es una estafa — repórtala.
              </p>
            </div>

            {mostrarModalDenuncia && (
              <ModalDenunciarInmueble
                inmuebleId={Number(id)}
                onCerrar={() => setMostrarModalDenuncia(false)}
                onExito={() => setDenunciaEnviada(true)}
              />
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
