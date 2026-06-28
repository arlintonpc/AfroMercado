'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

// ── Tipos ──────────────────────────────────────────────────────

interface VisibilidadItem {
  id: number
  tipo: 'CATALOGO' | 'HOME_DESTACADO'
  activa: boolean
  inicio: string
  fin: string
  montoCOP: number
  notas?: string
  comercio: { nombre: string }
  producto?: { nombre: string } | null
  admin: { nombre: string }
  createdAt: string
}

interface ComercioOpcion {
  id: number
  nombre: string
  municipio: string
  whatsapp?: string | null
}

interface ProductoOpcion {
  id: number
  nombre: string
}

// ── Helpers ────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function badgeTipo(tipo: string) {
  return tipo === 'HOME_DESTACADO'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2D6A4F]/15 text-[#2D6A4F]">Home</span>
    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4A017]/15 text-[#B8860B]">Catálogo</span>
}

function badgeEstado(activa: boolean, fin: string) {
  const vencida = new Date(fin) < new Date()
  if (!activa || vencida)
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1A1A1A]/10 text-[#1A1A1A]/50">Inactiva</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#52B788]/20 text-[#2D6A4F]">Activa</span>
}

function getToken() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem('afromercado_token') : null
}

// ── BuscadorComercio ──────────────────────────────────────────
// Input con autocomplete: escribe el nombre → aparece lista de comercios

