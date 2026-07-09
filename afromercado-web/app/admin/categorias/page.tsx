'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Categoria {
  id: number
  nombre: string
  slug: string
  icono: string | null
  activa: boolean
  grupo: 'ANCESTRAL' | 'LOCAL'
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminCategoriasPage() {
  const [categorias, setCategorias]     = useState<Categoria[]>([])
  const [cargando, setCargando]         = useState(true)
  const [procesandoId, setProcesando]   = useState<number | null>(null)
  const [aviso, setAviso]               = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Formulario crear
  const [nombre, setNombre]             = useState('')
  const [icono, setIcono]               = useState('')
  const [grupo, setGrupo]               = useState<'ANCESTRAL' | 'LOCAL'>('ANCESTRAL')
  const [creando, setCreando]           = useState(false)

  // Edición inline
  const [editandoId, setEditandoId]     = useState<number | null>(null)
  const [editNombre, setEditNombre]     = useState('')
  const [editIcono, setEditIcono]       = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await apiFetch<{ ok: boolean; data: Categoria[] }>('/admin/categorias')
      setCategorias(res.data ?? [])
    } catch { /**/ } finally {
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
    if (!nombre.trim()) return
    setCreando(true)
    try {
      await apiFetch('/admin/categorias', { method: 'POST', body: { nombre: nombre.trim(), icono: icono.trim() || null, grupo } })
      setNombre(''); setIcono(''); setGrupo('ANCESTRAL')
      setAviso({ tipo: 'exito', texto: 'Categoría creada.' })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo crear.' })
    } finally {
      setCreando(false)
    }
  }

  async function toggleActivo(c: Categoria) {
    setProcesando(c.id)
    try {
      await apiFetch(`/admin/categorias/${c.id}/activo`, { method: 'PATCH' })
      setAviso({ tipo: 'exito', texto: `Categoría ${c.activa ? 'desactivada' : 'activada'}.` })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al actualizar.' })
    } finally {
      setProcesando(null)
    }
  }

  async function cambiarGrupo(c: Categoria) {
    const nuevoGrupo = c.grupo === 'ANCESTRAL' ? 'LOCAL' : 'ANCESTRAL'
    setProcesando(c.id)
    try {
      await apiFetch(`/admin/categorias/${c.id}/grupo`, { method: 'PATCH', body: { grupo: nuevoGrupo } })
      setAviso({ tipo: 'exito', texto: `Categoría movida a ${nuevoGrupo === 'ANCESTRAL' ? 'Productos Ancestrales' : 'Tienda Local'}.` })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al actualizar.' })
    } finally {
      setProcesando(null)
    }
  }

  function iniciarEdicion(c: Categoria) {
    setEditandoId(c.id)
    setEditNombre(c.nombre)
    setEditIcono(c.icono ?? '')
  }

  async function guardarEdicion(id: number) {
    setGuardandoEdit(true)
    try {
      await apiFetch(`/admin/categorias/${id}`, {
        method: 'PATCH',
        body: { nombre: editNombre.trim(), icono: editIcono.trim() || null },
      })
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
          Categorías
        </h1>
        <p className="mt-1 text-sm text-[#1A1A1A]/60">
          {categorias.length > 0
            ? `${categorias.filter((c) => c.activa).length} activas de ${categorias.length} totales.`
            : 'Organización de productos del marketplace.'}
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

      {/* Formulario nueva categoría */}
      <form
        onSubmit={crear}
        className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm px-5 py-4"
      >
        <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Nueva categoría</p>
        <div className="flex flex-wrap gap-3">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (ej. Aceites del Pacífico)"
            required
            className="flex-1 min-w-[180px] rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
          />
          <input
            value={icono}
            onChange={(e) => setIcono(e.target.value)}
            placeholder="Ícono emoji (ej. 🌺)"
            maxLength={4}
            className="w-32 rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm text-center"
          />
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value as 'ANCESTRAL' | 'LOCAL')}
            className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
          >
            <option value="ANCESTRAL">🌿 Ancestral</option>
            <option value="LOCAL">🛍️ Tienda Local</option>
          </select>
          <Button type="submit" variant="primary" size="sm" loading={creando} disabled={!nombre.trim()}>
            Crear
          </Button>
        </div>
      </form>

      {/* Lista */}
      <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : categorias.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[#1A1A1A]/45">Sin categorías. Crea la primera arriba.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                <th className="px-4 py-3 font-semibold">Ícono</th>
                <th className="px-4 py-3 font-semibold">Nombre / Slug</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Grupo</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => {
                const editando = editandoId === c.id
                return (
                  <tr
                    key={c.id}
                    className={[
                      'border-b border-[#1A1A1A]/5 last:border-0 transition-colors',
                      c.activa ? 'hover:bg-[#F8F5F0]/60' : 'opacity-55',
                    ].join(' ')}
                  >
                    {/* Ícono */}
                    <td className="px-4 py-3">
                      {editando ? (
                        <input
                          value={editIcono}
                          onChange={(e) => setEditIcono(e.target.value)}
                          maxLength={4}
                          className="w-14 rounded border border-[#1A1A1A]/15 px-2 py-1 text-center text-sm"
                        />
                      ) : (
                        <span className="text-xl">{c.icono ?? '—'}</span>
                      )}
                    </td>

                    {/* Nombre / Slug */}
                    <td className="px-4 py-3">
                      {editando ? (
                        <input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="rounded border border-[#1A1A1A]/15 px-2 py-1 text-sm w-full max-w-[220px]"
                        />
                      ) : (
                        <>
                          <p className="font-medium text-[#1A1A1A]">{c.nombre}</p>
                          <p className="text-xs text-[#1A1A1A]/40 font-mono">{c.slug}</p>
                        </>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        c.activa
                          ? 'border-[#52B788]/30 bg-[#52B788]/10 text-[#2D6A4F]'
                          : 'border-[#1A1A1A]/15 bg-[#1A1A1A]/5 text-[#1A1A1A]/45',
                      ].join(' ')}>
                        {c.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>

                    {/* Grupo */}
                    <td className="px-4 py-3">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        c.grupo === 'LOCAL'
                          ? 'border-[#D4A017]/40 bg-[#D4A017]/10 text-[#8A6410]'
                          : 'border-[#2D6A4F]/30 bg-[#2D6A4F]/10 text-[#1B4332]',
                      ].join(' ')}>
                        {c.grupo === 'LOCAL' ? '🛍️ Tienda Local' : '🌿 Ancestral'}
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
                              onClick={() => guardarEdicion(c.id)}
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
                              onClick={() => iniciarEdicion(c)}
                              disabled={procesandoId !== null}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => cambiarGrupo(c)}
                              loading={procesandoId === c.id}
                              disabled={procesandoId !== null}
                            >
                              {c.grupo === 'LOCAL' ? 'Mover a Ancestral' : 'Mover a Tienda Local'}
                            </Button>
                            <Button
                              variant={c.activa ? 'danger' : 'secondary'}
                              size="sm"
                              onClick={() => toggleActivo(c)}
                              loading={procesandoId === c.id}
                              disabled={procesandoId !== null}
                            >
                              {c.activa ? 'Desactivar' : 'Activar'}
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
        )}
      </div>
    </div>
  )
}
