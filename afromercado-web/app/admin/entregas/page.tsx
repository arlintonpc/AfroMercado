'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { PasswordInput } from '@/components/ui/PasswordInput'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RepartidorSimple {
  id: number
  nombre: string
  telefono: string | null
}

interface RepartidorCreado {
  id: number
  nombre: string
  email: string
  telefono: string | null
  createdAt: string
}

interface EntregaAdmin {
  id: number
  estado: string
  direccion: string
  notas: string | null
  repartidorId: number | null
  repartidor: RepartidorSimple | null
  createdAt: string
  subPedido: {
    id: number
    comercio: { nombre: string }
    pedido: {
      id: number
      codigo?: string | null
      direccionTexto: string
      comprador: { nombre: string; telefono: string | null }
    }
    items: Array<{ cantidad: number; producto: { nombre: string } }>
  }
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ESTADO_BADGE: Record<string, string> = {
  ASIGNADA:  'bg-amber-50 text-amber-700 border-amber-200',
  RECOGIDA:  'bg-blue-50 text-blue-700 border-blue-200',
  EN_CAMINO: 'bg-purple-50 text-purple-700 border-purple-200',
  ENTREGADA: 'bg-[#52B788]/15 text-[#2D6A4F] border-[#52B788]/30',
  FALLIDA:   'bg-red-50 text-red-600 border-red-200',
}
const ESTADO_LABEL: Record<string, string> = {
  ASIGNADA: 'Asignada', RECOGIDA: 'Recogida', EN_CAMINO: 'En camino',
  ENTREGADA: 'Entregada', FALLIDA: 'Fallida',
}

function estaTerminal(estado: string) {
  return estado === 'ENTREGADA' || estado === 'FALLIDA'
}

// ─── Modal asignar repartidor ─────────────────────────────────────────────────

function ModalAsignar({
  entregaId,
  onAsignado,
  onCerrar,
}: {
  entregaId: number
  onAsignado: (entrega: EntregaAdmin) => void
  onCerrar: () => void
}) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<RepartidorSimple[]>([])
  const [buscando, setBuscando] = useState(false)
  const [asignando, setAsignando] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function buscar(termino: string) {
    if (!termino.trim()) { setResultados([]); return }
    setBuscando(true)
    try {
      const res = await apiFetch<{ ok: boolean; items: RepartidorSimple[] }>(
        `/admin/usuarios/buscar?q=${encodeURIComponent(termino)}&rol=REPARTIDOR`,
      )
      setResultados(res.items ?? [])
    } catch {
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }

  async function asignar(repartidorId: number) {
    setAsignando(repartidorId)
    setError(null)
    try {
      const res = await apiFetch<{ ok: boolean; data: EntregaAdmin }>(
        `/repartidor/admin/entregas/${entregaId}/asignar`,
        { method: 'PATCH', body: { repartidorId } },
      )
      onAsignado(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar el repartidor.')
    } finally {
      setAsignando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="font-semibold text-[#1A1A1A]">Asignar repartidor</h2>
          <button onClick={onCerrar} className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <input
            type="text"
            placeholder="Buscar repartidor por nombre…"
            value={q}
            onChange={(e) => { setQ(e.target.value); buscar(e.target.value) }}
            className="w-full rounded-xl border border-[#1A1A1A]/15 px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none"
            autoFocus
          />

          {buscando && (
            <p className="text-sm text-[#1A1A1A]/40 text-center py-2">Buscando…</p>
          )}

          {!buscando && resultados.length === 0 && q.trim() && (
            <p className="text-sm text-[#1A1A1A]/40 text-center py-2">Sin resultados</p>
          )}

          {resultados.length > 0 && (
            <ul className="divide-y divide-[#1A1A1A]/5 max-h-60 overflow-y-auto rounded-xl border border-[#1A1A1A]/8">
              {resultados.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">{r.nombre}</p>
                    {r.telefono && (
                      <p className="text-xs text-[#1A1A1A]/50">{r.telefono}</p>
                    )}
                  </div>
                  <button
                    onClick={() => asignar(r.id)}
                    disabled={asignando === r.id}
                    className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#245a42] disabled:opacity-50 transition-colors"
                  >
                    {asignando === r.id ? 'Asignando…' : 'Asignar'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal crear repartidor ───────────────────────────────────────────────────

function ModalCrearRepartidor({
  onCreado,
  onCerrar,
}: {
  onCreado: (r: RepartidorCreado) => void
  onCerrar: () => void
}) {
  const [nombre, setNombre]       = useState('')
  const [email, setEmail]         = useState('')
  const [telefono, setTelefono]   = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [errores, setErrores]     = useState<Record<string, string>>({})
  const [enviando, setEnviando]   = useState(false)
  const [errorGen, setErrorGen]   = useState<string | null>(null)

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!nombre.trim())  e.nombre   = 'El nombre es obligatorio.'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido.'
    if (!telefono.trim()) e.telefono = 'El teléfono es obligatorio.'
    if (password.length < 6)   e.password = 'Mínimo 6 caracteres.'
    if (password !== confirm)  e.confirm  = 'Las contraseñas no coinciden.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validar()) return
    setEnviando(true)
    setErrorGen(null)
    try {
      const res = await apiFetch<{ ok: boolean; data: RepartidorCreado }>('/admin/repartidores', {
        method: 'POST',
        body: { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim(), password },
      })
      onCreado(res.data)
    } catch (err) {
      setErrorGen(err instanceof Error ? err.message : 'No se pudo crear la cuenta.')
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="font-semibold text-[#1A1A1A]">Crear cuenta de repartidor</h2>
          <button onClick={onCerrar} className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="px-5 py-4 flex flex-col gap-4">
          {/* Nombre */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Nombre completo</label>
            <input
              type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Pedro Mosquera"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.nombre ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
            />
            {errores.nombre && <p className="mt-1 text-xs text-red-600">{errores.nombre}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Correo electrónico</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="pedro@ejemplo.com"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.email ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
            />
            {errores.email && <p className="mt-1 text-xs text-red-600">{errores.email}</p>}
          </div>

          {/* Teléfono */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Teléfono / WhatsApp</label>
            <input
              type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)}
              placeholder="3001234567"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.telefono ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
            />
            {errores.telefono && <p className="mt-1 text-xs text-red-600">{errores.telefono}</p>}
          </div>

          {/* Contraseña */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Contraseña</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Mín. 6 caracteres"
                inputClassName={`rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.password ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
              />
              {errores.password && <p className="mt-1 text-xs text-red-600">{errores.password}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Confirmar</label>
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                placeholder="Repite la clave"
                inputClassName={`rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.confirm ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
              />
              {errores.confirm && <p className="mt-1 text-xs text-red-600">{errores.confirm}</p>}
            </div>
          </div>

          {errorGen && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorGen}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onCerrar}
              className="flex-1 rounded-xl border border-[#1A1A1A]/15 py-2.5 text-sm font-medium text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={enviando}
              className="flex-1 rounded-xl bg-[#2D6A4F] py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] disabled:opacity-50 transition-colors"
            >
              {enviando ? 'Creando…' : 'Crear repartidor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tarjeta de entrega ───────────────────────────────────────────────────────

function TarjetaEntrega({
  entrega,
  onAsignar,
}: {
  entrega: EntregaAdmin
  onAsignar: (id: number) => void
}) {
  const { subPedido } = entrega
  const codigoPedido = subPedido.pedido.codigo ?? `PED-${subPedido.pedido.id}`
  const terminal = estaTerminal(entrega.estado)

  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[#1A1A1A]/40 font-medium">
            {codigoPedido} · {fechaCorta(entrega.createdAt)}
          </p>
          <p className="mt-0.5 text-base font-semibold text-[#1A1A1A] truncate">
            {subPedido.comercio.nombre}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold flex-shrink-0 ${
            ESTADO_BADGE[entrega.estado] ?? 'bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          {ESTADO_LABEL[entrega.estado] ?? entrega.estado}
        </span>
      </div>

      {/* Dirección */}
      <p className="text-sm text-[#1A1A1A]/70 flex gap-1.5 items-start">
        <span className="text-[#2D6A4F] mt-0.5">📍</span>
        <span>{subPedido.pedido.direccionTexto}</span>
      </p>

      {/* Comprador */}
      <p className="text-sm text-[#1A1A1A]/60">
        <span className="font-medium text-[#1A1A1A]">{subPedido.pedido.comprador.nombre}</span>
        {subPedido.pedido.comprador.telefono && (
          <span className="ml-1 text-[#2D6A4F]">· {subPedido.pedido.comprador.telefono}</span>
        )}
      </p>

      {/* Productos */}
      <div className="rounded-xl bg-[#F8F5F0] px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {subPedido.items.map((item, i) => (
            <li key={i} className="flex justify-between text-xs text-[#1A1A1A]/70">
              <span>{item.producto.nombre}</span>
              <span className="font-medium">×{item.cantidad}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Repartidor */}
      <div className="flex items-center justify-between gap-3">
        {entrega.repartidor ? (
          <p className="text-sm text-[#1A1A1A]/60">
            🚴 <span className="font-medium text-[#1A1A1A]">{entrega.repartidor.nombre}</span>
            {entrega.repartidor.telefono && (
              <span className="ml-1">· {entrega.repartidor.telefono}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-[#1A1A1A]/35 italic">Sin repartidor asignado</p>
        )}

        {!terminal && (
          <button
            onClick={() => onAsignar(entrega.id)}
            className="rounded-lg border border-[#2D6A4F]/30 px-3 py-1.5 text-xs font-semibold text-[#2D6A4F] hover:bg-[#2D6A4F]/8 transition-colors flex-shrink-0"
          >
            {entrega.repartidor ? 'Reasignar' : 'Asignar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

type Tab = 'disponibles' | 'activas' | 'completadas' | 'repartidores'

const TABS: { id: Tab; label: string }[] = [
  { id: 'disponibles',  label: 'Sin repartidor' },
  { id: 'activas',      label: 'En curso' },
  { id: 'completadas',  label: 'Completadas' },
  { id: 'repartidores', label: 'Repartidores' },
]

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminEntregasPage() {
  const [entregas, setEntregas]           = useState<EntregaAdmin[]>([])
  const [cargando, setCargando]           = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [tab, setTab]                     = useState<Tab>('disponibles')
  const [modalId, setModalId]             = useState<number | null>(null)
  const [repartidores, setRepartidores]   = useState<RepartidorCreado[]>([])
  const [cargandoReps, setCargandoReps]   = useState(false)
  const [modalCrear, setModalCrear]       = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await apiFetch<{ ok: boolean; data: EntregaAdmin[] }>(
        '/repartidor/admin/entregas',
      )
      setEntregas(res.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las entregas.')
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarRepartidores = useCallback(async () => {
    setCargandoReps(true)
    try {
      const res = await apiFetch<{ ok: boolean; data: RepartidorCreado[] }>('/admin/repartidores')
      setRepartidores(res.data ?? [])
    } catch { /* silencioso */ } finally {
      setCargandoReps(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    cargarRepartidores()
  }, [cargar, cargarRepartidores])

  function handleAsignado(actualizada: EntregaAdmin) {
    setEntregas((prev) => prev.map((e) => (e.id === actualizada.id ? actualizada : e)))
    setModalId(null)
  }

  function handleCreado(nuevo: RepartidorCreado) {
    setRepartidores((prev) => [nuevo, ...prev])
    setModalCrear(false)
    setTab('repartidores')
  }

  const filtradas = entregas.filter((e) => {
    if (tab === 'disponibles') return e.repartidorId === null && !estaTerminal(e.estado)
    if (tab === 'activas')     return e.repartidorId !== null && !estaTerminal(e.estado)
    if (tab === 'completadas') return estaTerminal(e.estado)
    return false
  })

  const cuentas: Record<Tab, number> = {
    disponibles:  entregas.filter((e) => e.repartidorId === null && !estaTerminal(e.estado)).length,
    activas:      entregas.filter((e) => e.repartidorId !== null && !estaTerminal(e.estado)).length,
    completadas:  entregas.filter((e) => estaTerminal(e.estado)).length,
    repartidores: repartidores.length,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors"
          >
            ← Panel
          </Link>
          <h1
            className="mt-1 text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Gestión de entregas
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">
            Supervisa y asigna repartidores a las entregas pendientes.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'repartidores' && (
            <button
              onClick={() => setModalCrear(true)}
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
            >
              + Crear repartidor
            </button>
          )}
          <button
            onClick={() => { cargar(); cargarRepartidores() }}
            disabled={cargando}
            className="rounded-xl border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5 disabled:opacity-40 transition-colors"
          >
            {cargando ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-[#1A1A1A]/5 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              tab === t.id
                ? 'bg-white text-[#1A1A1A] shadow-sm'
                : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80',
            ].join(' ')}
          >
            {t.label}
            {cuentas[t.id] > 0 && (
              <span
                className={`ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  tab === t.id ? 'bg-[#2D6A4F] text-white' : 'bg-[#1A1A1A]/10 text-[#1A1A1A]/60'
                }`}
              >
                {cuentas[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: entregas */}
      {tab !== 'repartidores' && (
        cargando ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-[#1A1A1A]/5 animate-pulse" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white px-6 py-16 text-center">
            <p className="text-base font-semibold text-[#1A1A1A]/60">
              {tab === 'disponibles' && 'No hay entregas sin repartidor asignado'}
              {tab === 'activas'     && 'No hay entregas en curso'}
              {tab === 'completadas' && 'No hay entregas completadas'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtradas.map((e) => (
              <TarjetaEntrega key={e.id} entrega={e} onAsignar={setModalId} />
            ))}
          </div>
        )
      )}

      {/* Tab: repartidores */}
      {tab === 'repartidores' && (
        cargandoReps ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-[#1A1A1A]/5 animate-pulse" />
            ))}
          </div>
        ) : repartidores.length === 0 ? (
          <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white px-6 py-16 text-center">
            <p className="text-base font-semibold text-[#1A1A1A]/60 mb-3">
              Aún no hay repartidores registrados
            </p>
            <button
              onClick={() => setModalCrear(true)}
              className="rounded-xl bg-[#2D6A4F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
            >
              + Crear el primero
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/40">
                  <th className="px-5 py-3 font-semibold">Nombre</th>
                  <th className="px-5 py-3 font-semibold">Teléfono</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Creado</th>
                </tr>
              </thead>
              <tbody>
                {repartidores.map((r) => (
                  <tr key={r.id} className="border-b border-[#1A1A1A]/5 last:border-0 hover:bg-[#F8F5F0]/60">
                    <td className="px-5 py-3 font-medium text-[#1A1A1A]">
                      <span className="mr-2">🚴</span>{r.nombre}
                    </td>
                    <td className="px-5 py-3 text-[#1A1A1A]/60">{r.telefono ?? '—'}</td>
                    <td className="px-5 py-3 text-[#1A1A1A]/60">{r.email}</td>
                    <td className="px-5 py-3 text-[#1A1A1A]/40">{fmtFecha(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal asignar repartidor */}
      {modalId !== null && (
        <ModalAsignar
          entregaId={modalId}
          onAsignado={handleAsignado}
          onCerrar={() => setModalId(null)}
        />
      )}

      {/* Modal crear repartidor */}
      {modalCrear && (
        <ModalCrearRepartidor
          onCreado={handleCreado}
          onCerrar={() => setModalCrear(false)}
        />
      )}
    </div>
  )
}