function BuscadorComercio({
  value,
  label,
  onSelect,
}: {
  value: string
  label: string
  onSelect: (id: string, nombre: string) => void
}) {
  const [texto, setTexto] = useState(label)
  const [opciones, setOpciones] = useState<ComercioOpcion[]>([])
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setTexto(label) }, [label])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function buscar(q: string) {
    setCargando(true)
    setErrorBusqueda('')
    try {
      const token = getToken()
      const r = await fetch(
        `${API_URL}/admin/comercios/buscar?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const j = await r.json()
      if (!r.ok) {
        setErrorBusqueda(j.mensaje ?? `Error ${r.status}`)
        setOpciones([])
      } else {
        setOpciones(j.items ?? [])
      }
    } catch (err: unknown) {
      setErrorBusqueda(err instanceof Error ? err.message : 'Sin conexión')
      setOpciones([])
    } finally {
      setCargando(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setTexto(v)
    setAbierto(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(v), 280)
  }

  function handleFocus() {
    setAbierto(true)
    if (!opciones.length) buscar(texto)
  }

  function seleccionar(op: ComercioOpcion) {
    setTexto(op.nombre)
    setAbierto(false)
    onSelect(String(op.id), op.nombre)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={texto}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder="Escribe el nombre del comercio…"
        autoComplete="off"
        className="w-full border border-[#1A1A1A]/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
      />
      {value && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-1.5 py-0.5 rounded-full">
          #{value}
        </span>
      )}
      {abierto && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#1A1A1A]/10 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {cargando ? (
            <p className="text-xs text-[#1A1A1A]/40 p-3 text-center">Buscando…</p>
          ) : errorBusqueda ? (
            <p className="text-xs text-red-500 p-3 text-center">{errorBusqueda}</p>
          ) : opciones.length === 0 ? (
            <p className="text-xs text-[#1A1A1A]/40 p-3 text-center">Sin resultados</p>
          ) : opciones.map(op => (
            <button
              key={op.id}
              type="button"
              onClick={() => seleccionar(op)}
              className="w-full text-left px-3 py-2.5 hover:bg-[#F8F5F0] flex items-center justify-between gap-2 border-b border-[#1A1A1A]/5 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A1A1A] truncate">{op.nombre}</p>
                <p className="text-xs text-[#1A1A1A]/50 truncate">
                  {op.municipio}
                  {op.whatsapp && <> · 📞 {op.whatsapp}</>}
                </p>
              </div>
              <span className="text-[10px] text-[#1A1A1A]/30 flex-shrink-0">#{op.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SelectorProducto ──────────────────────────────────────────
// Dropdown filtrado por el comercio seleccionado

function SelectorProducto({
  comercioId,
  value,
  onChange,
}: {
  comercioId: string
  value: string
  onChange: (id: string) => void
}) {
  const [productos, setProductos] = useState<ProductoOpcion[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!comercioId) { setProductos([]); return }
    setCargando(true)
    fetch(
      `${API_URL}/admin/productos/buscar?comercioId=${comercioId}`,
      { headers: { Authorization: `Bearer ${getToken()}` } },
    )
      .then(r => r.json())
      .then(j => setProductos(j.items ?? []))
      .catch(() => setProductos([]))
      .finally(() => setCargando(false))
  }, [comercioId])

  if (!comercioId) {
    return (
      <select
        disabled
        className="w-full border border-[#1A1A1A]/10 rounded-xl px-3 py-2 text-sm text-[#1A1A1A]/30 bg-[#F8F5F0] cursor-not-allowed"
      >
        <option>Selecciona un comercio primero</option>
      </select>
    )
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={cargando}
      className="w-full border border-[#1A1A1A]/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
    >
      <option value="">— Sin producto específico —</option>
      {cargando ? (
        <option disabled>Cargando productos…</option>
      ) : productos.map(p => (
        <option key={p.id} value={String(p.id)}>{p.nombre}</option>
      ))}
    </select>
  )
}

// ── Formulario de nueva visibilidad ────────────────────────────

const HOY = new Date().toISOString().slice(0, 16)
const EN7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)

function FormNueva({ onCreada }: { onCreada: () => void }) {
  const [form, setForm] = useState({
    comercioId: '', comercioLabel: '',
    productoId: '',
    tipo: 'CATALOGO',
    inicio: HOY, fin: EN7, montoCOP: '15000', notas: '',
    etiqueta: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function seleccionarComercio(id: string, nombre: string) {
    setForm(f => ({ ...f, comercioId: id, comercioLabel: nombre, productoId: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.comercioId) { setError('Selecciona un comercio'); return }
    setGuardando(true); setError('')
    try {
      const r = await fetch(`${API_URL}/admin/visibilidad`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          comercioId: Number(form.comercioId),
          productoId: form.productoId ? Number(form.productoId) : null,
          tipo: form.tipo,
          inicio: form.inicio,
          fin: form.fin,
          montoCOP: Number(form.montoCOP),
          notas: form.notas || null,
          etiqueta: form.etiqueta.trim() || null,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.mensaje ?? 'Error al crear')
      setForm(f => ({
        ...f,
        comercioId: '', comercioLabel: '', productoId: '',
        notas: '', montoCOP: '15000', etiqueta: '',
      }))
      onCreada()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-[#1A1A1A]">Nuevo slot de visibilidad</h2>

      {/* Comercio y producto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#1A1A1A]/60">Comercio *</label>
          <BuscadorComercio
            value={form.comercioId}
            label={form.comercioLabel}
            onSelect={seleccionarComercio}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#1A1A1A]/60">Producto (opcional)</label>
          <SelectorProducto
            comercioId={form.comercioId}
            value={form.productoId}
            onChange={v => set('productoId', v)}
          />
        </div>
      </div>

      {/* Tipo y monto */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-semibold text-[#1A1A1A]/60">Tipo *</label>
          <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
            className="border border-[#1A1A1A]/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30">
            <option value="CATALOGO">Catálogo (aparece primero en el grid)</option>
            <option value="HOME_DESTACADO">Home destacado (sección de más vendidos)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-semibold text-[#1A1A1A]/60">Monto cobrado COP *</label>
          <input required type="number" value={form.montoCOP} onChange={e => set('montoCOP', e.target.value)}
            className="border border-[#1A1A1A]/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#1A1A1A]/60">Inicio *</label>
          <input required type="datetime-local" value={form.inicio} onChange={e => set('inicio', e.target.value)}
            className="border border-[#1A1A1A]/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#1A1A1A]/60">Fin *</label>
          <input required type="datetime-local" value={form.fin} onChange={e => set('fin', e.target.value)}
            className="border border-[#1A1A1A]/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        </div>
      </div>

      {/* Etiqueta del sello */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[#1A1A1A]/60">Etiqueta del sello</label>
        <div className="relative">
          <input
            type="text"
            value={form.etiqueta}
            onChange={e => set('etiqueta', e.target.value)}
            maxLength={28}
            placeholder="Patrocinado"
            className="w-full border border-[#1A1A1A]/15 rounded-xl px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          />
          {/* Vista previa del sello */}
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-[#2D6A4F] text-white text-[9px] font-bold px-2 py-0.5 rounded-full leading-none pointer-events-none">
            <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17 8C8 10 5.9 16.17 3.82 19.52 3.23 20.5 4.5 21.5 5.3 20.67 7 18.9 8.91 17.5 11 17c-1 3-4 4-4 4s6 0 9-8c1.5 2 2 3.5 2 5.5 0 0 2-10-1-10.5z"/>
            </svg>
            {form.etiqueta.trim() || 'Patrocinado'}
          </span>
        </div>
        <p className="text-[10px] text-[#1A1A1A]/40">Si lo dejas vacío usa Patrocinado. Máx. 28 caracteres.</p>
      </div>

      {/* Notas */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[#1A1A1A]/60">Notas internas</label>
        <input type="text" value={form.notas} onChange={e => set('notas', e.target.value)}
          placeholder="Ej: Pagó por Nequi el 16/06 · ref #123"
          className="border border-[#1A1A1A]/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={guardando || !form.comercioId}>
          {guardando ? 'Guardando…' : 'Crear slot'}
        </Button>
      </div>
    </form>
  )
}

// ── Página principal ────────────────────────────────────────────

export default function VisibilidadAdminPage() {
  const [items, setItems] = useState<VisibilidadItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [desactivando, setDesactivando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch(`${API_URL}/admin/visibilidad`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const j = await r.json()
      setItems(j.items ?? [])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function desactivar(id: number) {
    setDesactivando(id)
    try {
      await fetch(`${API_URL}/admin/visibilidad/${id}/desactivar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      await cargar()
    } finally {
      setDesactivando(null)
    }
  }

  const activos = items.filter(i => i.activa && new Date(i.fin) > new Date())
  const historial = items.filter(i => !i.activa || new Date(i.fin) <= new Date())

  return (
    <div className="flex flex-col gap-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-[#52B788] uppercase tracking-widest mb-0.5">Panel de administración</p>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Visibilidad pagada</h1>
        </div>
        <Link href="/admin" className="text-sm text-[#2D6A4F] hover:underline">← Volver al panel</Link>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 shadow-sm">
          <p className="text-2xl font-bold text-[#2D6A4F]">{activos.length}</p>
          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">Slots activos</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#D4A017]/30 p-4 shadow-sm">
          <p className="text-2xl font-bold text-[#D4A017]">
            ${items.reduce((s, i) => s + Number(i.montoCOP), 0).toLocaleString('es-CO')}
          </p>
          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">COP facturado total</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 shadow-sm">
          <p className="text-2xl font-bold text-[#1A1A1A]">{items.filter(i => i.tipo === 'CATALOGO').length}</p>
          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">Slots catálogo</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 shadow-sm">
          <p className="text-2xl font-bold text-[#1A1A1A]">{items.filter(i => i.tipo === 'HOME_DESTACADO').length}</p>
          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">Slots home</p>
        </div>
      </div>

      {/* Formulario */}
      <FormNueva onCreada={cargar} />

      {/* Activos */}
      {cargando ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <section>
          <h2 className="font-semibold text-[#1A1A1A] mb-3">Activos ({activos.length})</h2>
          {activos.length === 0 ? (
            <p className="text-sm text-[#1A1A1A]/40 bg-white rounded-xl border border-dashed border-[#1A1A1A]/15 p-6 text-center">
              No hay slots activos.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {activos.map(v => (
                <div key={v.id} className="bg-white rounded-xl border border-[#1A1A1A]/8 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {badgeTipo(v.tipo)}
                      {badgeEstado(v.activa, v.fin)}
                      <span className="text-sm font-semibold text-[#1A1A1A] truncate">{v.comercio.nombre}</span>
                      {v.producto && <span className="text-sm text-[#1A1A1A]/50 truncate">— {v.producto.nombre}</span>}
                    </div>
                    <p className="text-xs text-[#1A1A1A]/40">
                      {fmt(v.inicio)} → {fmt(v.fin)} · ${Number(v.montoCOP).toLocaleString('es-CO')} COP
                      {v.notas && <> · {v.notas}</>}
                    </p>
                  </div>
                  <button
                    onClick={() => desactivar(v.id)}
                    disabled={desactivando === v.id}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold flex-shrink-0 disabled:opacity-50"
                  >
                    {desactivando === v.id ? 'Desactivando…' : 'Desactivar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <section>
          <h2 className="font-semibold text-[#1A1A1A] mb-3">Historial ({historial.length})</h2>
          <div className="flex flex-col gap-2">
            {historial.map(v => (
              <div key={v.id} className="bg-white/60 rounded-xl border border-[#1A1A1A]/5 px-4 py-3 flex items-center gap-3 opacity-70">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    {badgeTipo(v.tipo)}
                    {badgeEstado(v.activa, v.fin)}
                    <span className="text-sm font-semibold text-[#1A1A1A] truncate">{v.comercio.nombre}</span>
                    {v.producto && <span className="text-sm text-[#1A1A1A]/50 truncate">— {v.producto.nombre}</span>}
                  </div>
                  <p className="text-xs text-[#1A1A1A]/40">
                    {fmt(v.inicio)} → {fmt(v.fin)} · ${Number(v.montoCOP).toLocaleString('es-CO')} COP
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
