'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'

// ── Tipos ─────────────────────────────────────────────────────

interface Cupon {
  id: number
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: string
  minimoCompra: string | null
  usosMaximos: number | null
  usosActuales: number
  activo: boolean
  inicio: string
  fin: string
  soloNuevos: boolean
}

interface FormCupon {
  codigo: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: string
  minimoCompra: string
  usosMaximos: string
  inicio: string
  fin: string
  soloNuevos: boolean
}

// ── Utilidades ────────────────────────────────────────────────

function fechaLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function estadoCupon(c: Cupon): { label: string; color: string } {
  if (!c.activo) return { label: 'Desactivado', color: 'bg-[#1A1A1A]/10 text-[#1A1A1A]/50' }
  const ahora = Date.now()
  if (new Date(c.fin).getTime() < ahora) return { label: 'Expirado', color: 'bg-[#1A1A1A]/10 text-[#1A1A1A]/50' }
  if (new Date(c.inicio).getTime() > ahora) return { label: 'Programado', color: 'bg-[#D4A017]/15 text-[#9B7300]' }
  if (c.usosMaximos !== null && c.usosActuales >= c.usosMaximos) return { label: 'Agotado', color: 'bg-[#C0392B]/10 text-[#C0392B]' }
  return { label: 'Activo', color: 'bg-[#52B788]/15 text-[#2D6A4F]' }
}

function valorDescuento(c: Cupon) {
  return c.tipo === 'PORCENTAJE'
    ? `-${Number(c.valor).toFixed(0)}%`
    : `-${formatearPrecio(Number(c.valor))}`
}

// ── Formulario por defecto ────────────────────────────────────

function formDefault(): FormCupon {
  const ahora = new Date()
  ahora.setMinutes(ahora.getMinutes() + 5)
  const fin = new Date()
  fin.setDate(fin.getDate() + 30)
  return {
    codigo: '',
    tipo: 'PORCENTAJE',
    valor: '',
    minimoCompra: '',
    usosMaximos: '',
    inicio: fechaLocal(ahora),
    fin: fechaLocal(fin),
    soloNuevos: false,
  }
}

// ── Input reutilizable ────────────────────────────────────────

