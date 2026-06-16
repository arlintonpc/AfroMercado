'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

// ── tipos ─────────────────────────────────────────────────────────────
interface ResumenMes {
  ingresosNetos: number
  ingresosMesPasado: number
  variacionPorcentaje: number | null
  ventasMes: number
  pedidosUrgentes: number
}

interface TendenciaMes {
  mes: string
  neto: number
  pedidos: number
}

interface ProductoVenta {
  id: number
  nombre: string
  fotoUrl: string | null
  precio: string
  cantidadVendida: number
  ingresosGenerados: number
}

interface ProductoSimple {
  id: number
  nombre: string
  fotoUrl: string | null
  precio: string
  stock: number
  stockReservado: number
}

interface ReviewReciente {
  id: number
  calificacion: number
  comentario: string | null
  createdAt: string
  comprador: { nombre: string }
  producto: { nombre: string }
}

interface Insight {
  tipo: 'urgente' | 'alerta' | 'positivo' | 'info'
  texto: string
  accion: { texto: string; href: string } | null
}

interface ProductoVistas {
  id: number
  nombre: string
  fotoUrl: string | null
  precio: string
  vistas: number
}

interface AnaliticasData {
  resumen: ResumenMes
  tendenciaMensual: TendenciaMes[]
  productos: {
    topMasVendidos: ProductoVenta[]
    sinVentas: ProductoSimple[]
    stockCritico: ProductoSimple[]
  }
  vistas: {
    topMasVistos: ProductoVistas[]
    sinVistas: ProductoSimple[]
  }
  reputacion: {
    calificacionPromedio: number
    totalReviews: number
    reviewsRecientes: ReviewReciente[]
  }
  insights: Insight[]
}

// ── helpers ───────────────────────────────────────────────────────────
const cop = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const etiquetaMes = (s: string) => MESES[Number(s.split('-')[1]) - 1] ?? s

const INSIGHT_STYLE: Record<Insight['tipo'], string> = {
  urgente: 'border-red-200 bg-red-50 text-red-800',
  alerta: 'border-amber-200 bg-amber-50 text-amber-800',
  positivo: 'border-[#52B788]/30 bg-[#52B788]/10 text-[#1a5c3a]',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

const INSIGHT_ICON: Record<Insight['tipo'], string> = {
  urgente: '🔔',
  alerta: '⚠️',
  positivo: '✅',
  info: '💡',
}

// ── sub-componentes ───────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin text-[#2D6A4F]" width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Estrellas({ n }: { n: number }) {
  const redondeo = Math.round(n)
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={i <= redondeo ? '#D4A017' : 'none'}
            stroke="#D4A017"
            strokeWidth="1.5"
            strokeOpacity={i <= redondeo ? 1 : 0.35}
          />
        </svg>
      ))}
    </span>
  )
}

