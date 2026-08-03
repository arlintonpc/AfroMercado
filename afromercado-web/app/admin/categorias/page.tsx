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
  grupo: 'ANCESTRAL' | 'LOCAL' | 'AGRO'
  padreId: number | null
  padre?: { id: number; nombre: string } | null
}

// "Grupo" es un enum viejo de 3 valores fijos (Ancestral/Tienda Local/Agro)
// que ya no se puede extender. Hoy solo "AGRO" tiene efecto real: decide si
// la categoría aparece en la vitrina /agro. Por eso la UI lo simplifica a
// un único interruptor "Agro sí/no" en vez de mostrar las 3 opciones.

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminCategoriasPage() {
  const [categorias, setCategorias]     = useState<Categoria[]>([])
  const [cargando, setCargando]         = useState(true)
  const [procesandoId, setProcesando]   = useState<number | null>(null)
  const [aviso, setAviso]               = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Formulario crear
  const [nombre, setNombre]             = useState('')
  const [icono, setIcono]               = useState('')
  const [esAgro, setEsAgro]             = useState(false)
  const [padreIdNuevo, setPadreIdNuevo] = useState('')
  const [creando, setCreando]           = useState(false)

  // Edición inline
  const [editandoId, setEditandoId]     = useState<number | null>(null)
  const [editNombre, setEditNombre]     = useState('')
  const [editIcono, setEditIcono]       = useState('')
  const [editPadreId, setEditPadreId]   = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  // Departamentos = categorías activas sin padre (contenedores de agrupación).
  // No incluye las categorías huérfanas desactivadas (residuos de antes de
  // existir esta jerarquía), esas solo aparecen en la tabla para su gestión.
  const departamentos = categorias.filter((c) => c.padreId === null && c.activa)

  // Filas de la tabla agrupadas visualmente: cada departamento seguido de sus
  // categorías hijas (en vez de una lista alfabética plana que mezcla todo).
  const filasAgrupadas = (() => {
    const todosLosPadres = categorias.filter((c) => c.padreId === null).sort((a, b) => a.nombre.localeCompare(b.nombre))
    const filas: Categoria[] = []
    for (const dep of todosLosPadres) {
      filas.push(dep)
      const hijas = categorias.filter((c) => c.padreId === dep.id).sort((a, b) => a.nombre.localeCompare(b.nombre))
      filas.push(...hijas)
    }
    return filas
  })()

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await apiFetch<{ ok: boolean; data: Categoria[] }>('/admin/categorias')
      setCategorias(res.data ?? [])
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudieron cargar las categorías.' })
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
    if (!nombre.trim()) return
    setCreando(true)
    try {
      await apiFetch('/admin/categorias', {
        method: 'POST',
        body: { nombre: nombre.trim(), icono: icono.trim() || null, grupo: esAgro ? 'AGRO' : 'ANCESTRAL', padreId: padreIdNuevo || null },
      })
      setNombre(''); setIcono(''); setEsAgro(false); setPadreIdNuevo('')
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

  async function toggleAgro(c: Categoria, marcar: boolean) {
    const nuevoGrupo = marcar ? 'AGRO' : 'ANCESTRAL'
    if (nuevoGrupo === c.grupo) return
    setProcesando(c.id)
    try {
      await apiFetch(`/admin/categorias/${c.id}/grupo`, { method: 'PATCH', body: { grupo: nuevoGrupo } })
      setAviso({ tipo: 'exito', texto: marcar ? 'Ahora aparece en la vitrina de Agro.' : 'Ya no aparece en la vitrina de Agro.' })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al actualizar.' })
    } finally {
      setProcesando(null)
    }
  }

  async function cambiarPadre(c: Categoria, nuevoPadreId: string) {
    const nuevo = nuevoPadreId === '' ? null : Number(nuevoPadreId)
    if (nuevo === c.padreId) return
    setProcesando(c.id)
    try {
      await apiFetch(`/admin/categorias/${c.id}`, { method: 'PATCH', body: { padreId: nuevo } })
      setAviso({ tipo: 'exito', texto: 'Departamento actualizado.' })
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
    setEditPadreId(c.padreId != null ? String(c.padreId) : '')
  }

  async function guardarEdicion(id: number) {
    setGuardandoEdit(true)
    try {
      await apiFetch(`/admin/categorias/${id}`, {
        method: 'PATCH',
        body: { nombre: editNombre.trim(), icono: editIcono.trim() || null, padreId: editPadreId || null },
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
          <label className="flex items-center gap-2 rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={esAgro}
              onChange={(e) => setEsAgro(e.target.checked)}
              className="w-4 h-4 rounded accent-[#2D6A4F]"
            />
            🌾 Aparece en Agro
          </label>
          <select
            value={padreIdNuevo}
            onChange={(e) => setPadreIdNuevo(e.target.value)}
            className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Es un departamento —</option>
            {departamentos.map((dep) => (
              <option key={dep.id} value={dep.id}>{dep.icono ? `${dep.icono} ` : ''}{dep.nombre}</option>
            ))}
          </select>
          <Button type="submit" variant="primary" size="sm" loading={creando} disabled={!nombre.trim()}>
            Crear
          </Button>
        </div>
        <p className="mt-2 text-xs text-[#1A1A1A]/45">
          Deja &quot;Departamento&quot; vacío para crear un departamento nuevo (ej. Tecnología); elige uno para crear una categoría hija dentro de él.
        </p>
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
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                <th className="px-4 py-3 font-semibold">Ícono</th>
                <th className="px-4 py-3 font-semibold">Nombre / Slug</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Departamento</th>
                <th className="px-4 py-3 font-semibold">Agro</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filasAgrupadas.map((c) => {
                const editando = editandoId === c.id
                const esDepartamento = c.padreId === null
                return (
                  <tr
                    key={c.id}
                    className={[
                      'border-b border-[#1A1A1A]/5 last:border-0 transition-colors',
                      esDepartamento ? 'bg-[#1B4332]/[0.04] border-t-2 border-t-[#1B4332]/10' : '',
                      c.activa ? 'hover:bg-[#F8F5F0]/60' : 'opacity-55',
                    ].join(' ')}
                  >
                    {/* Ícono */}
                    <td className={`px-4 py-3 ${esDepartamento ? '' : 'pl-8'}`}>
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
                          <p className={esDepartamento ? 'font-bold text-[#1B4332]' : 'font-medium text-[#1A1A1A]'}>
                            {!esDepartamento && <span className="text-[#1A1A1A]/30 mr-1">↳</span>}
                            {c.nombre}
                          </p>
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

                    {/* Departamento */}
                    <td className="px-4 py-3">
                      {c.padreId === null ? (
                        <span className="inline-flex items-center rounded-full border border-[#1B4332]/25 bg-[#1B4332]/5 px-2.5 py-0.5 text-xs font-semibold text-[#1B4332]">
                          Departamento
                        </span>
                      ) : (
                        <select
                          value={String(c.padreId)}
                          onChange={(e) => cambiarPadre(c, e.target.value)}
                          disabled={procesandoId !== null}
                          className="rounded-lg border border-[#1A1A1A]/15 bg-white px-2 py-1.5 text-xs disabled:opacity-50"
                        >
                          {departamentos.filter((d) => d.id !== c.id).map((dep) => (
                            <option key={dep.id} value={dep.id}>{dep.icono ? `${dep.icono} ` : ''}{dep.nombre}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Agro (único uso real que queda del viejo "grupo") */}
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={c.grupo === 'AGRO'}
                          onChange={(e) => toggleAgro(c, e.target.checked)}
                          disabled={procesandoId !== null}
                          className="w-4 h-4 rounded accent-[#52B788] disabled:opacity-50"
                        />
                        {c.grupo === 'AGRO' && (
                          <span className="inline-flex items-center rounded-full border border-[#52B788]/40 bg-[#52B788]/10 px-2.5 py-0.5 text-xs font-semibold text-[#1B4332]">
                            🌾 Agro
                          </span>
                        )}
                      </label>
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
          </div>
        )}
      </div>
    </div>
  )
}
