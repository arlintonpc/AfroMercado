'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  listarMisOfertas,
  listarMisProductos,
  crearOferta,
  desactivarOferta,
  type Oferta,
  type ProductoComerciante,
} from '@/components/comerciante/api'

// ── Helpers ───────────────────────────────────────────────────

function fechaLocal(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function precioFinal(precio: number | string, tipo: 'PORCENTAJE' | 'VALOR_FIJO', valor: number | string) {
  const p = Number(precio)
  const v = Number(valor)
  if (tipo === 'PORCENTAJE') return Math.max(0, p - p * (v / 100))
  return Math.max(0, p - v)
}

function estaActiva(o: Oferta) {
  const ahora = new Date()
  return o.activa && new Date(o.inicio) <= ahora && new Date(o.fin) >= ahora
}

function estaVigente(o: Oferta) {
  return new Date(o.fin) >= new Date()
}

// ISO para un <input type="datetime-local">
function isoLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ── Página ────────────────────────────────────────────────────

export default function OfertasPage() {
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [productos, setProductos] = useState<ProductoComerciante[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  // Formulario nueva oferta
  const [productoId, setProductoId] = useState('')
  const [tipo, setTipo] = useState<'PORCENTAJE' | 'VALOR_FIJO'>('PORCENTAJE')
  const [valor, setValor] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [inicio, setInicio] = useState(isoLocal(new Date()))
  const fechaFinInicial = new Date()
  fechaFinInicial.setDate(fechaFinInicial.getDate() + 7)
  const [fin, setFin] = useState(isoLocal(fechaFinInicial))
  const [stockLimite, setStockLimite] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [creando, setCreando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [o, p] = await Promise.all([listarMisOfertas(), listarMisProductos()])
      setOfertas(o)
      setProductos(p.filter((pr) => pr.activo))
    } catch {
      /* silencioso */
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

  async function handleDesactivar(id: number) {
    setProcesandoId(id)
    try {
      await desactivarOferta(id)
      setAviso({ tipo: 'exito', texto: 'Oferta desactivada.' })
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo desactivar.' })
    } finally {
      setProcesandoId(null)
    }
  }

  function validarForm() {
    const e: Record<string, string> = {}
    if (!productoId) e.productoId = 'Elige un producto.'
    const v = Number(valor)
    if (!valor || isNaN(v) || v <= 0) e.valor = 'Ingresa un valor mayor a cero.'
    if (tipo === 'PORCENTAJE' && v > 80) e.valor = 'El descuento máximo es 80%.'
    if (!inicio) e.inicio = 'Indica la fecha de inicio.'
    if (!fin) e.fin = 'Indica la fecha de fin.'
    if (inicio && fin && new Date(fin) <= new Date(inicio)) e.fin = 'El fin debe ser posterior al inicio.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!validarForm()) return
    setCreando(true)
    try {
      await crearOferta({
        productoId: Number(productoId),
        tipo,
        valor: Number(valor),
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        etiqueta: etiqueta.trim() || undefined,
        stockLimite: stockLimite ? Number(stockLimite) : undefined,
      })
      setAviso({ tipo: 'exito', texto: 'Oferta creada.' })
      setMostrarForm(false)
      setProductoId(''); setValor(''); setEtiqueta(''); setStockLimite('')
      setTipo('PORCENTAJE')
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al crear oferta.' })
    } finally {
      setCreando(false)
    }
  }

  const productoSeleccionado = productos.find((p) => p.id === Number(productoId))

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Ofertas
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Crea descuentos temporales en tus productos.
          </p>
        </div>
        <Button onClick={() => setMostrarForm((v) => !v)} variant={mostrarForm ? 'secondary' : 'primary'}>
          {mostrarForm ? 'Cancelar' : '+ Nueva oferta'}
        </Button>
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

      {/* Formulario */}
      {mostrarForm && (
        <form
          onSubmit={handleCrear}
          className="rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/5 p-5 sm:p-6 flex flex-col gap-4"
        >
          <h2 className="text-base font-bold text-[#1A1A1A]">Nueva oferta</h2>

          {/* Producto */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[#1A1A1A]/70">Producto</label>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className="rounded-xl border border-[#1A1A1A]/20 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4A017]"
            >
              <option value="">Elige un producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {formatearPrecio(Number(p.precio))}
                </option>
              ))}
            </select>
            {errores.productoId && <p className="text-xs text-[#C0392B]">{errores.productoId}</p>}
          </div>

          {/* Tipo + valor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'PORCENTAJE' | 'VALOR_FIJO')}
                className="rounded-xl border border-[#1A1A1A]/20 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4A017]"
              >
                <option value="PORCENTAJE">Porcentaje (%)</option>
                <option value="VALOR_FIJO">Valor fijo ($)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">
                {tipo === 'PORCENTAJE' ? 'Descuento (%)' : 'Descuento ($)'}
              </label>
              <input
                type="number"
                min="1"
                max={tipo === 'PORCENTAJE' ? '80' : undefined}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={tipo === 'PORCENTAJE' ? 'Ej: 20' : 'Ej: 5000'}
                className="rounded-xl border border-[#1A1A1A]/20 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4A017]"
              />
              {errores.valor && <p className="text-xs text-[#C0392B]">{errores.valor}</p>}
              {productoSeleccionado && valor && !isNaN(Number(valor)) && (
                <p className="text-xs text-[#2D6A4F]">
                  Precio final: {formatearPrecio(precioFinal(productoSeleccionado.precio, tipo, valor))}
                </p>
              )}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Inicio</label>
              <input
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="rounded-xl border border-[#1A1A1A]/20 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4A017]"
              />
              {errores.inicio && <p className="text-xs text-[#C0392B]">{errores.inicio}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Fin</label>
              <input
                type="datetime-local"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className="rounded-xl border border-[#1A1A1A]/20 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4A017]"
              />
              {errores.fin && <p className="text-xs text-[#C0392B]">{errores.fin}</p>}
            </div>
          </div>

          {/* Opcionales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Etiqueta (opcional)</label>
              <input
                type="text"
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value)}
                placeholder="Ej: Cosecha nueva"
                maxLength={40}
                className="rounded-xl border border-[#1A1A1A]/20 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4A017]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Límite de stock (opcional)</label>
              <input
                type="number"
                min="1"
                value={stockLimite}
                onChange={(e) => setStockLimite(e.target.value)}
                placeholder="Sin límite"
                className="rounded-xl border border-[#1A1A1A]/20 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4A017]"
              />
            </div>
          </div>

          <Button type="submit" loading={creando}>Crear oferta</Button>
        </form>
      )}

      {/* Lista de ofertas */}
      {cargando ? (
        <div className="text-sm text-[#1A1A1A]/50 py-8 text-center">Cargando ofertas…</div>
      ) : ofertas.length === 0 ? (
        <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-8 text-center">
          <p className="text-[#1A1A1A]/50 text-sm">No tienes ofertas. Crea una para destacar tus productos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ofertas.map((o) => {
            const activa = estaActiva(o)
            const vigente = estaVigente(o)
            return (
              <div
                key={o.id}
                className={[
                  'rounded-2xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-4',
                  activa ? 'border-[#52B788]/30' : 'border-[#1A1A1A]/8 opacity-70',
                ].join(' ')}
              >
                {/* Producto */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#1A1A1A] text-sm truncate">{o.producto.nombre}</span>
                    {activa && (
                      <span className="inline-flex items-center rounded-full bg-[#52B788]/15 px-2 py-0.5 text-xs font-semibold text-[#2D6A4F]">
                        Activa
                      </span>
                    )}
                    {!activa && vigente && (
                      <span className="inline-flex items-center rounded-full bg-[#D4A017]/15 px-2 py-0.5 text-xs font-semibold text-[#9B7300]">
                        Inactiva
                      </span>
                    )}
                    {!vigente && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                        Vencida
                      </span>
                    )}
                    {o.etiqueta && (
                      <span className="text-xs text-[#1A1A1A]/50">{o.etiqueta}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#1A1A1A]/55">
                    <span>
                      {o.tipo === 'PORCENTAJE'
                        ? `${Number(o.valor)}% de descuento`
                        : `${formatearPrecio(Number(o.valor))} de descuento`}
                    </span>
                    <span>
                      Precio final: {formatearPrecio(precioFinal(o.producto.precio, o.tipo, o.valor))}
                    </span>
                    {o.stockLimite && <span>Límite: {o.stockLimite} unidades</span>}
                  </div>
                  <div className="mt-1 text-xs text-[#1A1A1A]/40">
                    {fechaLocal(o.inicio)} → {fechaLocal(o.fin)}
                  </div>
                </div>

                {/* Acción */}
                {activa && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={procesandoId === o.id}
                    onClick={() => handleDesactivar(o.id)}
                  >
                    Desactivar
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
