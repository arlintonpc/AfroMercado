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

// ── Utilidades ────────────────────────────────────────────────

function fechaCorta(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
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
    <Link href={`/pedido/${sub.pedido.id}`}
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

function FilaProducto({ producto }: { producto: ProductoComerciante }) {
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
      <Link href={`/comerciante/productos/${producto.id}/editar`}
        className="flex-shrink-0 rounded-lg border border-[#2D6A4F] px-4 py-2 text-base font-semibold text-[#2D6A4F] transition-colors hover:bg-[#2D6A4F]/5">
        Editar
      </Link>
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
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarExito, setMostrarExito] = useState(publicado)

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
        const [prods, estadisticas] = await Promise.all([
          listarMisProductos(),
          obtenerMisEstadisticas(),
        ])
        if (activo) { setProductos(prods); setStats(estadisticas) }
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
            {productos.map((p) => <FilaProducto key={p.id} producto={p} />)}
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
