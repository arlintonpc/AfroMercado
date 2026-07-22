'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { obtenerPerfilPublico, toggleSeguirUsuario, type PerfilPublicoUsuario } from '@/lib/api/usuarios'
import type { PublicacionCultural } from '@/lib/api/cultura'
import TarjetaPublicacionCultural from '@/components/cultura/TarjetaPublicacionCultural'
import ModalGaleriaHistoria from '@/components/cultura/ModalGaleriaHistoria'
import ModalDenunciarPublicacion from '@/components/cultura/ModalDenunciarPublicacion'
import { useAuth } from '@/context/AuthContext'

interface ItemLightbox {
  titulo: string
  fotoUrls: string[]
  videoUrl?: string | null
  indiceInicial?: number
}

// ── Iniciales (mismo patrón que app/comercio/[id]/page.tsx) ───

function Iniciales({ nombre }: { nombre: string }) {
  const partes = (nombre.trim() || 'Vecino').split(/\s+/)
  const letras = partes.length >= 2 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)
  return (
    <div className="w-16 h-16 rounded-2xl bg-[#52B788]/20 flex items-center justify-center flex-shrink-0">
      <span className="text-2xl font-bold text-[#2D6A4F] uppercase" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
        {letras}
      </span>
    </div>
  )
}

// ── Cabecera de la persona ──────────────────────────────────

function CabeceraPersona({
  p,
  esPropio,
  siguiendo,
  enVuelo,
  onSeguir,
}: {
  p: PerfilPublicoUsuario
  esPropio: boolean
  siguiendo: boolean
  enVuelo: boolean
  onSeguir: () => void
}) {
  const ubicacion = [p.municipio, p.departamento].filter(Boolean).join(', ')

  return (
    <section className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt={p.nombre} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
        ) : (
          <Iniciales nombre={p.nombre} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              {p.nombre}
            </h1>
            {!esPropio && (
              <button
                type="button"
                onClick={onSeguir}
                disabled={enVuelo}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  siguiendo
                    ? 'bg-[#1A1A1A]/8 text-[#1A1A1A]/70 border border-[#1A1A1A]/15'
                    : 'bg-[#2D6A4F] text-white hover:bg-[#245a42]'
                }`}
              >
                {siguiendo ? 'Siguiendo' : 'Seguir'}
              </button>
            )}
          </div>

          {ubicacion && <p className="text-sm text-[#1A1A1A]/55 mt-1.5">📍 {ubicacion}</p>}

          <div className="flex items-center gap-4 mt-2 text-sm text-[#1A1A1A]/70">
            <span><strong className="text-[#1A1A1A]">{p.totalSeguidores}</strong> {p.totalSeguidores === 1 ? 'seguidor' : 'seguidores'}</span>
            <span><strong className="text-[#1A1A1A]">{p.totalSeguidos}</strong> seguidos</span>
          </div>
        </div>
      </div>

      {p.bio && <p className="mt-4 text-sm text-[#1A1A1A]/70 leading-relaxed whitespace-pre-wrap">{p.bio}</p>}
    </section>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function PaginaPersona({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { usuario, autenticado } = useAuth()

  const [perfil, setPerfil] = useState<PerfilPublicoUsuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [reintentos, setReintentos] = useState(0)

  const [siguiendo, setSiguiendo] = useState(false)
  const [enVueloSeguir, setEnVueloSeguir] = useState(false)

  const [lightbox, setLightbox] = useState<ItemLightbox | null>(null)
  const [denunciandoId, setDenunciandoId] = useState<number | null>(null)

  // usuario.id llega como number en runtime pese a estar tipado como string
  // (inconsistencia preexistente en types/usuario.ts) — comparar como string.
  const esPropio = autenticado && String(usuario?.id) === id

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga(null)
      setNoEncontrado(false)
      setPerfil(null)
      try {
        const p = await obtenerPerfilPublico(Number(id))
        if (!activo) return
        setPerfil(p)
        setSiguiendo(p.sigo)
      } catch (err) {
        if (!activo) return
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('no encontrado') || msg.includes('404')) {
          setNoEncontrado(true)
        } else {
          console.error('Error cargando perfil:', err)
          setErrorCarga('No pudimos cargar este perfil. Revisa tu conexión o intenta de nuevo.')
        }
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [id, reintentos])

  async function manejarSeguir() {
    if (!autenticado) {
      router.push(`/ingresar?redirect=${encodeURIComponent(`/persona/${id}`)}`)
      return
    }
    if (enVueloSeguir) return
    const anterior = siguiendo
    setSiguiendo(!anterior)
    setEnVueloSeguir(true)
    try {
      const r = await toggleSeguirUsuario(Number(id))
      setSiguiendo(r.siguiendo)
      setPerfil((prev) => prev ? { ...prev, totalSeguidores: prev.totalSeguidores + (r.siguiendo ? 1 : -1) } : prev)
    } catch {
      setSiguiendo(anterior)
    } finally {
      setEnVueloSeguir(false)
    }
  }

  function abrirLightbox(publicacion: PublicacionCultural, indice: number) {
    setLightbox({
      titulo: publicacion.titulo,
      fotoUrls: publicacion.fotoUrls ?? [],
      videoUrl: publicacion.videoUrl,
      indiceInicial: indice,
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 md:px-6 py-8 pb-12">
        {cargando ? (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 flex gap-4">
              <Skeleton className="w-16 h-16 rounded-2xl flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-7 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : errorCarga ? (
          <EmptyState titulo="No se pudo cargar el perfil" descripcion={errorCarga} onReintentar={() => setReintentos((n) => n + 1)}>
            <Link href="/vitrina" className="mt-2 text-sm text-[#2D6A4F] font-semibold hover:underline">
              Volver a la Vitrina
            </Link>
          </EmptyState>
        ) : noEncontrado || !perfil ? (
          <EmptyState titulo="Perfil no encontrado" descripcion="Esta persona no existe o su cuenta ya no está disponible.">
            <Link href="/vitrina" className="mt-2 text-sm text-[#2D6A4F] font-semibold hover:underline">
              Volver a la Vitrina
            </Link>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            <CabeceraPersona
              p={perfil}
              esPropio={!!esPropio}
              siguiendo={siguiendo}
              enVuelo={enVueloSeguir}
              onSeguir={manejarSeguir}
            />

            <div>
              <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">
                Publicaciones
                <span className="ml-2 text-sm font-normal text-[#1A1A1A]/40">({perfil.totalPublicaciones})</span>
              </h2>

              {perfil.publicaciones.length === 0 ? (
                <EmptyState titulo="Sin publicaciones todavía" descripcion="Esta persona aún no ha compartido nada en Comparte tu Territorio." />
              ) : (
                <div className="flex flex-col gap-6">
                  {perfil.publicaciones.map((pub) => (
                    <TarjetaPublicacionCultural
                      key={pub.id}
                      publicacion={pub}
                      onAbrir={abrirLightbox}
                      onDenunciar={setDenunciandoId}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />

      {lightbox && (
        <ModalGaleriaHistoria
          titulo={lightbox.titulo}
          fotoUrls={lightbox.fotoUrls}
          videoUrl={lightbox.videoUrl}
          indiceInicial={lightbox.indiceInicial}
          onCerrar={() => setLightbox(null)}
        />
      )}

      {denunciandoId !== null && (
        <ModalDenunciarPublicacion
          publicacionId={denunciandoId}
          onCerrar={() => setDenunciandoId(null)}
          onExito={() => setDenunciandoId(null)}
        />
      )}
    </div>
  )
}
