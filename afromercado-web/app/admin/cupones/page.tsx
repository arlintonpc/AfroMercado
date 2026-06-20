'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'

// ── Tipos ─────────────────────────────────────────────────────

interface Comercio  { id: number; nombre: string; municipio: string }
interface UsuarioItem { id: number; nombre: string; telefono?: string; email?: string }
interface CuponComercio { comercio: { id: number; nombre: string } }

interface Cupon {
  id: number; codigo: string; tipo: 'PORCENTAJE' | 'VALOR_FIJO'; valor: string
  minimoCompra: string | null; usosMaximos: number | null; usosMaximosPorUsuario: number | null
  usosActuales: number; activo: boolean; inicio: string; fin: string
  soloNuevos: boolean; distribucion: 'PUBLICO' | 'ASIGNADO'
  comercios: CuponComercio[]
  _count?: { usos: number; asignaciones: number }
}

interface Resumen {
  redenciones: number; cuponesActivos: number
  descuentoRealizado: number; gmvAtribuido: number
  topCupon: string | null; proxVencer: { codigo: string; fin: string } | null
}

interface FormCupon {
  codigo: string; tipo: 'PORCENTAJE' | 'VALOR_FIJO'; valor: string
  minimoCompra: string; usosMaximos: string; usosMaximosPorUsuario: string
  soloNuevos: boolean; distribucion: 'PUBLICO' | 'ASIGNADO'
  comerciosSeleccionados: Comercio[]; usuariosSeleccionados: UsuarioItem[]
  inicio: string; fin: string
}

// ── Helpers ───────────────────────────────────────────────────

function fechaLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function estadoCupon(c: Cupon) {
  if (!c.activo) return { label: 'Desactivado', color: 'bg-[#1A1A1A]/10 text-[#1A1A1A]/50' }
  const ahora = Date.now()
  if (new Date(c.fin).getTime() < ahora)    return { label: 'Expirado',   color: 'bg-[#1A1A1A]/10 text-[#1A1A1A]/50' }
  if (new Date(c.inicio).getTime() > ahora) return { label: 'Programado', color: 'bg-[#D4A017]/15 text-[#9B7300]' }
  if (c.usosMaximos !== null && c.usosActuales >= c.usosMaximos) return { label: 'Agotado', color: 'bg-red-100 text-red-600' }
  return { label: 'Activo', color: 'bg-[#52B788]/15 text-[#2D6A4F]' }
}
function valorDesc(c: Cupon) {
  return c.tipo === 'PORCENTAJE' ? `-${Number(c.valor).toFixed(0)}%` : `-${formatearPrecio(Number(c.valor))}`
}
function formDefault(): FormCupon {
  const ahora = new Date(); ahora.setMinutes(ahora.getMinutes() + 5)
  const fin   = new Date(); fin.setDate(fin.getDate() + 30)
  return { codigo:'', tipo:'PORCENTAJE', valor:'', minimoCompra:'', usosMaximos:'', usosMaximosPorUsuario:'', soloNuevos:false, distribucion:'PUBLICO', comerciosSeleccionados:[], usuariosSeleccionados:[], inicio:fechaLocal(ahora), fin:fechaLocal(fin) }
}

// ── Componentes base ──────────────────────────────────────────

const inputCls = 'w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30'