function BadgeVariacion({ v }: { v: number | null }) {
  if (v === null) return null
  const sube = v >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
        sube ? 'bg-[#52B788]/15 text-[#2D6A4F]' : 'bg-red-100 text-red-700'
      }`}
    >
      {sube ? '▲' : '▼'} {Math.abs(v).toFixed(0)}%
    </span>
  )
}

function GraficoBarras({ datos }: { datos: TendenciaMes[] }) {
  if (!datos.length) {
    return <p className="text-sm text-[#1A1A1A]/40">Sin datos de ventas en los últimos 6 meses.</p>
  }
  const maxNeto = Math.max(...datos.map((d) => d.neto), 1)
  const H = 120
  const W = 36
  const GAP = 12
  const totalW = datos.length * (W + GAP) - GAP
  return (
    <svg width={totalW} height={H + 38} className="overflow-visible" aria-hidden="true">
      {datos.map((d, i) => {
        const barH = Math.max(4, Math.round((d.neto / maxNeto) * H))
        const x = i * (W + GAP)
        const y = H - barH
        const etiq =
          d.neto >= 1_000_000
            ? `${(d.neto / 1_000_000).toFixed(1)}M`
            : d.neto >= 1_000
            ? `${(d.neto / 1_000).toFixed(0)}k`
            : d.neto.toFixed(0)
        return (
          <g key={d.mes}>
            <rect x={x} y={y} width={W} height={barH} rx={6} fill="#52B788" />
            <text x={x + W / 2} y={H + 20} textAnchor="middle" fontSize="11" fill="#1A1A1A" fillOpacity="0.45">
              {etiquetaMes(d.mes)}
            </text>
            {d.neto > 0 && (
              <text
                x={x + W / 2}
                y={Math.max(y - 7, 11)}
                textAnchor="middle"
                fontSize="10"
                fill="#2D6A4F"
                fontWeight="700"
              >
                {etiq}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function FotoProducto({ url, nombre }: { url: string | null; nombre: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={nombre} className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" />
    )
  }
  return (
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#F0EDE8] text-base">
      📦
    </span>
  )
}

// ── página principal ──────────────────────────────────────────────────
export default function AnalíticasPage() {
  const [data, setData] = useState<AnaliticasData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const token = localStorage.getItem('afromercado_token')
      const res = await fetch(`${API_URL}/comercios/mis-analiticas`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No pudimos cargar las analíticas.')
      const json = await res.json()
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar analíticas.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (cargando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-[#1A1A1A]/50">Calculando tus analíticas…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-700">{error}</p>
        <button
          onClick={cargar}
          className="mt-4 rounded-xl bg-[#2D6A4F] px-5 py-2 text-sm font-semibold text-white hover:bg-[#235a41]"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) return null

  const { resumen, tendenciaMensual, productos, vistas, reputacion, insights } = data
  const hayUrgente = resumen.pedidosUrgentes > 0 || productos.stockCritico.length > 0

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="text-2xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Analíticas de tu tienda
          </h1>
          <p className="mt-0.5 text-sm text-[#1A1A1A]/50">
            Este mes comparado con el mes anterior
          </p>
        </div>
        <button
          onClick={cargar}
          className="inline-flex items-center gap-2 rounded-xl border border-[#1A1A1A]/10 bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A]/60 shadow-sm hover:bg-[#F0EDE8]"
        >
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M1 9a8 8 0 1 0 2.3-5.7" />
            <path d="M1 4v5h5" />
          </svg>
          Actualizar
        </button>
      </div>

      {/* ── Zona urgente ── */}
      {hayUrgente && (
        <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-orange-600">
            Requieren atención ahora
          </p>
          <div className="flex flex-wrap gap-3">
            {resumen.pedidosUrgentes > 0 && (
              <Link
                href="/comerciante/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 shadow-sm hover:shadow-md"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-sm font-bold">
                  {resumen.pedidosUrgentes}
                </span>
                Pedido{resumen.pedidosUrgentes > 1 ? 's' : ''} por preparar
              </Link>
            )}
            {productos.stockCritico.map((p) => (
              <Link
                key={p.id}
                href={`/comerciante/productos/${p.id}/editar`}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 shadow-sm hover:shadow-md"
              >
                <span className="text-orange-400">📦</span>
                {p.nombre} — {p.stock - p.stockReservado} disponibles
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/40">
            Ingresos este mes
          </p>
          <p
            className="mt-2 text-3xl font-bold leading-none text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            {cop(resumen.ingresosNetos)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#1A1A1A]/50">
            <BadgeVariacion v={resumen.variacionPorcentaje} />
            <span>vs {cop(resumen.ingresosMesPasado)} el mes pasado</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/40">
            Pedidos completados
          </p>
          <p
            className="mt-2 text-3xl font-bold leading-none text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            {resumen.ventasMes}
          </p>
          <p className="mt-3 text-xs text-[#1A1A1A]/50">en lo que va del mes</p>
        </div>

        <div className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/40">
            Calificación de clientes
          </p>
          <p
            className="mt-2 text-3xl font-bold leading-none text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            {reputacion.calificacionPromedio.toFixed(1)}
            <span className="ml-1 text-base font-normal text-[#1A1A1A]/30">/ 5</span>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Estrellas n={reputacion.calificacionPromedio} />
            <span className="text-xs text-[#1A1A1A]/40">
              {reputacion.totalReviews} reseña{reputacion.totalReviews !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Vistas de productos ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Más vistos */}
        <div className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-[#1A1A1A]">Productos más vistos</h2>
          <p className="mb-4 text-xs text-[#1A1A1A]/45">Últimos 30 días · visitas únicas por sesión</p>
          {vistas.topMasVistos.length === 0 ? (
            <p className="text-sm text-[#1A1A1A]/40">
              Aún no hay datos de vistas. Se registran automáticamente cuando los compradores abren tus productos.
            </p>
          ) : (
            <ul className="space-y-3">
              {vistas.topMasVistos.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                    {i + 1}
                  </span>
                  <FotoProducto url={p.fotoUrl} nombre={p.nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1A1A1A]">{p.nombre}</p>
                    <p className="text-xs text-[#1A1A1A]/50">{cop(Number(p.precio))}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                    {p.vistas} {p.vistas === 1 ? 'vista' : 'vistas'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sin vistas */}
        <div className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-[#1A1A1A]">Sin vistas este mes</h2>
          <p className="mb-4 text-xs text-[#1A1A1A]/45">Nadie ha abierto estos productos en 30 días</p>
          {vistas.sinVistas.length === 0 ? (
            <p className="text-sm font-semibold text-[#2D6A4F]">
              ¡Todos tus productos recibieron visitas! 👀
            </p>
          ) : (
            <ul className="space-y-3">
              {vistas.sinVistas.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <FotoProducto url={p.fotoUrl} nombre={p.nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1A1A1A]">{p.nombre}</p>
                    <p className="text-xs text-[#1A1A1A]/50">
                      {p.stock - p.stockReservado} disp. · {cop(Number(p.precio))}
                    </p>
                  </div>
                  <Link
                    href={`/comerciante/productos/${p.id}/editar`}
                    className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2D6A4F] hover:bg-[#52B788]/10"
                  >
                    Editar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Gráfico tendencia ── */}
      <div className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-[#1A1A1A]">
          Tendencia de ingresos
        </h2>
        <p className="mb-5 text-xs text-[#1A1A1A]/45">Últimos 6 meses · en pesos COP</p>
        <div className="overflow-x-auto pb-1">
          <GraficoBarras datos={tendenciaMensual} />
        </div>
      </div>

      {/* ── Productos ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Más vendidos */}
        <div className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-[#1A1A1A]">Más vendidos</h2>
          <p className="mb-4 text-xs text-[#1A1A1A]/45">Últimos 30 días · por ingresos</p>
          {productos.topMasVendidos.length === 0 ? (
            <p className="text-sm text-[#1A1A1A]/40">Sin ventas registradas aún.</p>
          ) : (
            <ul className="space-y-3">
              {productos.topMasVendidos.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#52B788]/15 text-xs font-bold text-[#2D6A4F]">
                    {i + 1}
                  </span>
                  <FotoProducto url={p.fotoUrl} nombre={p.nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1A1A1A]">{p.nombre}</p>
                    <p className="text-xs text-[#1A1A1A]/50">
                      {p.cantidadVendida} unid. · {cop(p.ingresosGenerados)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sin ventas */}
        <div className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-[#1A1A1A]">Sin ventas este mes</h2>
          <p className="mb-4 text-xs text-[#1A1A1A]/45">Productos sin pedidos en 30 días</p>
          {productos.sinVentas.length === 0 ? (
            <p className="text-sm font-semibold text-[#2D6A4F]">
              ¡Todos tus productos tuvieron ventas! 🎉
            </p>
          ) : (
            <ul className="space-y-3">
              {productos.sinVentas.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <FotoProducto url={p.fotoUrl} nombre={p.nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1A1A1A]">{p.nombre}</p>
                    <p className="text-xs text-[#1A1A1A]/50">
                      {p.stock - p.stockReservado} disp. · {cop(Number(p.precio))}
                    </p>
                  </div>
                  <Link
                    href={`/comerciante/productos/${p.id}/editar`}
                    className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2D6A4F] hover:bg-[#52B788]/10"
                  >
                    Editar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-[#1A1A1A]">Recomendaciones</h2>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${INSIGHT_STYLE[ins.tipo]}`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-px text-base leading-none">{INSIGHT_ICON[ins.tipo]}</span>
                  <p className="text-sm leading-relaxed">{ins.texto}</p>
                </div>
                {ins.accion && (
                  <Link
                    href={ins.accion.href}
                    className="flex-shrink-0 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white/90"
                  >
                    {ins.accion.texto}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Reseñas recientes ── */}
      {reputacion.reviewsRecientes.length > 0 && (
        <section className="rounded-2xl border border-[#1A1A1A]/6 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-[#1A1A1A]">
            Reseñas recientes de tus productos
          </h2>
          <ul className="divide-y divide-[#1A1A1A]/6">
            {reputacion.reviewsRecientes.map((r) => (
              <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{r.comprador.nombre}</p>
                    <p className="text-xs text-[#1A1A1A]/45">sobre {r.producto.nombre}</p>
                  </div>
                  <Estrellas n={r.calificacion} />
                </div>
                {r.comentario && (
                  <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/65">{r.comentario}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Footer nav ── */}
      <div className="flex justify-center pt-2">
        <Link
          href="/comerciante/dashboard"
          className="text-sm font-medium text-[#2D6A4F] hover:underline"
        >
          ← Volver al panel principal
        </Link>
      </div>
    </div>
  )
}
