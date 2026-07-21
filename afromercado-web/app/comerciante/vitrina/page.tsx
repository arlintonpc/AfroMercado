'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listarMisPublicacionesVitrina,
  actualizarMiPublicacionVitrina,
  eliminarMiPublicacionVitrina,
  type PublicacionCultural,
} from '@/lib/api/cultura'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

export default function MisVideosVitrinaPage() {
  const [publicaciones, setPublicaciones] = useState<PublicacionCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesandoId, setProcesando] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [pendienteToggle, setPendienteToggle] = useState<PublicacionCultural | null>(null)
  const [pendienteEliminar, setPendienteEliminar] = useState<PublicacionCultural | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await listarMisPublicacionesVitrina()
      setPublicaciones(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los videos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  async function confirmarToggleActivo() {
    const p = pendienteToggle
    if (!p) return
    setPendienteToggle(null)
    setProcesando(p.id)
    try {
      await actualizarMiPublicacionVitrina(p.id, { activa: !p.activa })
      setPublicaciones(prev => prev.map(x => x.id === p.id ? { ...x, activa: !p.activa } : x))
      setAviso({ tipo: 'exito', texto: `Video ${!p.activa ? 'habilitado' : 'inhabilitado'}.` })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo actualizar.' })
    } finally {
      setProcesando(null)
    }
  }

  async function confirmarEliminar() {
    const p = pendienteEliminar
    if (!p) return
    setPendienteEliminar(null)
    setProcesando(p.id)
    try {
      await eliminarMiPublicacionVitrina(p.id)
      setPublicaciones(prev => prev.filter(x => x.id !== p.id))
      setAviso({ tipo: 'exito', texto: 'Video eliminado correctamente.' })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo eliminar el video.' })
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Vitrina de Video
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Gestiona los videos de tu negocio que aparecen en la vitrina pública.
          </p>
        </div>
        <Link href="/comerciante/vitrina/nueva">
          <Button variant="primary" size="sm">+ Subir video</Button>
        </Link>
      </div>

      {/* Aviso */}
      {aviso && (
        <div className={[
          'rounded-xl border px-4 py-3 text-sm font-medium',
          aviso.tipo === 'exito'
            ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]'
            : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
        ].join(' ')}>
          {aviso.texto}
        </div>
      )}

      {/* Error */}
      {error && !cargando && (
        <div className="rounded-xl border border-[#C0392B]/30 bg-[#C0392B]/5 px-4 py-4 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : publicaciones.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1A1A1A]/5 text-3xl">
              🎥
            </div>
            <p className="text-base font-semibold text-[#1A1A1A]/60">Aún no tienes videos en la Vitrina</p>
            <p className="mt-1 text-sm text-[#1A1A1A]/40">
              Muestra la calidad de tus productos o servicios con un video corto.
            </p>
            <Link href="/comerciante/vitrina/nueva" className="mt-5 inline-block">
              <Button variant="primary" size="sm">Subir mi primer video</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]/5">
            {publicaciones.map((p) => (
              <div
                key={p.id}
                className={[
                  'flex items-center gap-4 p-4 transition-colors',
                  p.activa ? 'hover:bg-[#F8F5F0]/60' : 'bg-[#1A1A1A]/[0.02] opacity-75',
                ].join(' ')}
              >
                {/* Miniatura del video (usamos poster o fallback gris) */}
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-200">
                  {p.videoPosterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.videoPosterUrl} alt={p.titulo} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  )}
                  {/* Etiqueta de Inactivo */}
                  {!p.activa && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M1 1l22 22M9.88 9.88a3 3 0 104.24 4.24M10.73 5.08A10.43 10.43 0 0112 5c7 0 10 7 10 7a13.16 13.16 0 01-1.67 2.68M6.61 6.61A13.526 13.526 0 002 12s3 7 10 7a9.74 9.74 0 005.39-1.61" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>

                {/* Detalles principales */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="truncate font-semibold text-[#1A1A1A]">{p.titulo}</h3>
                  <div className="mt-1 flex items-center gap-4 text-xs font-medium text-[#1A1A1A]/50">
                    <span className="flex items-center gap-1.5" title="Vistas">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      {p.totalVistas || 0}
                    </span>
                    <span className="flex items-center gap-1.5" title="Me gusta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      {p.totalLikes || 0}
                    </span>
                    <span className="flex items-center gap-1.5" title="Comentarios">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {p.totalComentarios || 0}
                    </span>
                    <span className="flex items-center gap-1.5" title="Compartidos">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {p.totalCompartidos || 0}
                    </span>
                  </div>
                  {p.producto && (
                    <p className="mt-2 truncate text-xs font-medium text-[#2D6A4F]">
                      🔗 Producto vinculado: {p.producto.nombre}
                    </p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-col items-end gap-2 md:flex-row md:items-center">
                  <Link href={`/comerciante/vitrina/${p.id}/editar`}>
                    <Button variant="secondary" size="sm">Editar</Button>
                  </Link>
                  <Button
                    variant={p.activa ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => setPendienteToggle(p)}
                    loading={procesandoId === p.id}
                    disabled={procesandoId !== null}
                    className={p.activa ? 'text-[#C0392B] hover:text-[#A93226]' : ''}
                  >
                    {p.activa ? 'Ocultar' : 'Mostrar'}
                  </Button>
                  <button
                    onClick={() => setPendienteEliminar(p)}
                    className="ml-2 rounded-lg p-1.5 text-[#1A1A1A]/30 transition hover:bg-[#C0392B]/10 hover:text-[#C0392B]"
                    title="Eliminar publicación"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendienteToggle && (
        <ModalConfirmacion
          titulo={pendienteToggle.activa ? 'Ocultar video' : 'Mostrar video'}
          mensaje={`¿Seguro que quieres ${pendienteToggle.activa ? 'ocultar' : 'volver a mostrar'} este video en la Vitrina pública?`}
          onCancelar={() => setPendienteToggle(null)}
          onConfirmar={confirmarToggleActivo}
          confirmando={procesandoId === pendienteToggle.id}
          destructivo={pendienteToggle.activa}
        />
      )}

      {pendienteEliminar && (
        <ModalConfirmacion
          titulo="Eliminar video"
          mensaje="Esta acción es irreversible y se perderán todos los me gusta, comentarios y visualizaciones del video. ¿Seguro que quieres eliminarlo?"
          onCancelar={() => setPendienteEliminar(null)}
          onConfirmar={confirmarEliminar}
          confirmando={procesandoId === pendienteEliminar.id}
          destructivo={true}
        />
      )}
    </div>
  )
}
