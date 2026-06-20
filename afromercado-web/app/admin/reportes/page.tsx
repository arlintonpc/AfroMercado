'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import BotonExportar from '@/components/reportes/BotonExportar'

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
  { id: 'comercios',  label: 'Comercios' },
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
  const [cargando, setCargando] = useState(true)
  const [serieCampo, setSerieCampo] = useState<'comision' | 'gmv' | 'pedidos'>('comision')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const qs = `?desde=${desde}&hasta=${hasta}`
      const [d, s, m, c, r, cr, co] = await Promise.all([
        apiFetch<{ ok: boolean; data: Dashboard }>(`/reportes/admin/dashboard${qs}`),
        apiFetch<{ ok: boolean; data: SeriePunto[] }>(`/reportes/admin/serie${qs}`),
        apiFetch<{ ok: boolean; data: MunicipioRow[] }>(`/reportes/admin/municipios${qs}`),
        apiFetch<{ ok: boolean; data: ComercioRow[] }>(`/reportes/admin/comercios${qs}&limite=20`),
        apiFetch<{ ok: boolean; data: RiesgoRow[] }>('/reportes/admin/riesgo'),
        apiFetch<{ ok: boolean; data: CuponROI[] }>(`/reportes/admin/cupones-roi${qs}`),
        apiFetch<{ ok: boolean; data: CohorteFila[] }>('/reportes/admin/cohortes'),
      ])
      setDashboard(d?.data ?? null)
      setSerie(s?.data ?? [])
      setMunicipios(m?.data ?? [])
      setComercios(c?.data ?? [])
      setRiesgo(r?.data ?? [])
      setCuponesROI(cr?.data ?? [])
      setCohortes(co?.data ?? [])
    } catch { /**/ } finally { setCargando(false) }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

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
      <div className="flex gap-1 bg-[#F8F5F0] rounded-2xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id ? 'bg-white text-[#2D6A4F] shadow-sm' : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
            }`}
          >
            {t.label}
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
