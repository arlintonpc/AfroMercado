'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import BotonExportar from '@/components/reportes/BotonExportar'
import type { ComercioMapaAdmin } from '@/components/reportes/MapaAnaliticaTerritorial'

const MapaAnaliticaTerritorial = dynamic(() => import('@/components/reportes/MapaAnaliticaTerritorial'), { ssr: false })

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface KPIItem { valor: number; delta: number | null }
interface Dashboard {
  comision: KPIItem; gmv: KPIItem; pedidos: KPIItem
  ticket_promedio: KPIItem; comercios_activos: KPIItem
  compradores_nuevos: KPIItem; neto_comercios: KPIItem; pagos_cola: KPIItem
}
interface SeriePunto { etiqueta: string; comision: number; gmv: number; pedidos: number }
interface MunicipioRow { municipio: string; comercios: number; pedidos: number; gmv: number; comision: number }
interface ComercioRow { id: number; nombre: string; municipio: string; pedidos: number; gmv: number; comision: number; neto: number; calificacion: number }
interface CuponROI { id: number; codigo: string; tipo: string; valor: number; pedidos: number; gmv_influido: number; costo_descuento: number; comision_generada: number; resultado_neto: number }
interface RiesgoRow { id: number; nombre: string; municipio: string; whatsapp?: string; calificacion: number; ventas_historicas: number; ultima_venta?: string }
interface CategoriaRow { id: number; categoria: string; productos_vendidos: number; comercios: number; pedidos: number; unidades: number; gmv: number; comision_estimada: number }
interface ProductoTopRow { id: number; nombre: string; categoria: string; comercio_id: number; comercio: string; municipio: string; pedidos: number; unidades: number; gmv: number; comision_estimada: number; precio_promedio: number; vistas: number; conversion: number }
interface TerritorioRow { departamento: string; municipio: string; pedidos: number; compradores: number; comercios: number; municipios_origen: number; gmv: number; comision: number; ticket_promedio: number }
interface PagoEstadoRow { estado: string; pagos: number; monto: number }
interface PagoMetodoRow { metodo: string; pagos: number; monto: number }
interface DispersionEstadoRow { estado: string; dispersiones: number; monto_bruto: number; comision: number; monto_neto: number }
interface DispersionProveedorRow { proveedor: string; dispersiones: number; monto_neto: number }
interface PagosData {
  pagosPorEstado: PagoEstadoRow[]
  pagosPorMetodo: PagoMetodoRow[]
  dispersionesPorEstado: DispersionEstadoRow[]
  dispersionesPorProveedor: DispersionProveedorRow[]
}
interface LogisticaEstadoRow { estado: string; entregas: number; pago_repartidores: number }
interface LogisticaZonaRow { departamento: string; municipio: string; entregas: number; entregadas: number; fallidas: number; pago_repartidores: number }
interface LogisticaRepartidorRow { id?: number | null; nombre?: string | null; entregas: number; entregadas: number; fallidas: number; pago_repartidores: number }
interface LogisticaData { porEstado: LogisticaEstadoRow[]; porZona: LogisticaZonaRow[]; porRepartidor: LogisticaRepartidorRow[] }
interface ClientesResumen { compradores_activos: number; compradores_nuevos: number; compradores_recurrentes: number; pedidos: number; gmv: number; ticket_promedio: number }
interface ClienteTopRow { id: number; nombre: string; email: string; telefono?: string | null; municipio: string; pedidos: number; gmv: number; ultima_compra?: string | null }
interface ClientesZonaRow { departamento: string; municipio: string; compradores: number; pedidos: number; gmv: number }
interface ClientesData { resumen: ClientesResumen; topClientes: ClienteTopRow[]; porMunicipio: ClientesZonaRow[] }
interface AlertaProductoSinStock { id: number; nombre: string; categoria: string; comercio: string; municipio: string; stock_disponible: number; vistas: number; unidades: number; gmv: number }
interface AlertaProductoVisto { id: number; nombre: string; categoria: string; comercio: string; municipio: string; stock_disponible: number; vistas: number }
interface AlertaPago { estado: string; pagos: number; monto: number; desde?: string | null; ultimo?: string | null }
interface AlertaDispersion { estado: string; comercio_id: number; comercio: string; municipio: string; dispersiones: number; monto_neto: number; error_mensaje?: string | null; primer_evento?: string | null; ultimo_evento?: string | null }
interface AlertaComercioCaida { id: number; nombre: string; municipio: string; pedidos_actual: number; pedidos_anterior: number; gmv_actual: number; gmv_anterior: number; variacion_pct: number }
interface AlertaZonaEntrega { departamento: string; municipio: string; entregas: number; fallidas: number; tasa_falla: number; pago_repartidores: number }
interface AlertasData {
  productosSinStockConDemanda: AlertaProductoSinStock[]
  productosVistosSinVenta: AlertaProductoVisto[]
  pagosAtencion: AlertaPago[]
  dispersionesAtencion: AlertaDispersion[]
  comerciosCaida: AlertaComercioCaida[]
  zonasEntregaFallida: AlertaZonaEntrega[]
}