function Campo({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">
        {label}
        {sublabel && <span className="font-normal opacity-70 ml-1">{sublabel}</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30'

// ── Página ────────────────────────────────────────────────────

export default function PaginaCupones() {
  const [cupones, setCupones] = useState<Cupon[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormCupon>(formDefault())
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [desactivando, setDesactivando] = useState<number | null>(null)

  async function cargar() {
    try {
      const res = await apiFetch<{ ok: boolean; data: { items: Cupon[] } }>('/cupones')
      setCupones(res?.data?.items ?? [])
    } catch { /* silencioso */ } finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  function set(campo: keyof FormCupon, valor: string | boolean) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function crear() {
    setError(null)
    if (!form.codigo.trim()) { setError('El código es obligatorio.'); return }
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) {
      setError('Ingresa un valor de descuento válido.'); return
    }
    if (form.tipo === 'PORCENTAJE' && Number(form.valor) > 80) {
      setError('El porcentaje máximo es 80%.'); return
    }
    if (!form.inicio || !form.fin) { setError('Las fechas son obligatorias.'); return }
    if (new Date(form.fin) <= new Date(form.inicio)) {
      setError('La fecha de fin debe ser posterior a la de inicio.'); return
    }

    setCreando(true)
    try {
      await apiFetch('/cupones', {
        method: 'POST',
        body: {
          codigo: form.codigo.trim().toUpperCase(),
          tipo: form.tipo,
          valor: Number(form.valor),
          minimoCompra: form.minimoCompra ? Number(form.minimoCompra) : undefined,
          usosMaximos: form.usosMaximos ? Number(form.usosMaximos) : undefined,
          inicio: new Date(form.inicio).toISOString(),
          fin: new Date(form.fin).toISOString(),
          soloNuevos: form.soloNuevos,
        },
      })
      setForm(formDefault())
      setMostrarForm(false)
      setAviso('Cupón creado correctamente.')
      setTimeout(() => setAviso(null), 4000)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el cupón.')
    } finally { setCreando(false) }
  }

  async function desactivar(id: number) {
    setDesactivando(id)
    try {
      await apiFetch(`/cupones/${id}`, { method: 'DELETE' })
      await cargar()
    } catch { /* silencioso */ } finally { setDesactivando(null) }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">
            ← Panel admin
          </Link>
          <h1 className="text-3xl text-[#1A1A1A] mt-1"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Cupones de descuento
          </h1>
          <p className="text-sm text-[#1A1A1A]/50 mt-0.5">
            Los compradores ingresan el código en el checkout para obtener descuento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setMostrarForm(v => !v); setError(null) }}
          className="inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <span className="text-lg leading-none">{mostrarForm ? '×' : '+'}</span>
          {mostrarForm ? 'Cancelar' : 'Nuevo cupón'}
        </button>
      </div>

      {/* Aviso éxito */}
      {aviso && (
        <div className="flex items-center gap-2 bg-[#52B788]/15 border border-[#52B788]/30 text-[#2D6A4F] text-sm font-semibold px-4 py-3 rounded-2xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {aviso}
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Nuevo cupón</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código */}
            <Campo label="Código" sublabel="(el cliente lo escribe)">
              <input
                type="text"
                value={form.codigo}
                onChange={e => set('codigo', e.target.value.toUpperCase())}
                placeholder="Ej: BIENVENIDO20, CHOCOAMORE"
                maxLength={30}
                className={inputCls}
              />
              <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">Sin espacios, se guarda en mayúsculas automáticamente.</p>
            </Campo>

            {/* Tipo */}
            <Campo label="Tipo de descuento">
              <div className="flex gap-4 pt-1.5">
                {(['PORCENTAJE', 'VALOR_FIJO'] as const).map(t => (
                  <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="tipo"
                      value={t}
                      checked={form.tipo === t}
                      onChange={() => set('tipo', t)}
                    />
                    {t === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Valor fijo (COP)'}
                  </label>
                ))}
              </div>
            </Campo>

            {/* Valor */}
            <Campo label={form.tipo === 'PORCENTAJE' ? 'Descuento (1–80%)' : 'Descuento en COP'}>
              <input
                type="number"
                min="1"
                max={form.tipo === 'PORCENTAJE' ? 80 : undefined}
                value={form.valor}
                onChange={e => set('valor', e.target.value)}
                placeholder={form.tipo === 'PORCENTAJE' ? '20' : '10000'}
                className={inputCls}
              />
            </Campo>

            {/* Mínimo de compra */}
            <Campo label="Compra mínima (COP)" sublabel="(opcional)">
              <input
                type="number"
                min="0"
                value={form.minimoCompra}
                onChange={e => set('minimoCompra', e.target.value)}
                placeholder="Ej: 50000 — sin mínimo si está vacío"
                className={inputCls}
              />
            </Campo>

            {/* Usos máximos */}
            <Campo label="Usos máximos" sublabel="(opcional)">
              <input
                type="number"
                min="1"
                value={form.usosMaximos}
                onChange={e => set('usosMaximos', e.target.value)}
                placeholder="Sin límite si está vacío"
                className={inputCls}
              />
            </Campo>

            {/* Solo nuevos */}
            <Campo label="Restricción de usuarios">
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-1.5">
                <input
                  type="checkbox"
                  checked={form.soloNuevos}
                  onChange={e => set('soloNuevos', e.target.checked)}
                  className="w-4 h-4 accent-[#2D6A4F]"
                />
                Solo para compradores nuevos (primer pedido)
              </label>
            </Campo>

            {/* Inicio */}
            <Campo label="Válido desde">
              <input
                type="datetime-local"
                value={form.inicio}
                onChange={e => set('inicio', e.target.value)}
                className={inputCls}
              />
            </Campo>

            {/* Fin */}
            <Campo label="Válido hasta">
              <input
                type="datetime-local"
                value={form.fin}
                onChange={e => set('fin', e.target.value)}
                className={inputCls}
              />
            </Campo>
          </div>

          {error && (
            <p className="text-sm text-[#C0392B] bg-[#C0392B]/8 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={crear}
              disabled={creando}
              className="inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
            >
              {creando ? 'Creando…' : 'Crear cupón'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de cupones */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
          <p className="text-sm font-semibold text-[#1A1A1A]/60">
            {cargando ? 'Cargando…' : `${cupones.length} cupón${cupones.length !== 1 ? 'es' : ''}`}
          </p>
        </div>

        {cargando ? (
          <div className="divide-y divide-[#1A1A1A]/5">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="h-5 w-28 bg-[#1A1A1A]/8 rounded animate-pulse" />
                <div className="h-4 w-16 bg-[#1A1A1A]/5 rounded animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        ) : cupones.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="text-base font-semibold text-[#1A1A1A]/60">No hay cupones creados</p>
            <p className="text-sm text-[#1A1A1A]/40 mt-1">Crea el primero con el botón "Nuevo cupón".</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#1A1A1A]/5">
            {cupones.map(c => {
              const estado = estadoCupon(c)
              const puedeDesactivar = c.activo && new Date(c.fin) > new Date()
              return (
                <li key={c.id} className="px-5 py-4 flex items-start gap-4 hover:bg-[#F8F5F0]/60 transition-colors">
                  {/* Código */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-base font-bold text-[#1A1A1A] bg-[#F8F5F0] border border-[#1A1A1A]/8 px-2.5 py-0.5 rounded-lg tracking-wide">
                        {c.codigo}
                      </code>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${estado.color}`}>
                        {estado.label}
                      </span>
                      {c.soloNuevos && (
                        <span className="text-[11px] font-semibold bg-[#52B788]/12 text-[#2D6A4F] px-2 py-0.5 rounded-full">
                          Solo nuevos
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#1A1A1A]/50">
                      <span className="font-semibold text-[#2D6A4F]">{valorDescuento(c)}</span>
                      {c.minimoCompra && (
                        <span>Mínimo {formatearPrecio(Number(c.minimoCompra))}</span>
                      )}
                      <span>
                        {c.usosActuales}{c.usosMaximos ? `/${c.usosMaximos}` : ''} usos
                      </span>
                      <span>{formatearFecha(c.inicio)} → {formatearFecha(c.fin)}</span>
                    </div>
                  </div>

                  {/* Acción */}
                  {puedeDesactivar && (
                    <button
                      type="button"
                      onClick={() => desactivar(c.id)}
                      disabled={desactivando === c.id}
                      className="flex-shrink-0 text-xs font-semibold text-[#C0392B]/60 hover:text-[#C0392B] disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {desactivando === c.id ? 'Desactivando…' : 'Desactivar'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
