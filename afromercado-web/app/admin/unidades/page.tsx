'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  listarUnidadesAdmin,
  crearUnidadAdmin,
  actualizarUnidadAdmin,
  toggleActivoUnidadAdmin,
  type UnidadAdmin,
} from '@/lib/api/admin'

export default function AdminUnidadesPage() {
  const [unidades, setUnidades]       = useState<UnidadAdmin[]>([])
  const [cargando, setCargando]       = useState(true)
  const [procesandoId, setProcesando] = useState<number | null>(null)
  const [aviso, setAviso]             = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Formulario crear
  const [etiqueta, setEtiqueta] = useState('')
  const [orden, setOrden]       = useState('')
  const [creando, setCreando]   = useState(false)

  // Edición inline
  const [editandoId, setEditandoId]       = useState<number | null>(null)
  const [editEtiqueta, setEditEtiqueta]   = useState('')
  const [editOrden, setEditOrden]         = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const data = await listarUnidadesAdmin()
      setUnidades(data.sort((a, b) => a.orden - b.orden))
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudieron cargar las unidades.' })
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

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (!etiqueta.trim()) return
    setCreando(true)
    try {
      await crearUnidadAdmin({ etiqueta: etiqueta.trim(), orden: orden ? Number(orden) : undefined })
      setEtiqueta(''); setOrden('')
      setAviso({ tipo: 'exito', texto: 'Unidad creada.' })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo crear.' })
    } finally {
      setCreando(false)
    }
  }

  async function toggleActivo(u: UnidadAdmin) {
    setProcesando(u.id)
    try {
      await toggleActivoUnidadAdmin(u.id)
      setAviso({ tipo: 'exito', texto: `Unidad ${u.activa ? 'desactivada' : 'activada'}.` })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al actualizar.' })
    } finally {
      setProcesando(null)
    }
  }

  function iniciarEdicion(u: UnidadAdmin) {
    setEditandoId(u.id)
    setEditEtiqueta(u.etiqueta)
    setEditOrden(String(u.orden))
  }

  async function guardarEdicion(id: number) {
    setGuardandoEdit(true)
    try {
      await actualizarUnidadAdmin(id, { etiqueta: editEtiqueta.trim(), orden: Number(editOrden) || 0 })
      setEditandoId(null)
      setAviso({ tipo: 'exito', texto: 'Cambios guardados.' })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar.' })
    } finally {
      setGuardandoEdit(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Unidades de venta
        </h1>
        <p className="mt-1 text-sm text-[#1A1A1A]/60">
          {unidades.length > 0
            ? `${unidades.filter((u) => u.activa).length} activas de ${unidades.length} totales.`
            : 'Cómo pueden vender sus productos los comerciantes (por kilo, por unidad, por manojo…).'}
        </p>
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

      {/* Formulario nueva unidad */}
      <form
        onSubmit={crear}
        className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm px-5 py-4"
      >
        <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Nueva unidad</p>
        <div className="flex flex-wrap gap-3">
          <input
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Nombre (ej. Bulto, Caja, Metro)"
            required
            className="flex-1 min-w-[180px] rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
          />
          <input
            value={orden}
            onChange={(e) => setOrden(e.target.value.replace(/\D/g, ''))}
            placeholder="Orden (opcional)"
            className="w-40 rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
          />
          <Button type="submit" variant="primary" size="sm" loading={creando} disabled={!etiqueta.trim()}>
            Crear
          </Button>
        </div>
        <p className="mt-2 text-xs text-[#1A1A1A]/45">
          El código interno se genera automáticamente a partir del nombre y no se puede cambiar después.
        </p>
      </form>

      {/* Lista */}
      <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : unidades.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[#1A1A1A]/45">Sin unidades. Crea la primera arriba.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Orden</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => {
                const editando = editandoId === u.id
                return (
                  <tr
                    key={u.id}
                    className={[
                      'border-b border-[#1A1A1A]/5 last:border-0 transition-colors',
                      u.activa ? 'hover:bg-[#F8F5F0]/60' : 'opacity-55',
                    ].join(' ')}
                  >
                    {/* Nombre */}
                    <td className="px-4 py-3">
                      {editando ? (
                        <input
                          value={editEtiqueta}
                          onChange={(e) => setEditEtiqueta(e.target.value)}
                          className="rounded border border-[#1A1A1A]/15 px-2 py-1 text-sm w-full max-w-[220px]"
                        />
                      ) : (
                        <p className="font-medium text-[#1A1A1A]">{u.etiqueta}</p>
                      )}
                    </td>

                    {/* Código */}
                    <td className="px-4 py-3">
                      <p className="text-xs text-[#1A1A1A]/40 font-mono">{u.codigo}</p>
                    </td>

                    {/* Orden */}
                    <td className="px-4 py-3">
                      {editando ? (
                        <input
                          value={editOrden}
                          onChange={(e) => setEditOrden(e.target.value.replace(/\D/g, ''))}
                          className="w-16 rounded border border-[#1A1A1A]/15 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-[#1A1A1A]/60">{u.orden}</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        u.activa
                          ? 'border-[#52B788]/30 bg-[#52B788]/10 text-[#2D6A4F]'
                          : 'border-[#1A1A1A]/15 bg-[#1A1A1A]/5 text-[#1A1A1A]/45',
                      ].join(' ')}>
                        {u.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {editando ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => guardarEdicion(u.id)}
                              loading={guardandoEdit}
                            >
                              Guardar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditandoId(null)}
                              disabled={guardandoEdit}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => iniciarEdicion(u)}
                              disabled={procesandoId !== null}
                            >
                              Editar
                            </Button>
                            <Button
                              variant={u.activa ? 'danger' : 'secondary'}
                              size="sm"
                              onClick={() => toggleActivo(u)}
                              loading={procesandoId === u.id}
                              disabled={procesandoId !== null}
                            >
                              {u.activa ? 'Desactivar' : 'Activar'}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
