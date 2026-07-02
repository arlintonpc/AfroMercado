'use client'

import { useEffect, useRef, useState } from 'react'
import {
  listarComplementos, crearGrupoComplemento, actualizarGrupoComplemento,
  eliminarGrupoComplemento, crearItemComplemento, actualizarItemComplemento,
  eliminarItemComplemento, subirImagenItemComplemento, copiarGrupoATodos,
  type GrupoComplemento, type ItemComplemento,
} from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'

interface Props {
  productoId: number
  nombreProducto: string
  onClose: () => void
}

function mensajeError(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

export default function GestorComplementos({ productoId, nombreProducto, onClose }: Props) {
  const [grupos, setGrupos] = useState<GrupoComplemento[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [nuevoGrupo, setNuevoGrupo] = useState({ nombre: '', minimo: 0, maximo: 1, requerido: false })
  const [mostrarFormGrupo, setMostrarFormGrupo] = useState(false)
  const [nuevoItem, setNuevoItem] = useState<Record<number, { nombre: string; precio: string; icono: string }>>({})
  const [editandoGrupo, setEditandoGrupo] = useState<number | null>(null)
  const [editGrupo, setEditGrupo] = useState({ nombre: '', minimo: 0, maximo: 1, requerido: false })

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)

    listarComplementos(productoId)
      .then(g => {
        if (!activo) return
        setGrupos(g)
      })
      .catch(err => {
        if (!activo) return
        setError(mensajeError(err, 'No se pudieron cargar los complementos.'))
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => { activo = false }
  }, [productoId])

  async function agregarGrupo() {
    if (!nuevoGrupo.nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const g = await crearGrupoComplemento(productoId, nuevoGrupo)
      setGrupos(prev => [...prev, g])
      setNuevoGrupo({ nombre: '', minimo: 0, maximo: 1, requerido: false })
      setMostrarFormGrupo(false)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear el grupo de complementos.'))
    } finally { setGuardando(false) }
  }

  async function guardarEditGrupo(grupoId: number) {
    setGuardando(true)
    setError(null)
    try {
      const updated = await actualizarGrupoComplemento(grupoId, editGrupo)
      setGrupos(prev => prev.map(g => g.id === grupoId ? { ...g, ...updated } : g))
      setEditandoGrupo(null)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo actualizar el grupo.'))
    } finally { setGuardando(false) }
  }

  async function toggleActivo(grupo: GrupoComplemento) {
    setError(null)
    try {
      const updated = await actualizarGrupoComplemento(grupo.id, { activo: !grupo.activo })
      setGrupos(prev => prev.map(g => g.id === grupo.id ? updated : g))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cambiar el estado del grupo.'))
    }
  }

  async function borrarGrupo(grupoId: number) {
    if (!confirm('¿Eliminar este grupo y todos sus ítems?')) return
    setError(null)
    try {
      await eliminarGrupoComplemento(grupoId)
      setGrupos(prev => prev.filter(g => g.id !== grupoId))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo eliminar el grupo.'))
    }
  }

  async function agregarItem(grupoId: number) {
    const f = nuevoItem[grupoId]
    if (!f?.nombre?.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const item = await crearItemComplemento(grupoId, {
        nombre: f.nombre.trim(),
        icono: f.icono?.trim() || undefined,
        precio: parseFloat(f.precio) || 0,
      })
      setGrupos(prev => prev.map(g => g.id === grupoId ? { ...g, items: [...g.items, item] } : g))
      setNuevoItem(prev => ({ ...prev, [grupoId]: { nombre: '', precio: '', icono: '' } }))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear el item de complemento.'))
    } finally { setGuardando(false) }
  }

  async function toggleItem(grupoId: number, item: ItemComplemento) {
    setError(null)
    try {
      const updated = await actualizarItemComplemento(item.id, { disponible: !item.disponible })
      setGrupos(prev => prev.map(g => g.id === grupoId
        ? { ...g, items: g.items.map(i => i.id === item.id ? updated : i) }
        : g
      ))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo actualizar el item.'))
    }
  }

  async function borrarItem(grupoId: number, itemId: number) {
    setError(null)
    try {
      await eliminarItemComplemento(itemId)
      setGrupos(prev => prev.map(g => g.id === grupoId
        ? { ...g, items: g.items.filter(i => i.id !== itemId) }
        : g
      ))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo eliminar el item.'))
    }
  }

  async function handleImagenItem(grupoId: number, item: ItemComplemento, file: File) {
    setSubiendoImagen(item.id)
    setError(null)
    try {
      const updated = await subirImagenItemComplemento(item.id, file)
      setGrupos(prev => prev.map(g => g.id === grupoId
        ? { ...g, items: g.items.map(i => i.id === item.id ? { ...i, imagenUrl: updated.imagenUrl } : i) }
        : g
      ))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo subir la imagen del complemento.'))
    } finally { setSubiendoImagen(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Complementos</h2>
            <p className="text-sm text-gray-500">{nombreProducto}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {cargando ? (
            <p className="text-center text-gray-400 py-8">Cargando...</p>
          ) : grupos.length === 0 && !mostrarFormGrupo ? (
            <p className="text-center text-gray-400 py-8">Sin grupos de complementos aún.</p>
          ) : (
            grupos.map(grupo => (
              <div key={grupo.id} className="border rounded-xl overflow-hidden">
                {/* Cabecera grupo */}
                {editandoGrupo === grupo.id ? (
                  <div className="px-4 py-3 bg-amber-50 border-b space-y-3">
                    <input
                      className="w-full border rounded-lg px-3 py-1.5 text-sm font-semibold"
                      value={editGrupo.nombre}
                      onChange={e => setEditGrupo(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre del grupo"
                    />
                    <div className="flex gap-3 items-center">
                      <label className="text-xs text-gray-600 flex-1">
                        Mínimo
                        <input type="number" min="0" className="mt-1 w-full border rounded-lg px-2 py-1 text-sm"
                          value={editGrupo.minimo}
                          onChange={e => setEditGrupo(p => ({ ...p, minimo: parseInt(e.target.value) || 0 }))} />
                      </label>
                      <label className="text-xs text-gray-600 flex-1">
                        Máximo <span className="text-gray-400">(cuántas puede pedir)</span>
                        <input type="number" min="1" className="mt-1 w-full border rounded-lg px-2 py-1 text-sm"
                          value={editGrupo.maximo}
                          onChange={e => setEditGrupo(p => ({ ...p, maximo: parseInt(e.target.value) || 1 }))} />
                      </label>
                      <label className="flex flex-col items-center gap-1 text-xs text-gray-600 cursor-pointer pt-4">
                        <input type="checkbox" className="w-4 h-4"
                          checked={editGrupo.requerido}
                          onChange={e => setEditGrupo(p => ({ ...p, requerido: e.target.checked }))} />
                        Requerido
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditandoGrupo(null)} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600">Cancelar</button>
                      <button onClick={() => guardarEditGrupo(grupo.id)} disabled={guardando}
                        className="flex-1 bg-[#1B4332] text-white rounded-lg py-1.5 text-sm font-medium disabled:opacity-50">
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">{grupo.nombre}</p>
                      <p className="text-xs text-gray-500">
                        {grupo.requerido ? 'Requerido' : 'Opcional'} · mín {grupo.minimo} · máx {grupo.maximo}
                        <button
                          onClick={() => { setEditandoGrupo(grupo.id); setEditGrupo({ nombre: grupo.nombre, minimo: grupo.minimo, maximo: grupo.maximo, requerido: grupo.requerido }) }}
                          className="ml-2 text-[#2D6A4F] underline hover:no-underline"
                        >editar</button>
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const r = await copiarGrupoATodos(grupo.id)
                        alert(`✅ Grupo "${grupo.nombre}" copiado a ${r.productosActualizados} plato${r.productosActualizados !== 1 ? 's' : ''} más.`)
                      }}
                      className="text-xs px-2 py-1 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                      title="Copiar este grupo a todos tus platos Express"
                    >
                      Copiar a todos
                    </button>
                    <button onClick={() => toggleActivo(grupo)}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${grupo.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {grupo.activo ? 'Activo' : 'Oculto'}
                    </button>
                    <button onClick={() => borrarGrupo(grupo.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                  </div>
                )}

                {/* Ítems */}
                <div className="divide-y">
                  {grupo.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                      {/* Miniatura con botón de cambio */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => fileInputRefs.current[item.id]?.click()}
                          className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-50 hover:border-[#2D6A4F] transition group"
                          title="Cambiar imagen"
                        >
                          {subiendoImagen === item.id ? (
                            <div className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                          ) : item.imagenUrl ? (
                            <img src={item.imagenUrl} alt={item.nombre} className="w-full h-full object-cover" />
                          ) : item.icono ? (
                            <span className="text-xl">{item.icono}</span>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                          )}
                        </button>
                        {/* overlay cámara */}
                        {!subiendoImagen && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#2D6A4F] rounded-full flex items-center justify-center pointer-events-none">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          </div>
                        )}
                        <input
                          ref={el => { fileInputRefs.current[item.id] = el }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) handleImagenItem(grupo.id, item, f)
                            e.target.value = ''
                          }}
                        />
                      </div>

                      <span className={`flex-1 text-sm ${item.disponible ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                        {item.nombre}
                      </span>
                      <span className="text-sm font-medium text-[#2D6A4F]">
                        {item.precio > 0 ? `+${formatearPrecio(item.precio)}` : 'Gratis'}
                      </span>
                      <button onClick={() => toggleItem(grupo.id, item)} className="text-xs text-gray-400 hover:text-gray-700">
                        {item.disponible ? '⏸' : '▶'}
                      </button>
                      <button onClick={() => borrarItem(grupo.id, item.id)} className="text-red-300 hover:text-red-500">×</button>
                    </div>
                  ))}
                </div>

                {/* Formulario nuevo ítem */}
                <div className="px-4 py-3 bg-gray-50 space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="w-12 border rounded-lg px-2 py-1.5 text-center text-xl"
                      placeholder="🥤"
                      maxLength={2}
                      value={nuevoItem[grupo.id]?.icono ?? ''}
                      onChange={e => setNuevoItem(prev => ({ ...prev, [grupo.id]: { ...prev[grupo.id], icono: e.target.value } }))}
                      title="Emoji (opcional si subes foto)"
                    />
                    <input
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Ej: Jugo de borojó"
                      value={nuevoItem[grupo.id]?.nombre ?? ''}
                      onChange={e => setNuevoItem(prev => ({ ...prev, [grupo.id]: { ...prev[grupo.id], nombre: e.target.value } }))}
                      onKeyDown={e => e.key === 'Enter' && agregarItem(grupo.id)}
                    />
                    <input
                      className="w-24 border rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Precio"
                      type="number"
                      min="0"
                      value={nuevoItem[grupo.id]?.precio ?? ''}
                      onChange={e => setNuevoItem(prev => ({ ...prev, [grupo.id]: { ...prev[grupo.id], precio: e.target.value } }))}
                      onKeyDown={e => e.key === 'Enter' && agregarItem(grupo.id)}
                    />
                    <button
                      onClick={() => agregarItem(grupo.id)}
                      disabled={guardando}
                      className="bg-[#2D6A4F] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                    >+</button>
                  </div>
                  <p className="text-xs text-gray-400">Después de crear el ítem, haz click en el cuadro para subir su foto.</p>
                </div>
              </div>
            ))
          )}

          {/* Formulario nuevo grupo */}
          {mostrarFormGrupo && (
            <div className="border-2 border-dashed border-[#2D6A4F] rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-800">Nuevo grupo</h3>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Nombre del grupo (ej: Bebidas, Salsas)"
                value={nuevoGrupo.nombre}
                onChange={e => setNuevoGrupo(prev => ({ ...prev, nombre: e.target.value }))}
              />
              <div className="flex gap-3">
                <label className="flex-1 text-xs text-gray-600">
                  Mínimo
                  <input type="number" min="0" className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm"
                    value={nuevoGrupo.minimo}
                    onChange={e => setNuevoGrupo(prev => ({ ...prev, minimo: parseInt(e.target.value) || 0 }))} />
                </label>
                <label className="flex-1 text-xs text-gray-600">
                  Máximo
                  <input type="number" min="1" className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm"
                    value={nuevoGrupo.maximo}
                    onChange={e => setNuevoGrupo(prev => ({ ...prev, maximo: parseInt(e.target.value) || 1 }))} />
                </label>
                <label className="flex items-end gap-2 pb-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4"
                    checked={nuevoGrupo.requerido}
                    onChange={e => setNuevoGrupo(prev => ({ ...prev, requerido: e.target.checked }))} />
                  Requerido
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMostrarFormGrupo(false)} className="flex-1 border rounded-lg py-2 text-sm text-gray-600">Cancelar</button>
                <button onClick={agregarGrupo} disabled={guardando || !nuevoGrupo.nombre.trim()}
                  className="flex-1 bg-[#1B4332] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                  Crear grupo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t">
          <button
            onClick={() => setMostrarFormGrupo(true)}
            disabled={mostrarFormGrupo}
            className="w-full border-2 border-dashed border-[#2D6A4F] text-[#2D6A4F] rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-[#2D6A4F]/5 transition"
          >
            + Agregar grupo de complementos
          </button>
        </div>
      </div>
    </div>
  )
}
