'use client'

import { useCallback, useEffect, useState } from 'react'
import { listarComerciosAdmin, cambiarEstadoComercio, type ComercioAdmin } from '@/lib/api/admin'
import { activarIva, desactivarIva } from '@/lib/api/config-fiscal'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Modal de IVA ─────────────────────────────────────────────────────────────

function ModalIva({
  comercio,
  onCerrar,
  onGuardado,
}: {
  comercio: ComercioAdmin
  onCerrar: () => void
  onGuardado: () => void
}) {
  const activo = comercio.configFiscal?.ivaActivo ?? false
  const [porcentaje, setPorcentaje] = useState(String(comercio.configFiscal?.ivaPorcentaje ?? 19))
  const [regimen, setRegimen] = useState(comercio.configFiscal?.regimenTributario ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    const valor = parseFloat(porcentaje)
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      setError('El porcentaje debe ser un número entre 0 y 100.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await activarIva(comercio.id, { ivaPorcentaje: valor, regimenTributario: regimen.trim() || undefined })
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo activar el IVA.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar() {
    setGuardando(true)
    setError(null)
    try {
      await desactivarIva(comercio.id)
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desactivar el IVA.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#1A1A1A]">IVA — {comercio.nombre}</h2>
        <p className="mt-1 text-sm text-[#1A1A1A]/55">
          {activo ? 'Este comercio tiene IVA activo.' : 'Este comercio no cobra IVA actualmente.'}
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[#1A1A1A]/70">Porcentaje de IVA</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
            className="w-full rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
          />
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-[#1A1A1A]/70">
            Régimen tributario <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={regimen}
            onChange={(e) => setRegimen(e.target.value)}
            placeholder="Ej: Régimen común"
            className="w-full rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
          />
        </div>

        {error && <p className="mt-3 text-xs text-[#C0392B]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]">
            Cancelar
          </button>
          {activo && (
            <button
              onClick={desactivar}
              disabled={guardando}
              className="rounded-lg border border-[#C0392B]/30 px-4 py-2 text-sm font-semibold text-[#C0392B] hover:bg-[#C0392B]/5 disabled:opacity-50"
            >
              Desactivar
            </button>
          )}
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235540] disabled:opacity-50"
          >
            {activo ? 'Guardar' : 'Activar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODULOS = [
  { value: '', label: 'Todos los módulos' },
  { value: 'hotel', label: '🏨 Hotel' },
  { value: 'tour', label: '🗺️ Tour' },
  { value: 'express', label: '🍽️ Express' },
  { value: 'transporte', label: '🛥️ Transporte' },
]

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function modulosBadges(c: ComercioAdmin) {
  const m: string[] = []
  if (c.configHotel) m.push('🏨')
  if (c.configTour) m.push('🗺️')
  if (c.configExpress) m.push('🍽️')
  if (c.configTransporte) m.push('🛥️')
  return m
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminComerciosPage() {
  const [comercios, setComercios] = useState<ComercioAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [modulo, setModulo] = useState('')
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [comercioIva, setComercioIva] = useState<ComercioAdmin | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await listarComerciosAdmin({
        pagina: paginaActual,
        q: q || undefined,
        estado: estado || undefined,
        modulo: modulo || undefined,
      })
      setComercios(r.comercios)
      setTotal(r.total)
      setTotalPaginas(r.totalPaginas)
    } catch {
      // silencioso
    } finally {
      setCargando(false)
    }
  }, [paginaActual, q, estado, modulo])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  async function toggleEstado(c: ComercioAdmin) {
    setProcesandoId(c.id)
    try {
      await cambiarEstadoComercio(c.id, !c.activo)
      setAviso({
        tipo: 'exito',
        texto: `Comercio "${c.nombre}" ${!c.activo ? 'activado' : 'suspendido'}.`,
      })
      void cargar()
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo actualizar el estado.',
      })
    } finally {
      setProcesandoId(null)
    }
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    setQ(busqueda.trim())
    setPaginaActual(1)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Comercios
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            {cargando ? 'Cargando…' : `${total} comercios registrados en el marketplace.`}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void cargar()}
          disabled={cargando}
        >
          Actualizar
        </Button>
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

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={buscar} className="flex gap-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm w-52 focus:outline-none focus:border-[#2D6A4F]"
          />
          <Button type="submit" variant="secondary" size="sm">Buscar</Button>
        </form>
        <select
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setPaginaActual(1) }}
          className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Suspendidos</option>
        </select>
        <select
          value={modulo}
          onChange={(e) => { setModulo(e.target.value); setPaginaActual(1) }}
          className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          {MODULOS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : comercios.length === 0 ? (
          <EmptyState
            titulo="Sin resultados"
            descripcion="Prueba con otros filtros o amplía la búsqueda."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                  <th className="px-4 py-3 font-semibold">Comercio</th>
                  <th className="px-4 py-3 font-semibold">Municipio</th>
                  <th className="px-4 py-3 font-semibold">Módulos</th>
                  <th className="px-4 py-3 font-semibold">Productos</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">IVA</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {comercios.map((c) => (
                  <tr
                    key={c.id}
                    className={[
                      'border-b border-[#1A1A1A]/5 last:border-0 transition-colors',
                      c.activo ? 'hover:bg-[#F8F5F0]/60' : 'bg-red-50/40 opacity-75',
                    ].join(' ')}
                  >
                    {/* Comercio */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1A1A]">{c.nombre}</div>
                      <div className="text-xs text-[#1A1A1A]/50">{c.usuario.email}</div>
                    </td>

                    {/* Municipio */}
                    <td className="px-4 py-3 text-[#1A1A1A]/70">{c.municipio}</td>

                    {/* Módulos */}
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5">
                        {modulosBadges(c).length > 0
                          ? modulosBadges(c).map((m, i) => (
                              <span key={i} className="text-base leading-none">{m}</span>
                            ))
                          : <span className="text-[#1A1A1A]/25 text-xs">—</span>
                        }
                      </div>
                    </td>

                    {/* Productos */}
                    <td className="px-4 py-3">
                      <span className={[
                        'text-sm font-semibold',
                        c._count.productos === 0 ? 'text-amber-600' : 'text-[#1A1A1A]',
                      ].join(' ')}>
                        {c._count.productos}
                      </span>
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3 text-xs text-[#1A1A1A]/50">{fecha(c.createdAt)}</td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        c.activo
                          ? 'border-[#52B788]/30 bg-[#52B788]/10 text-[#2D6A4F]'
                          : 'border-red-200 bg-red-50 text-red-600',
                      ].join(' ')}>
                        {c.activo ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>

                    {/* IVA */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setComercioIva(c)}
                        className={[
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                          c.configFiscal?.ivaActivo
                            ? 'border-[#D4A017]/40 bg-[#D4A017]/10 text-[#9B7300] hover:bg-[#D4A017]/20'
                            : 'border-[#1A1A1A]/12 bg-[#F8F5F0] text-[#1A1A1A]/45 hover:bg-[#1A1A1A]/5',
                        ].join(' ')}
                      >
                        {c.configFiscal?.ivaActivo ? `${Number(c.configFiscal.ivaPorcentaje)}%` : 'Inactivo'}
                      </button>
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={c.activo ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => toggleEstado(c)}
                        loading={procesandoId === c.id}
                        disabled={procesandoId !== null}
                      >
                        {c.activo ? 'Suspender' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-[#1A1A1A]/5 px-5 py-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={paginaActual === 1}
              onClick={() => setPaginaActual((p) => p - 1)}
            >
              ← Anterior
            </Button>
            <span className="text-sm text-[#1A1A1A]/60">
              {paginaActual} / {totalPaginas}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={paginaActual === totalPaginas}
              onClick={() => setPaginaActual((p) => p + 1)}
            >
              Siguiente →
            </Button>
          </div>
        )}
      </div>

      {comercioIva && (
        <ModalIva
          comercio={comercioIva}
          onCerrar={() => setComercioIva(null)}
          onGuardado={() => {
            setComercioIva(null)
            setAviso({ tipo: 'exito', texto: `IVA de "${comercioIva.nombre}" actualizado.` })
            void cargar()
          }}
        />
      )}
    </div>
  )
}
