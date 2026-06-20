'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Rol = 'COMPRADOR' | 'COMERCIANTE' | 'REPARTIDOR' | 'ADMIN'

interface Usuario {
  id: number
  nombre: string
  email: string
  telefono?: string | null
  rol: Rol
  activo: boolean
  createdAt: string
}

interface Pagina {
  items: Usuario[]
  total: number
  paginas: number
  pagina: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROL_COLOR: Record<Rol, string> = {
  COMPRADOR:   'bg-blue-50 text-blue-700 border-blue-200',
  COMERCIANTE: 'bg-[#52B788]/15 text-[#2D6A4F] border-[#52B788]/30',
  REPARTIDOR:  'bg-purple-50 text-purple-700 border-purple-200',
  ADMIN:       'bg-[#D4A017]/15 text-[#9B7300] border-[#D4A017]/30',
}

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminUsuariosPage() {
  const [pagina, setPagina] = useState<Pagina | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [filtroRol, setFiltroRol] = useState<Rol | ''>('')
  const [filtroActivo, setFiltroActivo] = useState<'' | 'true' | 'false'>('')
  const [busqueda, setBusqueda] = useState('')
  const [q, setQ] = useState('')
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [modalBloqueo, setModalBloqueo] = useState<Usuario | null>(null)
  const [motivoBloqueo, setMotivoBloqueo] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const params = new URLSearchParams()
    params.set('pagina', String(paginaActual))
    if (filtroRol)   params.set('rol', filtroRol)
    if (filtroActivo) params.set('activo', filtroActivo)
    if (q)           params.set('q', q)
    try {
      const resp = await apiFetch<{ ok: boolean; data: Pagina }>(
        `/admin/usuarios?${params.toString()}`,
      )
      setPagina(resp.data)
    } catch {
      // silencioso
    } finally {
      setCargando(false)
    }
  }, [paginaActual, filtroRol, filtroActivo, q])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  function iniciarToggle(usuario: Usuario) {
    if (usuario.activo) {
      setMotivoBloqueo('')
      setModalBloqueo(usuario)
    } else {
      void confirmarToggle(usuario, '')
    }
  }

  async function confirmarToggle(usuario: Usuario, motivo: string) {
    setModalBloqueo(null)
    setProcesandoId(usuario.id)
    try {
      const resp = await apiFetch<{ ok: boolean; data: { activo: boolean } }>(
        `/admin/usuarios/${usuario.id}/activo`,
        { method: 'PATCH', body: motivo ? { motivo } : {} },
      )
      setAviso({ tipo: 'exito', texto: `Usuario ${resp.data.activo ? 'activado' : 'bloqueado'}.` })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo actualizar.' })
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
      <div>
        <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Usuarios
        </h1>
        <p className="mt-1 text-sm text-[#1A1A1A]/60">
          {pagina ? `${pagina.total} usuarios registrados.` : 'Gestión de cuentas del marketplace.'}
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

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={buscar} className="flex gap-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o email…"
            className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm w-52"
          />
          <Button type="submit" variant="secondary" size="sm">Buscar</Button>
        </form>
        <select
          value={filtroRol}
          onChange={(e) => { setFiltroRol(e.target.value as Rol | ''); setPaginaActual(1) }}
          className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los roles</option>
          <option value="COMPRADOR">Comprador</option>
          <option value="COMERCIANTE">Comerciante</option>
          <option value="REPARTIDOR">Repartidor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          value={filtroActivo}
          onChange={(e) => { setFiltroActivo(e.target.value as '' | 'true' | 'false'); setPaginaActual(1) }}
          className="rounded-lg border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
        >
          <option value="">Activos e inactivos</option>
          <option value="true">Solo activos</option>
          <option value="false">Solo bloqueados</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !pagina || pagina.items.length === 0 ? (
          <EmptyState titulo="Sin resultados" descripcion="Prueba con otros filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagina.items.map((u) => (
                  <tr key={u.id} className={[
                    'border-b border-[#1A1A1A]/5 last:border-0 transition-colors',
                    u.activo ? 'hover:bg-[#F8F5F0]/60' : 'bg-red-50/40 opacity-75',
                  ].join(' ')}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1A1A]">{u.nombre}</div>
                      <div className="text-xs text-[#1A1A1A]/50">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        ROL_COLOR[u.rol],
                      ].join(' ')}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60 text-xs">
                      {u.telefono ? `+57 ${u.telefono}` : <span className="text-[#1A1A1A]/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#1A1A1A]/50">{fecha(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        u.activo
                          ? 'bg-[#52B788]/10 text-[#2D6A4F] border-[#52B788]/30'
                          : 'bg-red-50 text-red-600 border-red-200',
                      ].join(' ')}>
                        {u.activo ? 'Activo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.rol !== 'ADMIN' && (
                        <Button
                          variant={u.activo ? 'danger' : 'secondary'}
                          size="sm"
                          onClick={() => iniciarToggle(u)}
                          loading={procesandoId === u.id}
                          disabled={procesandoId !== null}
                        >
                          {u.activo ? 'Bloquear' : 'Activar'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {pagina && pagina.paginas > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-[#1A1A1A]/5 px-5 py-4">
            <Button variant="secondary" size="sm" disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)}>
              ← Anterior
            </Button>
            <span className="text-sm text-[#1A1A1A]/60">{paginaActual} / {pagina.paginas}</span>
            <Button variant="secondary" size="sm" disabled={paginaActual === pagina.paginas} onClick={() => setPaginaActual(p => p + 1)}>
              Siguiente →
            </Button>
          </div>
        )}
      </div>

      {/* Modal motivo de bloqueo */}
      {modalBloqueo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Bloquear a {modalBloqueo.nombre}</h2>
            <p className="mt-1 text-sm text-[#1A1A1A]/55">Sus productos dejarán de aparecer en el catálogo.</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">
                Motivo del bloqueo (opcional)
              </label>
              <textarea
                value={motivoBloqueo}
                onChange={(e) => setMotivoBloqueo(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
                placeholder="Ej: fraude detectado, spam, incumplimiento de términos..."
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalBloqueo(null)}
                className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmarToggle(modalBloqueo, motivoBloqueo)}
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold"
              >
                Confirmar bloqueo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
