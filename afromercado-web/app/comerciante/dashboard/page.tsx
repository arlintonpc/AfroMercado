'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  obtenerMiComercio,
  listarMisProductos,
  obtenerMisEstadisticas,
  type Comercio,
  type ProductoComerciante,
  type EstadisticasComerciante,
  type SubPedidoComerciante,
} from '@/components/comerciante/api'
import { etiquetaUnidad } from '@/components/comerciante/constantes'

interface SlotMetrica {
  id: number
  tipo: 'CATALOGO' | 'HOME_DESTACADO'
  inicio: string
  fin: string
  vistas: number
  producto?: { nombre: string } | null
}

interface OfertaComerciante {
  id: number
  productoId: number
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: string
  etiqueta: string | null
  inicio: string
  fin: string
  activa: boolean
  stockLimite: number | null
  stockUsado: number
  producto: { id: number; nombre: string; precio: string; fotoUrl: string | null }
}

interface FormOferta {
  productoId: string
  tipo: 'PORCENTAJE' | 'VALOR_FIJO'
  valor: string
  etiqueta: string
  inicio: string
  fin: string
  stockLimite: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

// ── Utilidades ────────────────────────────────────────────────

function fechaCorta(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function localISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function defaultInicio() {
  const d = new Date(); d.setMinutes(d.getMinutes() + 10); d.setSeconds(0, 0)
  return localISO(d)
}
function defaultFin() {
  const d = new Date(); d.setDate(d.getDate() + 7); d.setSeconds(0, 0)
  return localISO(d)
}
function estadoOferta(o: OfertaComerciante): { label: string; color: string } {
  if (!o.activa) return { label: 'Desactivada', color: 'text-[#1A1A1A]/40 bg-[#1A1A1A]/5' }
  const ahora = Date.now()
  if (new Date(o.fin).getTime() < ahora) return { label: 'Expirada', color: 'text-[#1A1A1A]/40 bg-[#1A1A1A]/5' }
  if (new Date(o.inicio).getTime() > ahora) return { label: 'Programada', color: 'text-[#D4A017] bg-[#D4A017]/10' }
  return { label: 'Activa', color: 'text-[#2D6A4F] bg-[#52B788]/15' }
}

// ── Tarjetas de métricas ──────────────────────────────────────

function MetricCard({ valor, etiqueta, acento = false }: { valor: string | number; etiqueta: string; acento?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-4 shadow-sm">
      <p className={`text-3xl leading-none ${acento ? 'text-[#D4A017]' : 'text-[#2D6A4F]'}`}
        style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
        {valor}
      </p>
      <p className="mt-2 text-sm font-medium text-[#1A1A1A]/60 leading-snug">{etiqueta}</p>
    </div>
  )
}

// ── Fila de subpedido ─────────────────────────────────────────

function FilaSubPedido({ sub, resaltado = false }: { sub: SubPedidoComerciante; resaltado?: boolean }) {
  const nombres = sub.items.map(i => i.producto.nombre).join(', ')
  const totalItems = sub.items.reduce((acc, i) => acc + i.cantidad, 0)

  return (
    <Link href="/comerciante/pedidos"
      className={`block rounded-xl border p-4 hover:shadow-sm transition-all ${
        resaltado ? 'border-[#2D6A4F]/30 bg-[#52B788]/5' : 'border-[#1A1A1A]/5 bg-white'
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[#1A1A1A]/40 font-medium">PED-{sub.pedido.id} · {fechaCorta(sub.pedido.createdAt)}</p>
          <p className="text-sm text-[#1A1A1A] mt-0.5 truncate">
            {totalItems} {totalItems === 1 ? 'producto' : 'productos'}: {nombres}
          </p>
          {resaltado && sub.pedido.comprador && (
            <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
              {sub.pedido.comprador.nombre}
              {sub.pedido.comprador.telefono ? ` · ${sub.pedido.comprador.telefono}` : ''}
            </p>
          )}
          {resaltado && sub.pedido.direccionTexto && (
            <p className="text-xs text-[#1A1A1A]/40 mt-0.5 truncate">📍 {sub.pedido.direccionTexto}</p>
          )}
        </div>
        {resaltado
          ? <Badge variant="verde">Confirmar</Badge>
          : <Badge variant="gris">{sub.pedido.estado.replace('_', ' ')}</Badge>
        }
      </div>
    </Link>
  )
}

// ── Productos del comerciante ─────────────────────────────────

function FotoProducto({ producto }: { producto: ProductoComerciante }) {
  if (producto.fotoUrl) {
    return <img src={producto.fotoUrl} alt={producto.nombre} className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" />
  }
  return (
    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-[#52B788]/15" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M4 16l4-4a2 2 0 0 1 3 0l4 4M14 14l1-1a2 2 0 0 1 3 0l2 2M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
          stroke="#2D6A4F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="9" r="1.4" fill="#2D6A4F" />
      </svg>
    </div>
  )
}

function FilaProducto({
  producto,
  onToggle,
}: {
  producto: ProductoComerciante
  onToggle: (id: number, nuevoActivo: boolean) => Promise<void>
}) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      await onToggle(producto.id, !producto.activo)
    } finally {
      setToggling(false)
    }
  }

  return (
    <li className="flex items-center gap-4 rounded-2xl border border-[#1A1A1A]/5 bg-white p-4 shadow-sm">
      <FotoProducto producto={producto} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-[#1A1A1A]">{producto.nombre}</h3>
          {producto.activo ? <Badge variant="verde">Visible</Badge> : <Badge variant="gris">Oculto</Badge>}
        </div>
        <p className="mt-1 text-base text-[#1A1A1A]/70">
          <span className="font-semibold text-[#2D6A4F]">{formatearPrecio(Number(producto.precio))}</span>{' '}
          <span className="text-[#1A1A1A]/50">por {etiquetaUnidad(producto.unidad).toLowerCase()}</span>
        </p>
        <p className="mt-0.5 text-sm text-[#1A1A1A]/55">
          {producto.stock > 0 ? `${producto.stock} disponibles` : 'Sin existencias'}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          title={producto.activo ? 'Ocultar del catálogo' : 'Publicar en el catálogo'}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:ring-offset-2 disabled:opacity-60 ${
            producto.activo ? 'bg-[#2D6A4F]' : 'bg-[#1A1A1A]/20'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              producto.activo ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <Link
          href={`/comerciante/productos/${producto.id}/editar`}
          className="rounded-lg border border-[#2D6A4F] px-4 py-2 text-base font-semibold text-[#2D6A4F] transition-colors hover:bg-[#2D6A4F]/5"
        >
          Editar
        </Link>
      </div>
    </li>
  )
}

// ── Dashboard principal ───────────────────────────────────────

function DashboardContenido() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { usuario } = useAuth()
  const publicado = searchParams.get('publicado') === '1'

  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [productos, setProductos] = useState<ProductoComerciante[]>([])
  const [stats, setStats] = useState<EstadisticasComerciante | null>(null)
  const [slotsActivos, setSlotsActivos] = useState<SlotMetrica[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarExito, setMostrarExito] = useState(publicado)
  const [misOfertas, setMisOfertas] = useState<OfertaComerciante[]>([])
  const [cargandoOfertas, setCargandoOfertas] = useState(false)
  const [mostrarFormOferta, setMostrarFormOferta] = useState(false)
  const [creandoOferta, setCreandoOferta] = useState(false)
  const [errorOferta, setErrorOferta] = useState<string | null>(null)
  const [formOferta, setFormOferta] = useState<FormOferta>(() => ({
    productoId: '', tipo: 'PORCENTAJE', valor: '', etiqueta: '', inicio: defaultInicio(), fin: defaultFin(), stockLimite: '',
  }))

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const c = await obtenerMiComercio()
        if (!activo) return
        if (!c) { router.replace('/comerciante/registro-comercio'); return }
        setComercio(c)
        const token = localStorage.getItem('afromercado_token')
        const [prods, estadisticas, metrRes, ofertasRes] = await Promise.all([
          listarMisProductos(),
          obtenerMisEstadisticas(),
          fetch(`${API_URL}/comercios/visibilidad/metricas`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.ok ? r.json() : { slots: [] }).catch(() => ({ slots: [] })),
          fetch(`${API_URL}/ofertas/mis-ofertas`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
        ])
        if (activo) {
          setProductos(prods)
          setStats(estadisticas)
          setSlotsActivos(metrRes.slots ?? [])
          setMisOfertas(ofertasRes.items ?? [])
        }
      } catch (err) {
        if (activo) setError(err instanceof Error ? err.message : 'No pudimos cargar tu información.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [router])

  useEffect(() => {
    if (!mostrarExito) return
    const t = setTimeout(() => setMostrarExito(false), 6000)
    return () => clearTimeout(t)
  }, [mostrarExito])

  const primerNombre = usuario?.nombre?.split(' ')[0] ?? ''

  async function cargarOfertas() {
    setCargandoOfertas(true)
    try {
      const token = localStorage.getItem('afromercado_token')
      const r = await fetch(`${API_URL}/ofertas/mis-ofertas`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) { const j = await r.json(); setMisOfertas(j.items ?? []) }
    } catch { /* noop */ } finally { setCargandoOfertas(false) }
  }

  async function crearOferta() {
    setErrorOferta(null)
    if (!formOferta.productoId) { setErrorOferta('Selecciona un producto.'); return }
    if (!formOferta.valor) { setErrorOferta('Ingresa el valor del descuento.'); return }
    setCreandoOferta(true)
    try {
      const token = localStorage.getItem('afromercado_token')
      const r = await fetch(`${API_URL}/ofertas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productoId: Number(formOferta.productoId),
          tipo: formOferta.tipo,
          valor: Number(formOferta.valor),
          etiqueta: formOferta.etiqueta || undefined,
          inicio: new Date(formOferta.inicio).toISOString(),
          fin: new Date(formOferta.fin).toISOString(),
          stockLimite: formOferta.stockLimite ? Number(formOferta.stockLimite) : undefined,
        }),
      })
      const json = await r.json()
      if (!r.ok) { setErrorOferta(json.mensaje ?? 'Error al crear la oferta.'); return }
      setMostrarFormOferta(false)
      setFormOferta({ productoId: '', tipo: 'PORCENTAJE', valor: '', etiqueta: '', inicio: defaultInicio(), fin: defaultFin(), stockLimite: '' })
      await cargarOfertas()
    } catch { setErrorOferta('Error de red. Intenta de nuevo.') } finally {
      setCreandoOferta(false)
    }
  }

  async function desactivarOferta(id: number) {
    try {
      const token = localStorage.getItem('afromercado_token')
      const r = await fetch(`${API_URL}/ofertas/${id}/desactivar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) await cargarOfertas()
    } catch { /* noop */ }
  }

  async function toggleProducto(id: number, nuevoActivo: boolean) {
    const token = localStorage.getItem('afromercado_token')
    const r = await fetch(`${API_URL}/productos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ activo: nuevoActivo }),
    })
    if (r.ok) {
      setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, activo: nuevoActivo } : p)))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso publicación exitosa */}
      {mostrarExito && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-[#52B788]/40 bg-[#52B788]/15 px-4 py-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#2D6A4F" />
            <path d="M8 12.5l2.5 2.5L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-base font-semibold text-[#2D6A4F]">¡Tu producto ya está publicado!</p>
        </div>
      )}

      {/* Saludo */}
      <div>
        <h1 className="text-3xl text-[#1A1A1A] leading-tight"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Hola, {primerNombre}
        </h1>
        {comercio && <p className="mt-1 text-base text-[#1A1A1A]/60">Bienvenido a {comercio.nombre}</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cargando ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <MetricCard valor={productos.length} etiqueta="Productos" />
            <MetricCard valor={comercio?.totalVentas ?? 0} etiqueta="Pedidos vendidos" />
            <MetricCard
              valor={stats ? formatearPrecio(stats.ingresosNetos) : '—'}
              etiqueta="Ingresos netos"
              acento
            />
            <MetricCard
              valor={comercio && Number(comercio.calificacion) > 0 ? Number(comercio.calificacion).toFixed(1) : '—'}
              etiqueta="Calificación"
            />
          </>
        )}
      </div>

      {/* Botón publicar */}
      <Link href="/comerciante/publicar" className="block">
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] px-5 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-[#245a42]">
          <span className="text-2xl leading-none">+</span>
          Publicar producto
        </div>
      </Link>

      {/* Por preparar */}
      {!cargando && stats && stats.porPreparar.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xl font-semibold text-[#1A1A1A]">Para preparar</h2>
            <span className="bg-[#2D6A4F] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {stats.porPreparar.length}
            </span>
          </div>
          <p className="text-sm text-[#1A1A1A]/55 mb-3">Pedidos con pago confirmado — coordina el envío con el comprador.</p>
          <div className="flex flex-col gap-2">
            {stats.porPreparar.map(s => <FilaSubPedido key={s.id} sub={s} resaltado />)}
          </div>
        </section>
      )}

      {/* Pedidos recientes */}
      {!cargando && stats && stats.recientes.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-[#1A1A1A] mb-3">Pedidos recientes</h2>
          <div className="flex flex-col gap-2">
            {stats.recientes.map(s => <FilaSubPedido key={s.id} sub={s} />)}
          </div>
        </section>
      )}

      {/* Productos más vendidos */}
      {!cargando && stats && stats.topProductos.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-[#1A1A1A] mb-3">Más vendidos</h2>
          <div className="flex flex-col gap-2">
            {stats.topProductos.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl border border-[#1A1A1A]/5 px-4 py-3">
                <span className="text-lg font-bold text-[#1A1A1A]/20 w-6 text-center">{i + 1}</span>
                {p.fotoUrl
                  ? <img src={p.fotoUrl} alt={p.nombre} className="w-10 h-10 rounded-lg object-cover" />
                  : <div className="w-10 h-10 rounded-lg bg-[#52B788]/15 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M4 16l4-4a2 2 0 0 1 3 0l4 4M14 14l1-1a2 2 0 0 1 3 0l2 2" stroke="#2D6A4F" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    </div>
                }
                <p className="flex-1 text-sm font-semibold text-[#1A1A1A] truncate">{p.nombre}</p>
                <p className="text-sm text-[#2D6A4F] font-bold whitespace-nowrap">{p.cantidadVendida} vendidos</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Métricas de visibilidad activa — Selección Chocó */}
      {!cargando && slotsActivos.length > 0 && (
        <section className="rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#2D6A4F" aria-hidden="true">
              <path d="M17 8C8 10 5.9 16.17 3.82 19.52 3.23 20.5 4.5 21.5 5.3 20.67 7 18.9 8.91 17.5 11 17c-1 3-4 4-4 4s6 0 9-8c1.5 2 2 3.5 2 5.5 0 0 2-10-1-10.5z"/>
            </svg>
            <p className="text-xs font-bold text-[#2D6A4F] uppercase tracking-wider">Selección Chocó · Activo</p>
          </div>
          {slotsActivos.map(slot => (
            <div key={slot.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-3 border border-[#1A1A1A]/5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A1A1A] truncate">
                  {slot.producto?.nombre ?? 'Comercio completo'}
                </p>
                <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
                  {slot.tipo === 'HOME_DESTACADO' ? 'Home · selección especial' : 'Catálogo · posición prioritaria'}
                  {' · hasta '}
                  {new Date(slot.fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-[#2D6A4F] leading-none">{slot.vistas}</p>
                <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">vistas al producto</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Banner publicidad */}
      <section className="rounded-2xl bg-gradient-to-r from-[#2D6A4F]/8 to-[#52B788]/5 border border-[#2D6A4F]/20 px-5 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#2D6A4F" aria-hidden="true">
              <path d="M17 8C8 10 5.9 16.17 3.82 19.52 3.23 20.5 4.5 21.5 5.3 20.67 7 18.9 8.91 17.5 11 17c-1 3-4 4-4 4s6 0 9-8c1.5 2 2 3.5 2 5.5 0 0 2-10-1-10.5z"/>
            </svg>
            <p className="text-xs font-bold text-[#2D6A4F] uppercase tracking-wide">Visibilidad prioritaria · Selección Chocó</p>
          </div>
          <p className="text-sm text-[#1A1A1A]/70 leading-snug">
            Tu producto aparece primero en el catálogo para compradores de todo el país.
            Alcance estimado: <strong className="text-[#1A1A1A]/90">300+ compradores activos por semana.</strong>
          </p>
        </div>
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '573000000000'}?text=${encodeURIComponent('Hola, quiero que mi producto aparezca en la Selección Chocó de AfroMercado. ¿Cómo funciona?')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Quiero destacarme
        </a>
      </section>

      {/* Mis Ofertas */}
      {!cargando && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-[#1A1A1A]">Mis ofertas</h2>
            <button
              type="button"
              onClick={() => { setMostrarFormOferta(v => !v); setErrorOferta(null) }}
              disabled={productos.length === 0}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#2D6A4F] px-3 py-1.5 rounded-xl hover:bg-[#24573f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-base leading-none">{mostrarFormOferta ? '×' : '+'}</span>
              {mostrarFormOferta ? 'Cancelar' : 'Nueva oferta'}
            </button>
          </div>

          {/* Formulario nueva oferta */}
          {mostrarFormOferta && (
            <div className="rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/5 p-4 mb-4 flex flex-col gap-3">
              <p className="text-xs text-[#1A1A1A]/50">Los compradores verán el precio original tachado y el precio con descuento en el catálogo.</p>

              <div>
                <label className="text-xs font-semibold text-[#1A1A1A]/60 block mb-1">Producto</label>
                <select
                  value={formOferta.productoId}
                  onChange={e => setFormOferta(f => ({ ...f, productoId: e.target.value }))}
                  className="w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                >
                  <option value="">-- Selecciona un producto --</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} · {formatearPrecio(Number(p.precio))}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1A1A1A]/60 block mb-1">Tipo de descuento</label>
                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="tipoOferta" value="PORCENTAJE" checked={formOferta.tipo === 'PORCENTAJE'}
                        onChange={() => setFormOferta(f => ({ ...f, tipo: 'PORCENTAJE' }))} />
                      Porcentaje
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="tipoOferta" value="VALOR_FIJO" checked={formOferta.tipo === 'VALOR_FIJO'}
                        onChange={() => setFormOferta(f => ({ ...f, tipo: 'VALOR_FIJO' }))} />
                      Valor fijo
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1A1A1A]/60 block mb-1">
                    {formOferta.tipo === 'PORCENTAJE' ? 'Descuento (1–80%)' : 'Descuento en COP'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formOferta.tipo === 'PORCENTAJE' ? 80 : undefined}
                    value={formOferta.valor}
                    onChange={e => setFormOferta(f => ({ ...f, valor: e.target.value }))}
                    placeholder={formOferta.tipo === 'PORCENTAJE' ? '20' : '5000'}
                    className="w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1A1A1A]/60 block mb-1">Etiqueta <span className="font-normal opacity-60">(opcional)</span></label>
                <input
                  type="text"
                  maxLength={60}
                  value={formOferta.etiqueta}
                  onChange={e => setFormOferta(f => ({ ...f, etiqueta: e.target.value }))}
                  placeholder="Ej: Oferta de lanzamiento, Temporada de cosecha…"
                  className="w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1A1A1A]/60 block mb-1">Inicia</label>
                  <input
                    type="datetime-local"
                    value={formOferta.inicio}
                    onChange={e => setFormOferta(f => ({ ...f, inicio: e.target.value }))}
                    className="w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1A1A1A]/60 block mb-1">Termina</label>
                  <input
                    type="datetime-local"
                    value={formOferta.fin}
                    onChange={e => setFormOferta(f => ({ ...f, fin: e.target.value }))}
                    className="w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1A1A1A]/60 block mb-1">
                  Límite de unidades con descuento <span className="font-normal opacity-60">(opcional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formOferta.stockLimite}
                  onChange={e => setFormOferta(f => ({ ...f, stockLimite: e.target.value }))}
                  placeholder="Sin límite"
                  className="w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
                />
              </div>

              {errorOferta && (
                <p className="text-sm text-[#C0392B] bg-[#C0392B]/8 rounded-xl px-3 py-2">{errorOferta}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={crearOferta}
                  disabled={creandoOferta}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#2D6A4F] px-5 py-2.5 rounded-xl hover:bg-[#24573f] disabled:opacity-50 transition-colors"
                >
                  {creandoOferta ? 'Publicando…' : 'Publicar oferta'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de ofertas */}
          {cargandoOfertas ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ) : misOfertas.length === 0 ? (
            <p className="text-sm text-[#1A1A1A]/40 text-center py-4 rounded-2xl border border-dashed border-[#1A1A1A]/10 bg-white">
              Aún no tienes ofertas. Crea tu primera para atraer más compradores.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {misOfertas.map(o => {
                const estado = estadoOferta(o)
                const puedeDesactivar = o.activa && new Date(o.fin) > new Date()
                return (
                  <li key={o.id} className="flex items-center gap-3 bg-white rounded-xl border border-[#1A1A1A]/5 px-4 py-3">
                    {o.producto.fotoUrl
                      ? <img src={o.producto.fotoUrl} alt={o.producto.nombre} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-[#2D6A4F]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#2D6A4F] text-base font-bold">%</span>
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A1A] truncate">{o.producto.nombre}</p>
                      <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
                        {o.tipo === 'PORCENTAJE' ? `-${Math.round(Number(o.valor))}%` : `-${formatearPrecio(Number(o.valor))}`}
                        {o.etiqueta ? ` · ${o.etiqueta}` : ''}
                        {' · '}
                        {fechaCorta(o.inicio)} – {fechaCorta(o.fin)}
                      </p>
                      {o.stockLimite != null && (
                        <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">{o.stockUsado}/{o.stockLimite} uds. vendidas con descuento</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estado.color}`}>
                        {estado.label}
                      </span>
                      {puedeDesactivar && (
                        <button
                          type="button"
                          onClick={() => desactivarOferta(o.id)}
                          className="text-[10px] font-semibold text-[#C0392B]/60 hover:text-[#C0392B] transition-colors"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Mis productos */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-[#1A1A1A]">Mis productos</h2>
        {cargando ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : productos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2D6A4F]/30 bg-white px-6 py-10 text-center">
            <p className="text-xl text-[#2D6A4F]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              Aún no has publicado productos
            </p>
            <p className="mx-auto mt-2 max-w-sm text-base text-[#1A1A1A]/60">
              ¡Publica el primero y empieza a vender a todo el país!
            </p>
            <div className="mt-5 flex justify-center">
              <Link href="/comerciante/publicar"><Button size="lg">Publicar mi primer producto</Button></Link>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {productos.map((p) => <FilaProducto key={p.id} producto={p} onToggle={toggleProducto} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-[#1A1A1A]/55">Cargando…</div>}>
      <DashboardContenido />
    </Suspense>
  )
}