function Campo({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">
        {label}{sub && <span className="font-normal opacity-70 ml-1">{sub}</span>}
      </label>
      {children}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-[#2D6A4F]/10 text-[#2D6A4F] text-xs font-semibold px-2.5 py-1 rounded-full">
      {label}
      <button type="button" onClick={onRemove} className="ml-0.5 text-[#2D6A4F]/60 hover:text-[#2D6A4F] leading-none text-sm">×</button>
    </span>
  )
}

function Seccion({ titulo, resumen, abierta, onToggle, children }: { titulo: string; resumen?: string; abierta: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-[#1A1A1A]/8 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-[#F8F5F0]/80 hover:bg-[#F8F5F0] transition-colors text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1A1A1A]">{titulo}</span>
          {resumen && <span className="text-xs text-[#2D6A4F] font-medium">{resumen}</span>}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform flex-shrink-0 text-[#1A1A1A]/40 ${abierta ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierta && <div className="px-4 py-4 flex flex-col gap-5">{children}</div>}
    </div>
  )
}

// ── Autocomplete de comercios ─────────────────────────────────

function BuscadorComercio({ seleccionados, onAgregar, onQuitar }: { seleccionados: Comercio[]; onAgregar: (c: Comercio) => void; onQuitar: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Comercio[]>([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function onInput(v: string) {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!v.trim()) { setItems([]); setAbierto(false); return }
    timerRef.current = setTimeout(async () => {
      setCargando(true)
      try {
        const res = await apiFetch<{ ok: boolean; items: Comercio[] }>(`/admin/comercios/buscar?q=${encodeURIComponent(v.trim())}`)
        setItems((res?.items ?? []).filter(c => !seleccionados.some(s => s.id === c.id)))
        setAbierto(true)
      } catch { /* */ } finally { setCargando(false) }
    }, 280)
  }

  return (
    <Campo label="Comercios donde aplica" sub="(vacío = todos los comercios)">
      <div ref={wrapRef} className="relative">
        <input type="text" value={query} onChange={e => onInput(e.target.value)} placeholder="Buscar por nombre o municipio…" className={inputCls} onFocus={() => items.length > 0 && setAbierto(true)} />
        {cargando && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 text-xs">Buscando…</span>}
        {abierto && items.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full bg-white border border-[#1A1A1A]/10 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {items.map(c => (
              <li key={c.id}><button type="button" onMouseDown={() => { onAgregar(c); setQuery(''); setItems([]); setAbierto(false) }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#F8F5F0] text-left"><span className="text-sm">{c.nombre}</span>{c.municipio && <span className="text-xs text-[#1A1A1A]/40 ml-2 flex-shrink-0">{c.municipio}</span>}</button></li>
            ))}
          </ul>
        )}
        {abierto && !cargando && items.length === 0 && query.trim() && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-[#1A1A1A]/10 rounded-xl shadow-lg px-3 py-3"><p className="text-xs text-[#1A1A1A]/40">Sin resultados para «{query}»</p></div>
        )}
      </div>
      {seleccionados.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{seleccionados.map(c => <Chip key={c.id} label={c.nombre} onRemove={() => onQuitar(c.id)} />)}</div>}
    </Campo>
  )
}

// ── Buscador de usuarios por teléfono ─────────────────────────

function BuscadorUsuario({ seleccionados, onAgregar, onQuitar }: { seleccionados: UsuarioItem[]; onAgregar: (u: UsuarioItem) => void; onQuitar: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<UsuarioItem[]>([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function onInput(v: string) {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!v.trim() || v.trim().length < 3) { setItems([]); setAbierto(false); return }
    timerRef.current = setTimeout(async () => {
      setCargando(true)
      try {
        const res = await apiFetch<{ ok: boolean; items: UsuarioItem[] }>(`/admin/usuarios/buscar?q=${encodeURIComponent(v.trim())}`)
        setItems((res?.items ?? []).filter(u => !seleccionados.some(s => s.id === u.id)))
        setAbierto(true)
      } catch { /* */ } finally { setCargando(false) }
    }, 280)
  }

  return (
    <Campo label="Buscar usuario por celular o nombre">
      <div ref={wrapRef} className="relative">
        <input type="text" value={query} onChange={e => onInput(e.target.value)} placeholder="Ej: 3001234567 o nombre del usuario" className={inputCls} onFocus={() => items.length > 0 && setAbierto(true)} />
        {cargando && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 text-xs">Buscando…</span>}
        {abierto && items.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full bg-white border border-[#1A1A1A]/10 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {items.map(u => (
              <li key={u.id}><button type="button" onMouseDown={() => { onAgregar(u); setQuery(''); setItems([]); setAbierto(false) }} className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[#F8F5F0] text-left">
                <div className="w-8 h-8 rounded-full bg-[#2D6A4F]/15 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-sm font-bold text-[#2D6A4F]">{u.nombre.charAt(0).toUpperCase()}</span></div>
                <div className="min-w-0"><p className="text-sm font-semibold text-[#1A1A1A] truncate">{u.nombre}</p><p className="text-xs text-[#1A1A1A]/40 truncate">{u.telefono ?? u.email ?? `ID ${u.id}`}</p></div>
              </button></li>
            ))}
          </ul>
        )}
        {abierto && !cargando && items.length === 0 && query.trim().length >= 3 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-[#1A1A1A]/10 rounded-xl shadow-lg px-3 py-3"><p className="text-xs text-[#1A1A1A]/40">No se encontró un usuario con ese número o nombre.</p></div>
        )}
        <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">Escribe al menos 3 caracteres del número de celular o el nombre.</p>
      </div>
      {seleccionados.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-[#1A1A1A]/40 mb-1.5">{seleccionados.length} usuario{seleccionados.length > 1 ? 's' : ''} asignado{seleccionados.length > 1 ? 's' : ''}:</p>
          <div className="flex flex-wrap gap-2">{seleccionados.map(u => <Chip key={u.id} label={`${u.nombre}${u.telefono ? ` · ${u.telefono}` : ''}`} onRemove={() => onQuitar(u.id)} />)}</div>
        </div>
      )}
    </Campo>
  )
}

// ── Dashboard cards ───────────────────────────────────────────

function TarjetaKPI({ titulo, valor, sub, color }: { titulo: string; valor: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 px-5 py-4">
      <p className="text-xs font-semibold text-[#1A1A1A]/50 mb-1">{titulo}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-[#1A1A1A]'}`}>{valor}</p>
      {sub && <p className="text-xs text-[#1A1A1A]/40 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function PaginaCupones() {
  const [cupones, setCupones]           = useState<Cupon[]>([])
  const [resumen, setResumen]           = useState<Resumen | null>(null)
  const [cargando, setCargando]         = useState(true)
  const [mostrarForm, setMostrarForm]   = useState(false)
  const [form, setForm]                 = useState<FormCupon>(formDefault())
  const [creando, setCreando]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [aviso, setAviso]               = useState<string | null>(null)
  const [desactivando, setDesactivando] = useState<number | null>(null)
  const [secLimites, setSecLimites]     = useState(false)
  const [secAlcance, setSecAlcance]     = useState(false)

  async function cargar() {
    try {
      const [resCupones, resResumen] = await Promise.all([
        apiFetch<{ ok: boolean; data: { items: Cupon[] } }>('/cupones'),
        apiFetch<{ ok: boolean; data: Resumen }>('/cupones/reporte/resumen').catch(() => null),
      ])
      setCupones(resCupones?.data?.items ?? [])
      const r = resResumen as { ok: boolean; data: Resumen } | null
      if (r?.data) setResumen(r.data)
    } catch { /* */ } finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  function set<K extends keyof FormCupon>(k: K, v: FormCupon[K]) { setForm(f => ({ ...f, [k]: v })) }

  const resLimites = (() => {
    const p: string[] = []
    if (form.usosMaximos) p.push(`${form.usosMaximos} usos totales`)
    if (form.usosMaximosPorUsuario) p.push(`${form.usosMaximosPorUsuario}/usuario`)
    if (form.soloNuevos) p.push('solo nuevos')
    return p.join(' · ') || undefined
  })()
  const resAlcance = (() => {
    const p: string[] = []
    if (form.comerciosSeleccionados.length > 0) p.push(`${form.comerciosSeleccionados.length} comercio${form.comerciosSeleccionados.length > 1 ? 's' : ''}`)
    if (form.distribucion === 'ASIGNADO') p.push(form.usuariosSeleccionados.length > 0 ? `${form.usuariosSeleccionados.length} usuarios` : 'asignado')
    return p.join(' · ') || undefined
  })()

  async function crear() {
    setError(null)
    if (!form.codigo.trim()) { setError('El código es obligatorio.'); return }
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) { setError('Ingresa un valor de descuento válido.'); return }
    if (form.tipo === 'PORCENTAJE' && Number(form.valor) > 80) { setError('El porcentaje máximo es 80%.'); return }
    if (!form.inicio || !form.fin) { setError('Las fechas son obligatorias.'); return }
    if (new Date(form.fin) <= new Date(form.inicio)) { setError('La fecha de fin debe ser posterior al inicio.'); return }
    if (form.distribucion === 'ASIGNADO' && form.usuariosSeleccionados.length === 0) { setError('Para distribución asignada debes agregar al menos un usuario.'); return }

    setCreando(true)
    try {
      await apiFetch('/cupones', {
        method: 'POST',
        body: {
          codigo: form.codigo.trim().toUpperCase(),
          tipo: form.tipo, valor: Number(form.valor),
          minimoCompra: form.minimoCompra ? Number(form.minimoCompra) : undefined,
          usosMaximos: form.usosMaximos ? Number(form.usosMaximos) : undefined,
          usosMaximosPorUsuario: form.usosMaximosPorUsuario ? Number(form.usosMaximosPorUsuario) : undefined,
          inicio: new Date(form.inicio).toISOString(), fin: new Date(form.fin).toISOString(),
          soloNuevos: form.soloNuevos, distribucion: form.distribucion,
          comercioIds: form.comerciosSeleccionados.map(c => c.id),
          usuarioIds:  form.usuariosSeleccionados.map(u => u.id),
        },
      })
      setForm(formDefault()); setMostrarForm(false); setSecLimites(false); setSecAlcance(false)
      setAviso('Cupón creado correctamente.')
      setTimeout(() => setAviso(null), 4000)
      await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al crear el cupón.') }
    finally { setCreando(false) }
  }

  async function desactivar(id: number) {
    setDesactivando(id)
    try { await apiFetch(`/cupones/${id}`, { method: 'DELETE' }); await cargar() }
    catch { /* */ } finally { setDesactivando(null) }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">← Panel admin</Link>
          <h1 className="text-3xl text-[#1A1A1A] mt-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Cupones de descuento</h1>
          <p className="text-sm text-[#1A1A1A]/50 mt-0.5">Los compradores ingresan el código en el checkout.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/cupones/usos" className="inline-flex items-center gap-1.5 border border-[#1A1A1A]/10 hover:border-[#2D6A4F]/30 text-sm font-semibold text-[#1A1A1A]/60 hover:text-[#2D6A4F] px-3 py-2 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h12" strokeLinecap="round"/></svg>
            Log de usos
          </Link>
          <Link href="/admin/cupones/alertas" className="inline-flex items-center gap-1.5 border border-[#1A1A1A]/10 hover:border-amber-400/60 text-sm font-semibold text-[#1A1A1A]/60 hover:text-amber-600 px-3 py-2 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Alertas
          </Link>
          <button type="button" onClick={() => { setMostrarForm(v => !v); setError(null) }}
            className="inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <span className="text-lg leading-none">{mostrarForm ? '×' : '+'}</span>
            {mostrarForm ? 'Cancelar' : 'Nuevo cupón'}
          </button>
        </div>
      </div>

      {/* Dashboard cards */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TarjetaKPI titulo="Descuento realizado" valor={formatearPrecio(resumen.descuentoRealizado)} sub="pedidos confirmados" color="text-[#2D6A4F]" />
          <TarjetaKPI titulo="Redenciones" valor={String(resumen.redenciones)} sub="registros en log" />
          <TarjetaKPI titulo="Cupones activos" valor={String(resumen.cuponesActivos)} sub={resumen.proxVencer ? `próx. vence: ${resumen.proxVencer.codigo}` : undefined} />
          <TarjetaKPI titulo="GMV atribuido" valor={formatearPrecio(resumen.gmvAtribuido)} sub="ventas con cupón" />
        </div>
      )}

      {aviso && (
        <div className="flex items-center gap-2 bg-[#52B788]/15 border border-[#52B788]/30 text-[#2D6A4F] text-sm font-semibold px-4 py-3 rounded-2xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {aviso}
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Nuevo cupón</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Código" sub="(el cliente lo escribe)">
              <input type="text" value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="Ej: AFRO2026, CHOCOAMORE" maxLength={30} className={inputCls} />
              <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">Sin espacios, se guarda en mayúsculas.</p>
            </Campo>
            <Campo label="Tipo de descuento">
              <div className="flex gap-4 pt-1.5">
                {(['PORCENTAJE','VALOR_FIJO'] as const).map(t => (
                  <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="tipo" value={t} checked={form.tipo===t} onChange={() => set('tipo',t)} />{t==='PORCENTAJE' ? 'Porcentaje (%)' : 'Valor fijo (COP)'}</label>
                ))}
              </div>
            </Campo>
            <Campo label={form.tipo==='PORCENTAJE' ? 'Descuento (1–80%)' : 'Descuento en COP'}>
              <input type="number" min="1" max={form.tipo==='PORCENTAJE' ? 80 : undefined} value={form.valor} onChange={e => set('valor',e.target.value)} placeholder={form.tipo==='PORCENTAJE' ? '20' : '10000'} className={inputCls} />
            </Campo>
            <Campo label="Compra mínima (COP)" sub="(opcional)">
              <input type="number" min="0" value={form.minimoCompra} onChange={e => set('minimoCompra',e.target.value)} placeholder="Sin mínimo si está vacío" className={inputCls} />
            </Campo>
            <Campo label="Válido desde"><input type="datetime-local" value={form.inicio} onChange={e => set('inicio',e.target.value)} className={inputCls} /></Campo>
            <Campo label="Válido hasta"><input type="datetime-local" value={form.fin} onChange={e => set('fin',e.target.value)} className={inputCls} /></Campo>
          </div>

          <Seccion titulo="Límites de uso" resumen={resLimites} abierta={secLimites} onToggle={() => setSecLimites(v=>!v)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Usos totales máximos" sub="(opcional)">
                <input type="number" min="1" value={form.usosMaximos} onChange={e => set('usosMaximos',e.target.value)} placeholder="Sin límite global si vacío" className={inputCls} />
              </Campo>
              <Campo label="Usos máximos por usuario" sub="(opcional)">
                <input type="number" min="1" value={form.usosMaximosPorUsuario} onChange={e => set('usosMaximosPorUsuario',e.target.value)} placeholder="Ej: 1=una vez, 3=hasta tres" className={inputCls} />
                <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">Vacío = sin límite por persona.</p>
              </Campo>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.soloNuevos} onChange={e => set('soloNuevos',e.target.checked)} className="w-4 h-4 accent-[#2D6A4F]" />
              Solo para compradores nuevos (primer pedido confirmado)
            </label>
          </Seccion>

          <Seccion titulo="Alcance del cupón" resumen={resAlcance} abierta={secAlcance} onToggle={() => setSecAlcance(v=>!v)}>
            <BuscadorComercio seleccionados={form.comerciosSeleccionados} onAgregar={c => set('comerciosSeleccionados',[...form.comerciosSeleccionados,c])} onQuitar={id => set('comerciosSeleccionados',form.comerciosSeleccionados.filter(c=>c.id!==id))} />
            <div>
              <p className="text-xs font-semibold text-[#1A1A1A]/60 mb-2">Tipo de distribución</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {([['PUBLICO','Código público','Cualquier usuario puede ingresarlo.'],['ASIGNADO','Código personal','Solo funciona para los usuarios que asignes.']] as const).map(([v,tit,desc]) => (
                  <label key={v} className={`flex-1 flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${form.distribucion===v ? 'border-[#2D6A4F] bg-[#2D6A4F]/5' : 'border-[#1A1A1A]/10 hover:border-[#2D6A4F]/30'}`}>
                    <input type="radio" name="distribucion" value={v} checked={form.distribucion===v} onChange={() => set('distribucion',v)} className="mt-0.5 accent-[#2D6A4F]" />
                    <div><p className="text-sm font-semibold text-[#1A1A1A]">{tit}</p><p className="text-xs text-[#1A1A1A]/50 mt-0.5">{desc}</p></div>
                  </label>
                ))}
              </div>
              {form.distribucion === 'ASIGNADO' && (
                <div className="mt-4"><BuscadorUsuario seleccionados={form.usuariosSeleccionados} onAgregar={u => set('usuariosSeleccionados',[...form.usuariosSeleccionados,u])} onQuitar={id => set('usuariosSeleccionados',form.usuariosSeleccionados.filter(u=>u.id!==id))} /></div>
              )}
            </div>
          </Seccion>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={crear} disabled={creando} className="bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
              {creando ? 'Creando…' : 'Crear cupón'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
          <p className="text-sm font-semibold text-[#1A1A1A]/60">{cargando ? 'Cargando…' : `${cupones.length} cupón${cupones.length!==1?'es':''}`}</p>
        </div>
        {cargando ? (
          <div className="divide-y divide-[#1A1A1A]/5">{[1,2,3].map(i=><div key={i} className="px-5 py-4 flex items-center gap-4"><div className="h-5 w-28 bg-[#1A1A1A]/8 rounded animate-pulse"/><div className="h-4 w-16 bg-[#1A1A1A]/5 rounded animate-pulse ml-auto"/></div>)}</div>
        ) : cupones.length === 0 ? (
          <div className="px-5 py-12 text-center"><p className="text-4xl mb-3">🏷️</p><p className="text-base font-semibold text-[#1A1A1A]/60">No hay cupones creados</p><p className="text-sm text-[#1A1A1A]/40 mt-1">Crea el primero con el botón Nuevo cupón.</p></div>
        ) : (
          <ul className="divide-y divide-[#1A1A1A]/5">
            {cupones.map(c => {
              const estado = estadoCupon(c)
              const puedeDesactivar = c.activo && new Date(c.fin) > new Date()
              const comerciosNombres = c.comercios?.map(cc => cc.comercio.nombre) ?? []
              return (
                <li key={c.id} className="hover:bg-[#F8F5F0]/60 transition-colors">
                  <div className="px-5 py-4 flex items-start gap-3">
                    <Link href={`/admin/cupones/${c.id}`} className="min-w-0 flex-1 group">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-base font-bold text-[#1A1A1A] bg-[#F8F5F0] border border-[#1A1A1A]/8 px-2.5 py-0.5 rounded-lg tracking-wide group-hover:border-[#2D6A4F]/30 transition-colors">{c.codigo}</code>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${estado.color}`}>{estado.label}</span>
                        {c.distribucion==='ASIGNADO' && <span className="text-[11px] font-semibold bg-[#D4A017]/12 text-[#9B7300] px-2 py-0.5 rounded-full">Personal</span>}
                        {c.soloNuevos && <span className="text-[11px] font-semibold bg-[#52B788]/12 text-[#2D6A4F] px-2 py-0.5 rounded-full">Solo nuevos</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#1A1A1A]/50">
                        <span className="font-semibold text-[#2D6A4F]">{valorDesc(c)}</span>
                        {c.minimoCompra && <span>Mín. {formatearPrecio(Number(c.minimoCompra))}</span>}
                        <span>{c._count?.usos ?? c.usosActuales}{c.usosMaximos ? `/${c.usosMaximos}` : ''} usos{c.usosMaximosPorUsuario ? ` · ${c.usosMaximosPorUsuario}/usuario` : ''}</span>
                        <span>{formatearFecha(c.inicio)} → {formatearFecha(c.fin)}</span>
                        {comerciosNombres.length > 0 && <span>{comerciosNombres.length} comercio{comerciosNombres.length>1?'s':''}: {comerciosNombres.slice(0,2).join(', ')}{comerciosNombres.length>2?'…':''}</span>}
                        <span className="text-[#2D6A4F]/70 font-medium">Ver detalle →</span>
                      </div>
                    </Link>
                    {puedeDesactivar && (
                      <button type="button" onClick={() => desactivar(c.id)} disabled={desactivando===c.id}
                        className="flex-shrink-0 text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors whitespace-nowrap">
                        {desactivando===c.id ? 'Desactivando…' : 'Desactivar'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
