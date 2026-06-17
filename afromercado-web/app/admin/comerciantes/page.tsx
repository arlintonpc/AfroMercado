'use client'

import { useCallback, useEffect, useState } from 'react'
import { listarComerciosAdmin, verificarComercianteAdmin, type AdminComercio } from '@/components/admin/api'

function formatearFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function BadgeVerificado({ verificado }: { verificado: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        verificado
          ? 'bg-[#52B788]/15 text-[#2D6A4F]'
          : 'bg-[#F39C12]/15 text-[#B7730A]',
      ].join(' ')}
    >
      {verificado ? 'Verificado' : 'Sin verificar'}
    </span>
  )
}

interface FilaComerciante {
  comercio: AdminComercio
  procesando: boolean
  onAccion: (comercio: AdminComercio, accion: 'VERIFICAR' | 'RECHAZAR') => void
}

function FilaComerciante({ comercio, procesando, onAccion }: FilaComerciante) {
  return (
    <tr className="border-b border-[#1A1A1A]/5 last:border-0 hover:bg-[#F8F5F0]/60">
      <td className="px-4 py-4 align-top">
        <div className="font-semibold text-[#1A1A1A]">{comercio.nombre}</div>
        <div className="mt-0.5 text-xs text-[#1A1A1A]/50">{formatearFecha(comercio.createdAt)}</div>
      </td>
      <td className="px-4 py-4 align-top text-sm text-[#1A1A1A]/70">
        {comercio.municipio}
      </td>
      <td className="px-4 py-4 align-top">
        <div className="text-sm font-medium text-[#1A1A1A]">{comercio.usuario.nombre}</div>
        <div className="text-xs text-[#1A1A1A]/50">{comercio.usuario.email}</div>
        {comercio.usuario.telefono && (
          <div className="text-xs text-[#1A1A1A]/50">{comercio.usuario.telefono}</div>
        )}
      </td>
      <td className="px-4 py-4 align-top text-center text-sm text-[#1A1A1A]/70">
        {comercio._count.productos}
      </td>
      <td className="px-4 py-4 align-top text-center text-sm text-[#1A1A1A]/70">
        {comercio.totalVentas}
      </td>
      <td className="px-4 py-4 align-top">
        <BadgeVerificado verificado={comercio.verificado} />
        {comercio.fotoDocumentoUrl && (
          <div className="mt-1.5">
            <a
              href={comercio.fotoDocumentoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#2D6A4F] underline underline-offset-2 hover:text-[#1d4d39]"
            >
              Ver documento
            </a>
          </div>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!comercio.verificado ? (
            <button
              type="button"
              onClick={() => onAccion(comercio, 'VERIFICAR')}
              disabled={procesando}
              className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#235540] disabled:opacity-50"
            >
              {procesando ? 'Procesando…' : 'Verificar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAccion(comercio, 'RECHAZAR')}
              disabled={procesando}
              className="rounded-lg border border-[#C0392B]/30 bg-[#C0392B]/5 px-3 py-1.5 text-xs font-semibold text-[#C0392B] transition-colors hover:bg-[#C0392B]/10 disabled:opacity-50"
            >
              {procesando ? 'Procesando…' : 'Quitar verificación'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function FilasSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-b border-[#1A1A1A]/5 last:border-0">
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-4 w-full animate-pulse rounded bg-[#1A1A1A]/8" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function ComerciantesAdminPage() {
  const [comercios, setComercios] = useState<AdminComercio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [soloSinVerificar, setSoloSinVerificar] = useState(false)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setComercios(await listarComerciosAdmin(soloSinVerificar))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [soloSinVerificar])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  async function handleAccion(comercio: AdminComercio, accion: 'VERIFICAR' | 'RECHAZAR') {
    const msg =
      accion === 'VERIFICAR'
        ? `¿Verificar el comercio "${comercio.nombre}"?`
        : `¿Quitar la verificación de "${comercio.nombre}"?`
    if (!window.confirm(msg)) return

    setProcesandoId(comercio.id)
    try {
      const actualizado = await verificarComercianteAdmin(comercio.id, accion)
      setComercios((prev) =>
        prev.map((c) => (c.id === comercio.id ? { ...c, verificado: actualizado.verificado } : c)),
      )
      setAviso({
        tipo: 'exito',
        texto:
          accion === 'VERIFICAR'
            ? `"${comercio.nombre}" verificado correctamente.`
            : `Verificación removida de "${comercio.nombre}".`,
      })
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al procesar' })
    } finally {
      setProcesandoId(null)
    }
  }

  const totalSinVerificar = comercios.filter((c) => !c.verificado).length

  return (
    <div className="flex flex-col gap-8">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Comerciantes
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Revisa y aprueba los comercios registrados en el marketplace.
          </p>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="rounded-xl border border-[#1A1A1A]/10 bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A] shadow-sm transition-colors hover:bg-[#F8F5F0] disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      {/* Aviso */}
      {aviso && (
        <div
          role="status"
          className={[
            'rounded-xl border px-4 py-3 text-sm font-medium',
            aviso.tipo === 'exito'
              ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]'
              : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
          ].join(' ')}
        >
          {aviso.texto}
        </div>
      )}

      {/* Filtro */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSoloSinVerificar(false)}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
            !soloSinVerificar
              ? 'bg-[#2D6A4F] text-white'
              : 'border border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/70 hover:bg-[#F8F5F0]',
          ].join(' ')}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setSoloSinVerificar(true)}
          className={[
            'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
            soloSinVerificar
              ? 'bg-[#2D6A4F] text-white'
              : 'border border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/70 hover:bg-[#F8F5F0]',
          ].join(' ')}
        >
          Por verificar
          {!cargando && totalSinVerificar > 0 && (
            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-xs font-bold',
                soloSinVerificar ? 'bg-white/20 text-white' : 'bg-[#F39C12]/20 text-[#B7730A]',
              ].join(' ')}
            >
              {totalSinVerificar}
            </span>
          )}
        </button>
      </div>

      {/* Tabla */}
      <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm">
        {error ? (
          <div className="px-5 py-8 text-center text-sm text-[#C0392B]">
            <p className="font-medium">{error}</p>
            <button
              type="button"
              onClick={cargar}
              className="mt-2 font-semibold underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        ) : !cargando && comercios.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-[#1A1A1A]">
              {soloSinVerificar ? 'No hay comercios pendientes de verificación' : 'No hay comercios registrados'}
            </p>
            <p className="mt-1 text-sm text-[#1A1A1A]/50">
              {soloSinVerificar
                ? 'Todos los comercios activos ya han sido verificados.'
                : 'Cuando alguien registre un comercio, aparecerá aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Municipio</th>
                  <th className="px-4 py-3 font-semibold">Propietario</th>
                  <th className="px-4 py-3 text-center font-semibold">Productos</th>
                  <th className="px-4 py-3 text-center font-semibold">Ventas</th>
                  <th className="px-4 py-3 font-semibold">Verificado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <FilasSkeleton />
                ) : (
                  comercios.map((comercio) => (
                    <FilaComerciante
                      key={comercio.id}
                      comercio={comercio}
                      procesando={procesandoId === comercio.id}
                      onAccion={handleAccion}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