function Delta({ v }: { v: number | null }) {
  if (v === null) return null
  const color = v > 2 ? 'text-[#2D6A4F]' : v < -2 ? 'text-red-500' : 'text-[#1A1A1A]/40'
  return <span className={`text-xs font-medium ${color}`}>{v > 0 ? '+' : ''}{v}% MoM</span>
}

function KPICard({ label, valor, delta, moneda = false, verde = false, alerta = false }: {
  label: string; valor: number; delta: number | null; moneda?: boolean; verde?: boolean; alerta?: boolean
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${verde ? 'bg-[#52B788]/10 border-[#52B788]/30' : alerta && valor > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#1A1A1A]/8'}`}>
      <p className="text-xs text-[#1A1A1A]/50 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${verde ? 'text-[#2D6A4F]' : alerta && valor > 0 ? 'text-amber-700' : 'text-[#1A1A1A]'}`}>
        {moneda ? formatearPrecio(valor) : valor.toLocaleString('es-CO')}
      </p>
      {delta !== null && <Delta v={delta}/>}
    </div>
  )
}

// Gráfico de barras SVG simple (misma técnica que analytics existente)
function GraficoBarras({ puntos, campo, color = '#52B788' }: {
  puntos: SeriePunto[]; campo: 'comision' | 'gmv' | 'pedidos'; color?: string
}) {
  if (!puntos.length) return null
  const vals = puntos.map((p) => Number(p[campo]))
  const max  = Math.max(...vals, 1)
  const W = 600; const H = 80; const pad = 4; const bw = Math.max(4, (W - pad * puntos.length) / puntos.length)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {puntos.map((p, i) => {
        const h   = (vals[i] / max) * (H - 8)
        const x   = i * (bw + pad)
        return (
          <g key={i}>
            <rect x={x} y={H - h} width={bw} height={h} rx="2" fill={color} opacity="0.7"/>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Tipos cohortes ───────────────────────────────────────────────────────────
interface CohorteFila { cohorte: string; mes_n: number; compradores: number }

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'ingresos',   label: 'Ingresos' },
  { id: 'territorio', label: 'Territorio' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'productos',  label: 'Productos' },
  { id: 'comercios',  label: 'Comercios' },
  { id: 'alertas',    label: 'Alertas' },
  { id: 'operacion',  label: 'Operación' },
  { id: 'clientes',   label: 'Clientes' },
  { id: 'campanas',   label: 'Campañas' },
  { id: 'retencion',  label: 'Retención' },
] as const
type Tab = typeof TABS[number]['id']

function Contenido() {
  const params = useSearchParams()
  const hoy    = new Date()
  const ini    = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const desde  = params.get('desde') ?? ini
  const hasta  = params.get('hasta') ?? hoy.toISOString().slice(0, 10)

  const [tab, setTab]           = useState<Tab>('dashboard')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [serie, setSerie]       = useState<SeriePunto[]>([])
  const [municipios, setMunicipios] = useState<MunicipioRow[]>([])
  const [comercios, setComercios]   = useState<ComercioRow[]>([])
  const [riesgo, setRiesgo]     = useState<RiesgoRow[]>([])
  const [cuponesROI, setCuponesROI] = useState<CuponROI[]>([])
  const [cohortes, setCohortes] = useState<CohorteFila[]>([])
  const [categorias, setCategorias] = useState<CategoriaRow[]>([])
  const [productos, setProductos] = useState<ProductoTopRow[]>([])
  const [territorios, setTerritorios] = useState<TerritorioRow[]>([])
  const [mapaComercios, setMapaComercios] = useState<ComercioMapaAdmin[]>([])
  const [pagos, setPagos] = useState<PagosData | null>(null)
  const [logistica, setLogistica] = useState<LogisticaData | null>(null)
  const [clientes, setClientes] = useState<ClientesData | null>(null)
  const [alertas, setAlertas] = useState<AlertasData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [serieCampo, setSerieCampo] = useState<'comision' | 'gmv' | 'pedidos'>('comision')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const qs = `?desde=${desde}&hasta=${hasta}`
      const [d, s, m, c, r, cr, co, cat, prod, terr, pag, log, cli, al, mapa] = await Promise.all([
        apiFetch<{ ok: boolean; data: Dashboard }>(`/reportes/admin/dashboard${qs}`),
        apiFetch<{ ok: boolean; data: SeriePunto[] }>(`/reportes/admin/serie${qs}`),
        apiFetch<{ ok: boolean; data: MunicipioRow[] }>(`/reportes/admin/municipios${qs}`),
        apiFetch<{ ok: boolean; data: ComercioRow[] }>(`/reportes/admin/comercios${qs}&limite=20`),
        apiFetch<{ ok: boolean; data: RiesgoRow[] }>('/reportes/admin/riesgo'),
        apiFetch<{ ok: boolean; data: CuponROI[] }>(`/reportes/admin/cupones-roi${qs}`),
        apiFetch<{ ok: boolean; data: CohorteFila[] }>('/reportes/admin/cohortes'),
        apiFetch<{ ok: boolean; data: CategoriaRow[] }>(`/reportes/admin/categorias${qs}&limite=50`),
        apiFetch<{ ok: boolean; data: ProductoTopRow[] }>(`/reportes/admin/productos${qs}&limite=50`),
        apiFetch<{ ok: boolean; data: TerritorioRow[] }>(`/reportes/admin/territorios${qs}&limite=80`),
        apiFetch<{ ok: boolean; data: PagosData }>(`/reportes/admin/pagos${qs}`),
        apiFetch<{ ok: boolean; data: LogisticaData }>(`/reportes/admin/logistica${qs}`),
        apiFetch<{ ok: boolean; data: ClientesData }>(`/reportes/admin/clientes${qs}`),
        apiFetch<{ ok: boolean; data: AlertasData }>(`/reportes/admin/alertas${qs}`),
        apiFetch<{ ok: boolean; data: ComercioMapaAdmin[] }>(`/reportes/admin/mapa${qs}`),
      ])
      setDashboard(d?.data ?? null)
      setSerie(s?.data ?? [])
      setMunicipios(m?.data ?? [])
      setComercios(c?.data ?? [])
      setRiesgo(r?.data ?? [])
      setCuponesROI(cr?.data ?? [])
      setCohortes(co?.data ?? [])
      setCategorias(cat?.data ?? [])
      setProductos(prod?.data ?? [])
      setTerritorios(terr?.data ?? [])
      setPagos(pag?.data ?? null)
      setLogistica(log?.data ?? null)
      setClientes(cli?.data ?? null)
      setAlertas(al?.data ?? null)
      setMapaComercios(mapa?.data ?? [])
    } catch { /**/ } finally { setCargando(false) }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const totalAlertas = alertas
    ? alertas.productosSinStockConDemanda.length
      + alertas.productosVistosSinVenta.length
      + alertas.pagosAtencion.length
      + alertas.dispersionesAtencion.length
      + alertas.comerciosCaida.length
      + alertas.zonasEntregaFallida.length
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">← Admin</Link>
          <h1 className="text-3xl text-[#1A1A1A] mt-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Reportería estratégica
          </h1>
          <p className="text-sm text-[#1A1A1A]/50 mt-0.5">Ingresos, comercios, campañas y análisis del marketplace.</p>
        </div>
        <BotonExportar
          endpoint="/reportes/admin/exportar"
          params={{ desde, hasta }}
          nombreBase="admin-maestro"
        />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 shadow-sm">
        <FiltroFechas />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-[#F8F5F0] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              tab === t.id ? 'bg-white text-[#2D6A4F] shadow-sm' : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
            }`}
          >
            {t.label}
            {t.id === 'alertas' && totalAlertas > 0 && (
              <span className={`ml-2 rounded-full px-1.5 text-[10px] font-bold ${
                tab === t.id ? 'bg-[#C0392B] text-white' : 'bg-[#C0392B]/10 text-[#C0392B]'
              }`}>
                {totalAlertas}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Dashboard ─────────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <>
          {/* 8 KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cargando || !dashboard ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 bg-[#1A1A1A]/6 rounded-2xl animate-pulse"/>
              ))
            ) : (
              <>
                <KPICard label="Comisión (ingreso)"    valor={dashboard.comision.valor}          delta={dashboard.comision.delta}          moneda verde/>
                <KPICard label="GMV"                    valor={dashboard.gmv.valor}               delta={dashboard.gmv.delta}               moneda/>
                <KPICard label="Pedidos confirmados"   valor={dashboard.pedidos.valor}            delta={dashboard.pedidos.delta}/>
                <KPICard label="Ticket promedio"       valor={dashboard.ticket_promedio.valor}    delta={dashboard.ticket_promedio.delta}   moneda/>
                <KPICard label="Comercios activos"     valor={dashboard.comercios_activos.valor}  delta={dashboard.comercios_activos.delta}/>
                <KPICard label="Compradores nuevos"    valor={dashboard.compradores_nuevos.valor} delta={dashboard.compradores_nuevos.delta}/>
                <KPICard label="Neto a comercios"      valor={dashboard.neto_comercios.valor}     delta={dashboard.neto_comercios.delta}    moneda/>
                <KPICard label="Pagos por verificar"   valor={dashboard.pagos_cola.valor}         delta={null}                              alerta/>
              </>
            )}
          </div>

          {(categorias[0] || productos[0] || territorios[0] || comercios[0]) && (
            <div className="grid gap-3 md:grid-cols-4">
              {categorias[0] && (
                <div className="rounded-2xl border border-[#D4A017]/25 bg-[#D4A017]/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#9B7300]">Categoría líder</p>
                  <p className="mt-1 font-bold text-[#1A1A1A]">{categorias[0].categoria}</p>
                  <p className="text-xs text-[#1A1A1A]/50">{formatearPrecio(Number(categorias[0].gmv))} en ventas</p>
                </div>
              )}
              {productos[0] && (
                <div className="rounded-2xl border border-[#52B788]/25 bg-[#52B788]/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#2D6A4F]">Producto líder</p>
                  <p className="mt-1 font-bold text-[#1A1A1A]">{productos[0].nombre}</p>
                  <p className="text-xs text-[#1A1A1A]/50">{productos[0].comercio} · {Number(productos[0].unidades).toLocaleString('es-CO')} unidades</p>
                </div>
              )}
              {territorios[0] && (
                <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#1A1A1A]/40">Territorio comprador</p>
                  <p className="mt-1 font-bold text-[#1A1A1A]">{territorios[0].municipio}</p>
                  <p className="text-xs text-[#1A1A1A]/50">{territorios[0].departamento} · {territorios[0].pedidos} pedidos</p>
                </div>
              )}
              {comercios[0] && (
                <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#1A1A1A]/40">Comercio líder</p>
                  <p className="mt-1 font-bold text-[#1A1A1A]">{comercios[0].nombre}</p>
                  <p className="text-xs text-[#1A1A1A]/50">{formatearPrecio(Number(comercios[0].gmv))} · {comercios[0].municipio}</p>
                </div>
              )}
            </div>
          )}

          {/* Serie temporal */}
          {serie.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-[#1A1A1A]">Evolución en el periodo</p>
                <div className="flex gap-1">
                  {(['comision','gmv','pedidos'] as const).map((c) => (
                    <button key={c} onClick={() => setSerieCampo(c)}
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors ${serieCampo === c ? 'bg-[#52B788]/15 border-[#2D6A4F]/30 text-[#2D6A4F] font-semibold' : 'border-[#1A1A1A]/10 text-[#1A1A1A]/50 hover:bg-[#F8F5F0]'}`}>
                      {c === 'comision' ? 'Comisión' : c === 'gmv' ? 'GMV' : 'Pedidos'}
                    </button>
                  ))}
                </div>
              </div>
              <GraficoBarras puntos={serie} campo={serieCampo}/>
              <div className="flex justify-between mt-1">
                {serie.length <= 12 && serie.map((p) => (
                  <span key={p.etiqueta} className="text-[9px] text-[#1A1A1A]/30">{p.etiqueta.slice(-5)}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Ingresos ────────────────────────────────────────────────── */}
      {tab === 'ingresos' && (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
            <p className="text-sm font-semibold text-[#1A1A1A]/60">Ingresos por municipio</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                <tr>{['Municipio','Comercios','Pedidos','GMV','Comisión'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]/5">
                {cargando ? [1,2,3].map((i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>
                )) : municipios.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#1A1A1A]/40">Sin datos en el rango seleccionado</td></tr>
                ) : municipios.map((m) => (
                  <tr key={m.municipio} className="hover:bg-[#F8F5F0]/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{m.municipio}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{m.comercios}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{m.pedidos}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/70">{formatearPrecio(Number(m.gmv))}</td>
                    <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(m.comision))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Territorio ──────────────────────────────────────────────── */}
      {tab === 'territorio' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Mapa territorial</p>
              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">
                Comercios con ubicación GPS real ({mapaComercios.length}) — el tamaño del punto es proporcional al GMV del periodo.
              </p>
            </div>
            <div className="p-4">
              <MapaAnaliticaTerritorial comercios={mapaComercios} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Origen comercial: municipio del comercio</p>
              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Dónde están los comercios que generan ventas.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Municipio','Comercios','Pedidos','GMV','Comisión'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {municipios.length === 0 && !cargando ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#1A1A1A]/40">Sin ventas por municipio de comercio.</td></tr>
                  ) : municipios.map((m) => (
                    <tr key={m.municipio} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{m.municipio}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{m.comercios}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{m.pedidos}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/70">{formatearPrecio(Number(m.gmv))}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(m.comision))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Destino de compradores</p>
              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">A qué territorios llega la demanda y cuánto compra cada zona.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Departamento','Municipio','Compradores','Comercios','Pedidos','Ticket','GMV'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {territorios.length === 0 && !cargando ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#1A1A1A]/40">Sin datos territoriales en el rango.</td></tr>
                  ) : territorios.map((t) => (
                    <tr key={`${t.departamento}-${t.municipio}`} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3 text-[#1A1A1A]/50">{t.departamento}</td>
                      <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{t.municipio}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{t.compradores}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{t.comercios}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{t.pedidos}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{formatearPrecio(Number(t.ticket_promedio))}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(t.gmv))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ── Tab: Categorías ──────────────────────────────────────────────── */}
      {tab === 'categorias' && (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
            <p className="text-sm font-semibold text-[#1A1A1A]/60">Categorías que más venden</p>
            <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Sirve para decidir campañas, hero, inventario y expansión de oferta.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                <tr>{['Categoría','Productos','Comercios','Pedidos','Unidades','GMV','Comisión est.'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]/5">
                {cargando ? [1,2,3].map((i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>
                )) : categorias.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#1A1A1A]/40">Sin ventas por categoría en este periodo.</td></tr>
                ) : categorias.map((c, idx) => (
                  <tr key={c.id || c.categoria} className="hover:bg-[#F8F5F0]/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-xs text-[#1A1A1A]/30">{idx + 1}</span>
                        <span className="font-semibold text-[#1A1A1A]">{c.categoria}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{c.productos_vendidos}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{c.comercios}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{c.pedidos}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{Number(c.unidades).toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/70">{formatearPrecio(Number(c.gmv))}</td>
                    <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(c.comision_estimada))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Productos ───────────────────────────────────────────────── */}
      {tab === 'productos' && (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
            <p className="text-sm font-semibold text-[#1A1A1A]/60">Productos líderes del marketplace</p>
            <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Ranking global por GMV, con categoría, comercio, vistas y conversión.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                <tr>{['Producto','Categoría','Comercio','Municipio','Pedidos','Unidades','GMV','Vistas','Conversión'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]/5">
                {cargando ? [1,2,3,4].map((i) => (
                  <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>
                )) : productos.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[#1A1A1A]/40">Sin productos vendidos en este periodo.</td></tr>
                ) : productos.map((p, idx) => (
                  <tr key={`${p.id}-${p.comercio_id}`} className="hover:bg-[#F8F5F0]/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-xs text-[#1A1A1A]/30">{idx + 1}</span>
                        <span className="font-semibold text-[#1A1A1A]">{p.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#1A1A1A]/50">{p.categoria}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/70">{p.comercio}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/50">{p.municipio}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{p.pedidos}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{Number(p.unidades).toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(p.gmv))}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]/60">{Number(p.vistas).toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${Number(p.conversion) >= 5 ? 'text-[#2D6A4F]' : Number(p.conversion) >= 2 ? 'text-amber-600' : 'text-[#1A1A1A]/45'}`}>
                        {Number(p.conversion).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Comercios ───────────────────────────────────────────────── */}
      {tab === 'comercios' && (
        <div className="flex flex-col gap-4">
          {/* Ranking */}
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Top 20 por comisión generada</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[620px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Comercio','Municipio','Pedidos','GMV','Comisión','Neto','Calif.'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {cargando ? [1,2,3].map((i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>
                  )) : comercios.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#1A1A1A]/30 w-5">{idx + 1}</span>
                          <p className="font-semibold text-[#1A1A1A]">{c.nombre}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#1A1A1A]/50 text-xs">{c.municipio}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{c.pedidos}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/70">{formatearPrecio(Number(c.gmv))}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(c.comision))}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{formatearPrecio(Number(c.neto))}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60 text-xs">{Number(c.calificacion).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comercios en riesgo */}
          {riesgo.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-200">
                <p className="text-sm font-semibold text-amber-800">⚠ {riesgo.length} comercio{riesgo.length > 1 ? 's' : ''} en riesgo de abandono</p>
                <p className="text-xs text-amber-600 mt-0.5">Sin ventas en 30+ días o sin ventas históricas.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[540px]">
                  <thead className="bg-amber-100/60">
                    <tr>{['Comercio','Municipio','Última venta','Ventas hist.','Calificación','Contactar'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-amber-700">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200/60">
                    {riesgo.map((r) => (
                      <tr key={r.id} className="hover:bg-amber-100/40 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-amber-900">{r.nombre}</td>
                        <td className="px-4 py-2.5 text-amber-700 text-xs">{r.municipio}</td>
                        <td className="px-4 py-2.5 text-amber-700 text-xs">
                          {r.ultima_venta ? new Date(r.ultima_venta).toLocaleDateString('es-CO') : <span className="text-amber-500">Nunca</span>}
                        </td>
                        <td className="px-4 py-2.5 text-amber-700">{r.ventas_historicas}</td>
                        <td className="px-4 py-2.5 text-amber-700 text-xs">{Number(r.calificacion).toFixed(1)}</td>
                        <td className="px-4 py-2.5">
                          {r.whatsapp && (
                            <a
                              href={`https://wa.me/${r.whatsapp.replace(/\D/g,'')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#2D6A4F] hover:underline font-medium"
                            >
                              WhatsApp →
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Alertas ────────────────────────────────────────────────── */}
      {tab === 'alertas' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {[
              { label: 'Agotados con demanda', valor: alertas?.productosSinStockConDemanda.length ?? 0, alerta: true },
              { label: 'Vistos sin venta', valor: alertas?.productosVistosSinVenta.length ?? 0, alerta: true },
              { label: 'Pagos atención', valor: alertas?.pagosAtencion.length ?? 0, alerta: true },
              { label: 'Dispersión atención', valor: alertas?.dispersionesAtencion.length ?? 0, alerta: true },
              { label: 'Comercios en caída', valor: alertas?.comerciosCaida.length ?? 0, alerta: true },
              { label: 'Zonas con fallas', valor: alertas?.zonasEntregaFallida.length ?? 0, alerta: true },
            ].map((a) => (
              <KPICard key={a.label} label={a.label} valor={a.valor} delta={null} alerta={a.alerta} />
            ))}
          </div>

          {totalAlertas === 0 && !cargando && (
            <div className="rounded-2xl border border-[#52B788]/25 bg-[#52B788]/10 px-5 py-10 text-center">
              <p className="font-semibold text-[#2D6A4F]">Sin alertas críticas en este periodo.</p>
              <p className="mt-1 text-sm text-[#1A1A1A]/45">La operación no muestra señales urgentes según las reglas actuales.</p>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-red-50">
                <p className="text-sm font-semibold text-red-700">Productos agotados con demanda</p>
                <p className="text-xs text-red-500 mt-0.5">Hay vistas o ventas recientes, pero el stock disponible es cero.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                    <tr>{['Producto','Categoría','Comercio','Vistas','Unidades','GMV'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {(alertas?.productosSinStockConDemanda ?? []).length === 0 && !cargando ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin productos agotados con demanda.</td></tr>
                    ) : (alertas?.productosSinStockConDemanda ?? []).map((p) => (
                      <tr key={p.id} className="hover:bg-[#F8F5F0]/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{p.nombre}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/50">{p.categoria}</td>
                        <td className="px-4 py-3">
                          <p className="text-[#1A1A1A]/70">{p.comercio}</p>
                          <p className="text-xs text-[#1A1A1A]/40">{p.municipio}</p>
                        </td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{p.vistas}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{p.unidades}</td>
                        <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(p.gmv))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-amber-50">
                <p className="text-sm font-semibold text-amber-800">Productos vistos pero sin venta</p>
                <p className="text-xs text-amber-600 mt-0.5">Posible problema de precio, foto, confianza o descripción.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                    <tr>{['Producto','Categoría','Comercio','Vistas','Stock'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {(alertas?.productosVistosSinVenta ?? []).length === 0 && !cargando ? (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin productos vistos sin venta.</td></tr>
                    ) : (alertas?.productosVistosSinVenta ?? []).map((p) => (
                      <tr key={p.id} className="hover:bg-[#F8F5F0]/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{p.nombre}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/50">{p.categoria}</td>
                        <td className="px-4 py-3">
                          <p className="text-[#1A1A1A]/70">{p.comercio}</p>
                          <p className="text-xs text-[#1A1A1A]/40">{p.municipio}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber-700">{p.vistas}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{p.stock_disponible}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
                <p className="text-sm font-semibold text-[#1A1A1A]/60">Pagos y dispersión que requieren atención</p>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#1A1A1A]/8 overflow-hidden">
                  <div className="bg-[#F8F5F0]/70 px-3 py-2 text-xs font-semibold text-[#1A1A1A]/50">Pagos</div>
                  {(alertas?.pagosAtencion ?? []).length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-[#1A1A1A]/35">Sin pagos en alerta.</p>
                  ) : (alertas?.pagosAtencion ?? []).map((p) => (
                    <div key={p.estado} className="border-t border-[#1A1A1A]/5 px-3 py-2">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{p.estado}</p>
                      <p className="text-xs text-[#1A1A1A]/50">{p.pagos} pagos · {formatearPrecio(Number(p.monto))}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-[#1A1A1A]/8 overflow-hidden">
                  <div className="bg-[#F8F5F0]/70 px-3 py-2 text-xs font-semibold text-[#1A1A1A]/50">Dispersión</div>
                  {(alertas?.dispersionesAtencion ?? []).length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-[#1A1A1A]/35">Sin dispersiones en alerta.</p>
                  ) : (alertas?.dispersionesAtencion ?? []).slice(0, 8).map((d) => (
                    <div key={`${d.estado}-${d.comercio_id}`} className="border-t border-[#1A1A1A]/5 px-3 py-2">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{d.comercio}</p>
                      <p className="text-xs text-[#1A1A1A]/50">{d.estado} · {d.dispersiones} · {formatearPrecio(Number(d.monto_neto))}</p>
                      {d.error_mensaje && <p className="mt-1 text-[11px] text-red-500">{d.error_mensaje}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
                <p className="text-sm font-semibold text-[#1A1A1A]/60">Comercios con caída fuerte</p>
                <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Comparado contra el periodo anterior equivalente.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                    <tr>{['Comercio','Municipio','Variación','GMV actual','GMV anterior','Pedidos'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {(alertas?.comerciosCaida ?? []).length === 0 && !cargando ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin caídas fuertes detectadas.</td></tr>
                    ) : (alertas?.comerciosCaida ?? []).map((c) => (
                      <tr key={c.id} className="hover:bg-[#F8F5F0]/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{c.nombre}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/50">{c.municipio}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{Number(c.variacion_pct).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{formatearPrecio(Number(c.gmv_actual))}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{formatearPrecio(Number(c.gmv_anterior))}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/50">{c.pedidos_actual}/{c.pedidos_anterior}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden xl:col-span-2">
              <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
                <p className="text-sm font-semibold text-[#1A1A1A]/60">Zonas con fallas de entrega</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                    <tr>{['Departamento','Municipio','Entregas','Fallidas','Tasa falla','Pago repartidores'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {(alertas?.zonasEntregaFallida ?? []).length === 0 && !cargando ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin zonas con fallas relevantes.</td></tr>
                    ) : (alertas?.zonasEntregaFallida ?? []).map((z) => (
                      <tr key={`${z.departamento}-${z.municipio}`} className="hover:bg-[#F8F5F0]/60 transition-colors">
                        <td className="px-4 py-3 text-[#1A1A1A]/50">{z.departamento}</td>
                        <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{z.municipio}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{z.entregas}</td>
                        <td className="px-4 py-3 text-red-500">{z.fallidas}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{Number(z.tasa_falla).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{formatearPrecio(Number(z.pago_repartidores))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Operación ──────────────────────────────────────────────── */}
      {tab === 'operacion' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Pagos por estado</p>
              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Controla confirmados, fallidos y pagos en cola.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Estado','Pagos','Monto'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {(pagos?.pagosPorEstado ?? []).length === 0 && !cargando ? (
                    <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin pagos en el periodo.</td></tr>
                  ) : (pagos?.pagosPorEstado ?? []).map((p) => (
                    <tr key={p.estado} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{p.estado}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{p.pagos}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(p.monto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Dispersión a comercios</p>
              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Dinero programado, enviado, confirmado o fallido por la pasarela.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Estado','Dispersiones','Bruto','Comisión','Neto'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {(pagos?.dispersionesPorEstado ?? []).length === 0 && !cargando ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin dispersiones en el periodo.</td></tr>
                  ) : (pagos?.dispersionesPorEstado ?? []).map((d) => (
                    <tr key={d.estado} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{d.estado}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{d.dispersiones}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{formatearPrecio(Number(d.monto_bruto))}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{formatearPrecio(Number(d.comision))}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(d.monto_neto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Entregas por estado</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Estado','Entregas','Pago repartidores'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {(logistica?.porEstado ?? []).length === 0 && !cargando ? (
                    <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin entregas registradas.</td></tr>
                  ) : (logistica?.porEstado ?? []).map((e) => (
                    <tr key={e.estado} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{e.estado}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{e.entregas}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(e.pago_repartidores))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Zonas logísticas críticas</p>
              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Útil para ajustar cobertura, repartidores y tarifas.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[620px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Zona','Entregas','Entregadas','Fallidas','Pago repart.'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {(logistica?.porZona ?? []).length === 0 && !cargando ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin zonas con entregas en el periodo.</td></tr>
                  ) : (logistica?.porZona ?? []).map((z) => (
                    <tr key={`${z.departamento}-${z.municipio}`} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1A1A1A]">{z.municipio}</p>
                        <p className="text-xs text-[#1A1A1A]/40">{z.departamento}</p>
                      </td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{z.entregas}</td>
                      <td className="px-4 py-3 text-[#2D6A4F]">{z.entregadas}</td>
                      <td className="px-4 py-3 text-red-500">{z.fallidas}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(z.pago_repartidores))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Medios de pago</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Método','Pagos','Monto'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {(pagos?.pagosPorMetodo ?? []).length === 0 && !cargando ? (
                    <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin pagos por método en el periodo.</td></tr>
                  ) : (pagos?.pagosPorMetodo ?? []).map((p) => (
                    <tr key={p.metodo} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{p.metodo}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{p.pagos}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(p.monto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Repartidores</p>
              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Productividad y fallas por repartidor asignado.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Repartidor','Entregas','Entregadas','Fallidas','Pago'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {(logistica?.porRepartidor ?? []).length === 0 && !cargando ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin repartidores en el periodo.</td></tr>
                  ) : (logistica?.porRepartidor ?? []).map((r, idx) => (
                    <tr key={r.id ?? `sin-${idx}`} className="hover:bg-[#F8F5F0]/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{r.nombre ?? 'Sin asignar'}</td>
                      <td className="px-4 py-3 text-[#1A1A1A]/60">{r.entregas}</td>
                      <td className="px-4 py-3 text-[#2D6A4F]">{r.entregadas}</td>
                      <td className="px-4 py-3 text-red-500">{r.fallidas}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(r.pago_repartidores))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Clientes ───────────────────────────────────────────────── */}
      {tab === 'clientes' && (
        <div className="flex flex-col gap-4">
          {clientes?.resumen && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <KPICard label="Compradores activos" valor={Number(clientes.resumen.compradores_activos ?? 0)} delta={null} />
              <KPICard label="Nuevos" valor={Number(clientes.resumen.compradores_nuevos ?? 0)} delta={null} verde />
              <KPICard label="Recurrentes" valor={Number(clientes.resumen.compradores_recurrentes ?? 0)} delta={null} />
              <KPICard label="Pedidos" valor={Number(clientes.resumen.pedidos ?? 0)} delta={null} />
              <KPICard label="GMV clientes" valor={Number(clientes.resumen.gmv ?? 0)} delta={null} moneda />
              <KPICard label="Ticket promedio" valor={Number(clientes.resumen.ticket_promedio ?? 0)} delta={null} moneda />
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
                <p className="text-sm font-semibold text-[#1A1A1A]/60">Top compradores</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                    <tr>{['Cliente','Municipio','Pedidos','GMV','Última compra'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {(clientes?.topClientes ?? []).length === 0 && !cargando ? (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin clientes en el periodo.</td></tr>
                    ) : (clientes?.topClientes ?? []).map((c) => (
                      <tr key={c.id} className="hover:bg-[#F8F5F0]/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#1A1A1A]">{c.nombre}</p>
                          <p className="text-xs text-[#1A1A1A]/40">{c.email}</p>
                        </td>
                        <td className="px-4 py-3 text-[#1A1A1A]/50">{c.municipio}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{c.pedidos}</td>
                        <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(c.gmv))}</td>
                        <td className="px-4 py-3 text-xs text-[#1A1A1A]/50">
                          {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('es-CO') : 'Sin dato'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
                <p className="text-sm font-semibold text-[#1A1A1A]/60">Compradores por territorio</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                    <tr>{['Departamento','Municipio','Compradores','Pedidos','GMV'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {(clientes?.porMunicipio ?? []).length === 0 && !cargando ? (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#1A1A1A]/40">Sin territorios de clientes en el periodo.</td></tr>
                    ) : (clientes?.porMunicipio ?? []).map((z) => (
                      <tr key={`${z.departamento}-${z.municipio}`} className="hover:bg-[#F8F5F0]/60 transition-colors">
                        <td className="px-4 py-3 text-[#1A1A1A]/50">{z.departamento}</td>
                        <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{z.municipio}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{z.compradores}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/60">{z.pedidos}</td>
                        <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(Number(z.gmv))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Retención (cohortes) ────────────────────────────────────── */}
      {tab === 'retencion' && (() => {
        const porCohorte = new Map<string, Map<number, number>>()
        for (const r of cohortes) {
          const mes = Number(r.mes_n)
          if (!porCohorte.has(r.cohorte)) porCohorte.set(r.cohorte, new Map())
          porCohorte.get(r.cohorte)!.set(mes, Number(r.compradores))
        }
        const listaCohortes = Array.from(porCohorte.keys()).sort()
        const maxMes = cohortes.length ? Math.max(...cohortes.map((r) => Number(r.mes_n))) : 0
        const meses = Array.from({ length: maxMes + 1 }, (_, i) => i)

        return (
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
              <p className="text-sm font-semibold text-[#1A1A1A]/60">Retención por cohorte mensual</p>
              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Porcentaje de compradores de cada cohorte que volvieron a comprar en meses siguientes.</p>
            </div>
            {cargando ? (
              <div className="p-5"><div className="h-40 bg-[#1A1A1A]/6 rounded-2xl animate-pulse"/></div>
            ) : listaCohortes.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-[#1A1A1A]/40">Sin datos suficientes para calcular cohortes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs min-w-max">
                  <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[#1A1A1A]/50 font-semibold whitespace-nowrap sticky left-0 bg-[#F8F5F0]/80">Cohorte</th>
                      <th className="px-3 py-2.5 text-center text-[#1A1A1A]/50 font-semibold whitespace-nowrap">Compradores</th>
                      {meses.slice(1).map((m) => (
                        <th key={m} className="px-3 py-2.5 text-center text-[#1A1A1A]/50 font-semibold whitespace-nowrap">M+{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {listaCohortes.map((cohorte) => {
                      const mapa = porCohorte.get(cohorte)!
                      const m0 = mapa.get(0) ?? 0
                      return (
                        <tr key={cohorte} className="hover:bg-[#F8F5F0]/40 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-[#1A1A1A] sticky left-0 bg-white whitespace-nowrap">{cohorte}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-[#1A1A1A]">{m0}</td>
                          {meses.slice(1).map((m) => {
                            const cnt = mapa.get(m) ?? null
                            const pct = cnt !== null && m0 > 0 ? Math.round((cnt / m0) * 100) : null
                            const bg = pct !== null ? `rgba(82,183,136,${(pct / 100) * 0.85 + 0.05})` : 'transparent'
                            const textColor = pct !== null && pct > 55 ? '#fff' : '#1A1A1A'
                            return (
                              <td key={m} className="px-3 py-2.5 text-center whitespace-nowrap" style={{ background: bg, color: textColor }}>
                                {pct !== null ? `${pct}%` : <span className="text-[#1A1A1A]/20">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="px-5 py-3 text-[10px] text-[#1A1A1A]/30 border-t border-[#1A1A1A]/5">
              M+1 = compradores de esa cohorte que compraron al mes siguiente, expresado como % del total de la cohorte.
            </p>
          </div>
        )
      })()}

      {/* ── Tab: Campañas ────────────────────────────────────────────────── */}
      {tab === 'campanas' && (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
            <p className="text-sm font-semibold text-[#1A1A1A]/60">ROI por cupón — pedidos confirmados en el periodo</p>
          </div>
          {cuponesROI.length === 0 && !cargando ? (
            <p className="px-5 py-12 text-center text-sm text-[#1A1A1A]/40">Sin cupones con redenciones en este periodo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
                  <tr>{['Código','Tipo','Pedidos','GMV influido','Costo descuento','Comisión gen.','Resultado neto'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {cargando ? [1,2,3].map((i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>
                  )) : cuponesROI.map((c) => {
                    const positivo = Number(c.resultado_neto) >= 0
                    return (
                      <tr key={c.id} className="hover:bg-[#F8F5F0]/60 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/cupones/${c.id}`} className="font-mono text-xs font-bold text-[#2D6A4F] hover:underline">{c.codigo}</Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#1A1A1A]/50">{c.tipo}</td>
                        <td className="px-4 py-3">{c.pedidos}</td>
                        <td className="px-4 py-3 text-[#1A1A1A]/70">{formatearPrecio(Number(c.gmv_influido))}</td>
                        <td className="px-4 py-3 text-red-500">−{formatearPrecio(Number(c.costo_descuento))}</td>
                        <td className="px-4 py-3 text-[#2D6A4F]">{formatearPrecio(Number(c.comision_generada))}</td>
                        <td className={`px-4 py-3 font-bold ${positivo ? 'text-[#2D6A4F]' : 'text-red-500'}`}>
                          {positivo ? '+' : ''}{formatearPrecio(Number(c.resultado_neto))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-5 py-3 text-[10px] text-[#1A1A1A]/30 border-t border-[#1A1A1A]/5">
            Resultado neto = comisión generada − costo del descuento. Positivo: la campaña generó margen. Negativo: el descuento superó la comisión obtenida.
          </p>
        </div>
      )}
    </div>
  )
}

export default function ReportesAdminPage() {
  return (
    <Suspense fallback={<div className="h-40 flex items-center justify-center text-[#1A1A1A]/40 text-sm">Cargando…</div>}>
      <Contenido />
    </Suspense>
  )
}
