'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'

// ── Tipos ─────────────────────────────────────────────────────

interface Metricas {
  cupon: {
    id: number; codigo: string; tipo: string; valor: number; distribucion: string
    activo: boolean; inicio: string; fin: string; soloNuevos: boolean
    usosMaximos: number | null; usosActuales: number; usosMaximosPorUsuario: number | null
    estadoCalculado: string; cupoRestante: number | null; pctCupoConsumido: number | null
    minimoCompra: number | null
    comercios: { comercio: { nombre: string } }[]
  }
  adopcion: { redenciones: number; usuariosUnicos: number; redencionesPorUsuario: number; comerciosImpactados: number; primeraRedencion: string | null; ultimaRedencion: string | null }
  economia: { descuentoOtorgadoBruto: number; descuentoRealizado: number; descuentoEnRiesgo: number; descuentoPerdido: number; gmvAtribuido: number; comisionGenerada: number; descuentoPromedioPorRedencion: number; costoDescuentoSobreVentas: number }
  eficiencia: { pedidosTotales: number; pedidosConfirmados: number; tasaConfirmacion: number; tasaCancelacion: number; ritmoRedencionPorDia: number; diasTranscurridos: number; diasTotales: number }
  porEstado: Record<string, { pedidos: number; descuento: number; gmv: number }>
  integridad: { contadorVsLog: number; ok: boolean }
}

interface UsoItem {
  id: number; createdAt: string; nUsoDelUsuario: number; pctEfectivo: number
  cupon: { codigo: string; tipo: string; valor: number }
  usuario: { id: number; nombre: string; email: string; telefono?: string }
  pedido: { codigo: string; estado: string; subtotal: string; total: string; cuponDescuento: string | null; subPedidos: { comercio: { nombre: string; municipio: string } }[] }
}

interface PorComercio { id: number; nombre: string; municipio: string; pedidos: number; gmv: number; descuento_prorrateado: number; comision: number }

interface PorUsuario { id: number; nombre: string; email: string; telefono: string | null; veces: number; descuento_total: number; gmv_total: number; ultima_redencion: string; primera_redencion: string }

interface Serie { fecha: string; redenciones: number; descuento: number }

// ── Helpers ───────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function pct(n: number) { return `${(n * 100).toFixed(1)}%` }

const BADGE_ESTADO: Record<string, string> = {
  CONFIRMADO:      'bg-[#52B788]/15 text-[#2D6A4F]',
  ENTREGADO:       'bg-[#2D6A4F]/20 text-[#1a4530]',
  PENDIENTE_PAGO:  'bg-[#D4A017]/15 text-[#9B7300]',
  VERIFICANDO_PAGO:'bg-[#D4A017]/15 text-[#9B7300]',
  CANCELADO:       'bg-red-100 text-red-600',
}
const LABEL_ESTADO: Record<string, string> = {
  CONFIRMADO:'Confirmado', ENTREGADO:'Entregado',
  PENDIENTE_PAGO:'Pendiente pago', VERIFICANDO_PAGO:'Verificando',
  CANCELADO:'Cancelado',
}

function KPI({ titulo, valor, sub, color, advertencia }: { titulo: string; valor: string; sub?: string; color?: string; advertencia?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border px-4 py-3 ${advertencia ? 'border-amber-300 bg-amber-50' : 'border-[#1A1A1A]/8'}`}>
      <p className="text-[11px] font-semibold text-[#1A1A1A]/50 mb-0.5">{titulo}</p>
      <p className={`text-xl font-bold ${color ?? 'text-[#1A1A1A]'}`}>{valor}</p>
      {sub && <p className="text-[11px] text-[#1A1A1A]/40 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Tab: Resumen ──────────────────────────────────────────────

function TabResumen({ m, serie }: { m: Metricas; serie: Serie[] }) {
  const { economia: e, adopcion: a, eficiencia: ef, integridad, cupon: c, porEstado } = m

  return (
    <div className="flex flex-col gap-6">
      {/* Alerta de integridad */}
      {!integridad.ok && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3">
          <svg className="flex-shrink-0 mt-0.5 text-amber-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p className="text-sm text-amber-800">
            El contador de usos ({c.usosActuales}) y el log de registros ({c.usosActuales - integridad.contadorVsLog}) no coinciden — posible fallo de registro asíncrono. <Link href="/admin/cupones/alertas" className="underline font-semibold">Ver alertas</Link>.
          </p>
        </div>
      )}

      {/* Bloque económico principal */}
      <div>
        <p className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-wider mb-3">Impacto económico</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI titulo="Descuento realizado" valor={formatearPrecio(e.descuentoRealizado)} sub="pedidos confirmados/entregados" color="text-[#2D6A4F]" />
          <KPI titulo="Descuento en riesgo" valor={formatearPrecio(e.descuentoEnRiesgo)} sub="pendientes de pago" color="text-amber-600" advertencia={e.descuentoEnRiesgo > 0} />
          <KPI titulo="Descuento perdido" valor={formatearPrecio(e.descuentoPerdido)} sub="pedidos cancelados" color={e.descuentoPerdido > 0 ? 'text-red-500' : 'text-[#1A1A1A]'} />
          <KPI titulo="GMV atribuido" valor={formatearPrecio(e.gmvAtribuido)} sub="ventas generadas" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <KPI titulo="Comisión generada" valor={formatearPrecio(e.comisionGenerada)} sub="para AfroMercado" color="text-[#2D6A4F]" />
          <KPI titulo="Descuento promedio" valor={formatearPrecio(e.descuentoPromedioPorRedencion)} sub="por redención confirmada" />
          <KPI titulo="Costo / venta" valor={pct(e.costoDescuentoSobreVentas)} sub="descuento sobre GMV" />
          <KPI titulo="Descuento bruto total" valor={formatearPrecio(e.descuentoOtorgadoBruto)} sub="todos los estados" />
        </div>
      </div>

      {/* Adopción y eficiencia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-wider mb-3">Adopción</p>
          <div className="grid grid-cols-2 gap-3">
            <KPI titulo="Redenciones (log)" valor={String(a.redenciones)} sub="registros CuponUso" />
            <KPI titulo="Usuarios únicos" valor={String(a.usuariosUnicos)} />
            <KPI titulo="Usos por usuario" valor={String(a.redencionesPorUsuario)} sub={a.redencionesPorUsuario > 1 ? 'revisar repetidores' : 'promedio'} advertencia={a.redencionesPorUsuario > 1.5} />
            <KPI titulo="Comercios afectados" valor={String(a.comerciosImpactados)} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-wider mb-3">Eficiencia</p>
          <div className="grid grid-cols-2 gap-3">
            <KPI titulo="Tasa de confirmación" valor={pct(ef.tasaConfirmacion)} color={ef.tasaConfirmacion > 0.8 ? 'text-[#2D6A4F]' : 'text-amber-600'} />
            <KPI titulo="Tasa de cancelación" valor={pct(ef.tasaCancelacion)} color={ef.tasaCancelacion > 0.1 ? 'text-red-500' : 'text-[#1A1A1A]'} advertencia={ef.tasaCancelacion > 0.15} />
            <KPI titulo="Ritmo / día" valor={`${ef.ritmoRedencionPorDia}`} sub="redenciones por día activo" />
            <KPI titulo="Progreso" valor={`${ef.diasTranscurridos}/${ef.diasTotales} días`} />
          </div>
        </div>
      </div>

      {/* Cupo */}
      {c.usosMaximos !== null && (
        <div className="bg-white rounded-xl border border-[#1A1A1A]/8 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#1A1A1A]/60">Cupo consumido</p>
            <p className="text-sm font-bold text-[#1A1A1A]">{c.usosActuales} / {c.usosMaximos}</p>
          </div>
          <div className="h-2 bg-[#1A1A1A]/8 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${(c.pctCupoConsumido ?? 0) > 0.9 ? 'bg-red-400' : (c.pctCupoConsumido ?? 0) > 0.7 ? 'bg-amber-400' : 'bg-[#52B788]'}`}
              style={{ width: `${Math.min(100, (c.pctCupoConsumido ?? 0) * 100).toFixed(1)}%` }} />
          </div>
          {c.cupoRestante !== null && <p className="text-xs text-[#1A1A1A]/40 mt-1">{c.cupoRestante} usos restantes</p>}
        </div>
      )}

      {/* Serie temporal */}
      {serie.length > 0 && (
        <div className="bg-white rounded-xl border border-[#1A1A1A]/8 px-4 py-4">
          <p className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-wider mb-4">Redenciones por día</p>
          <div className="flex items-end gap-1 h-20">
            {serie.map((s, i) => {
              const max = Math.max(...serie.map(x => x.redenciones), 1)
              const h = Math.round((s.redenciones / max) * 100)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white text-[10px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {s.redenciones} uso{s.redenciones!==1?'s':''} · {fmt(s.fecha)}
                  </div>
                  <div className="w-full rounded-t" style={{ height: `${h}%`, backgroundColor: '#52B788', minHeight: s.redenciones > 0 ? '4px' : '2px', opacity: s.redenciones > 0 ? 1 : 0.2 }} />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-[10px] text-[#1A1A1A]/30">{fmt(serie[0]?.fecha)}</p>
            <p className="text-[10px] text-[#1A1A1A]/30">{fmt(serie[serie.length-1]?.fecha)}</p>
          </div>
        </div>
      )}

      {/* Por estado */}
      <div className="bg-white rounded-xl border border-[#1A1A1A]/8 overflow-hidden">
        <p className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-wider px-4 py-3 border-b border-[#1A1A1A]/5">Desglose por estado del pedido</p>
        <table className="w-full text-sm">
          <thead className="bg-[#F8F5F0]/60">
            <tr>{['Estado','Pedidos','Descuento','GMV'].map(h=><th key={h} className="px-4 py-2 text-left text-xs font-semibold text-[#1A1A1A]/50">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A]/5">
            {Object.entries(porEstado).filter(([,v])=>v.pedidos>0).map(([estado,v])=>(
              <tr key={estado} className="hover:bg-[#F8F5F0]/50">
                <td className="px-4 py-2.5"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE_ESTADO[estado]??'bg-gray-100 text-gray-600'}`}>{LABEL_ESTADO[estado]??estado}</span></td>
                <td className="px-4 py-2.5 text-[#1A1A1A]/70">{v.pedidos}</td>
                <td className="px-4 py-2.5 font-semibold text-[#2D6A4F]">{formatearPrecio(Math.round(v.descuento))}</td>
                <td className="px-4 py-2.5 text-[#1A1A1A]/70">{formatearPrecio(Math.round(v.gmv))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Primera / última redención */}
      {(a.primeraRedencion || a.ultimaRedencion) && (
        <div className="flex gap-4 text-xs text-[#1A1A1A]/50">
          {a.primeraRedencion && <span>Primera redención: <strong className="text-[#1A1A1A]">{fmtHora(a.primeraRedencion)}</strong></span>}
          {a.ultimaRedencion  && <span>Última redención: <strong className="text-[#1A1A1A]">{fmtHora(a.ultimaRedencion)}</strong></span>}
        </div>
      )}
    </div>
  )
}

// ── Tab: Usos ─────────────────────────────────────────────────

function TabUsos({ cuponId }: { cuponId: number }) {
  const [items, setItems]       = useState<UsoItem[]>([])
  const [total, setTotal]       = useState(0)
  const [pagina, setPagina]     = useState(1)
  const [cargando, setCargando] = useState(true)
  const [estado, setEstado]     = useState('')
  const [q, setQ]               = useState('')

  const cargar = useCallback(async (pag: number) => {
    setCargando(true)
    try {
      const params = new URLSearchParams({ pagina: String(pag), porPagina: '50' })
      if (estado) params.set('estado', estado)
      if (q.trim()) params.set('q', q.trim())
      const res = await apiFetch<{ ok:boolean; data:{ items:UsoItem[]; total:number } }>(`/cupones/${cuponId}/usos?${params}`)
      setItems(res?.data?.items ?? [])
      setTotal(res?.data?.total ?? 0)
    } catch { /* */ } finally { setCargando(false) }
  }, [cuponId, estado, q])

  useEffect(() => { void cargar(1) }, [cargar])

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input type="text" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && (setPagina(1), cargar(1))}
          placeholder="Buscar por nombre, email, teléfono o código de pedido…"
          className="flex-1 min-w-0 rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1) }}
          className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          <option value="CONFIRMADO,ENTREGADO">Solo realizados</option>
          <option value="PENDIENTE_PAGO,VERIFICANDO_PAGO">Pendientes</option>
          <option value="CANCELADO">Cancelados</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#1A1A1A]/8 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
          <p className="text-xs font-semibold text-[#1A1A1A]/50">{cargando ? 'Cargando…' : `${total} uso${total!==1?'s':''}`}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
              <tr>{['Fecha','Comprador','Pedido','Estado','Subtotal','Descuento','% efectivo','N.º uso'].map(h=><th key={h} className="px-4 py-2 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {cargando ? (
                [1,2,3].map(i=><tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>)
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#1A1A1A]/40">Sin usos con estos filtros.</td></tr>
              ) : items.map(uso => {
                const desc = Number(uso.pedido.cuponDescuento ?? 0)
                const sub  = Number(uso.pedido.subtotal)
                const comercios = uso.pedido.subPedidos.map(s=>s.comercio.nombre)
                return (
                  <tr key={uso.id} className="hover:bg-[#F8F5F0]/60 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-[#1A1A1A]/50">{fmtHora(uso.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-[#1A1A1A] truncate max-w-[140px]">{uso.usuario.nombre}</p>
                      <p className="text-xs text-[#1A1A1A]/40 truncate max-w-[140px]">{uso.usuario.telefono ?? uso.usuario.email}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-mono text-xs font-semibold">{uso.pedido.codigo}</p>
                      {comercios.length > 0 && <p className="text-[10px] text-[#1A1A1A]/40 truncate max-w-[120px]">{comercios.slice(0,2).join(', ')}{comercios.length>2?` +${comercios.length-2}`:''}</p>}
                    </td>
                    <td className="px-4 py-2.5"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${BADGE_ESTADO[uso.pedido.estado]??'bg-gray-100 text-gray-600'}`}>{LABEL_ESTADO[uso.pedido.estado]??uso.pedido.estado}</span></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatearPrecio(sub)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-[#2D6A4F]">−{formatearPrecio(desc)}</td>
                    <td className={`px-4 py-2.5 whitespace-nowrap text-xs font-semibold ${uso.pctEfectivo > 50 ? 'text-red-500' : 'text-[#1A1A1A]/60'}`}>{uso.pctEfectivo.toFixed(1)}%</td>
                    <td className={`px-4 py-2.5 text-center text-xs font-bold ${uso.nUsoDelUsuario > 1 ? 'text-amber-600' : 'text-[#1A1A1A]/40'}`}>{uso.nUsoDelUsuario}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {total > 50 && (
          <div className="px-4 py-3 border-t border-[#1A1A1A]/5 flex items-center justify-between">
            <p className="text-xs text-[#1A1A1A]/40">Página {pagina} de {Math.ceil(total/50)}</p>
            <div className="flex gap-2">
              <button onClick={() => { const p=pagina-1; setPagina(p); cargar(p) }} disabled={pagina===1} className="text-xs px-3 py-1.5 border border-[#1A1A1A]/10 rounded-lg disabled:opacity-40">← Anterior</button>
              <button onClick={() => { const p=pagina+1; setPagina(p); cargar(p) }} disabled={pagina>=Math.ceil(total/50)} className="text-xs px-3 py-1.5 border border-[#1A1A1A]/10 rounded-lg disabled:opacity-40">Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Por comercio ─────────────────────────────────────────

function TabPorComercio({ cuponId }: { cuponId: number }) {
  const [rows, setRows]         = useState<PorComercio[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    apiFetch<{ ok:boolean; data:PorComercio[] }>(`/cupones/${cuponId}/por-comercio`)
      .then(r => setRows(r?.data ?? []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [cuponId])

  const totalDesc = rows.reduce((s,r)=>s+r.descuento_prorrateado,0)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[#1A1A1A]/50 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        ⚠ El descuento se guarda a nivel de orden (no por comercio). El monto aquí es <strong>estimado por prorrateo</strong> proporcional al subtotal de cada comercio.
      </p>
      <div className="bg-white rounded-xl border border-[#1A1A1A]/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-[#F8F5F0]/60 border-b border-[#1A1A1A]/5">
              <tr>{['Comercio','Municipio','Pedidos','GMV','Descuento (est.)','Comisión','%'].map(h=><th key={h} className="px-4 py-2 text-left text-xs font-semibold text-[#1A1A1A]/50">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {cargando ? [1,2,3].map(i=><tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>)
              : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#1A1A1A]/40">Sin datos aún (solo aparecen pedidos confirmados/entregados).</td></tr>
              : rows.map(r=>(
                <tr key={r.id} className="hover:bg-[#F8F5F0]/50">
                  <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{r.nombre}</td>
                  <td className="px-4 py-3 text-xs text-[#1A1A1A]/50">{r.municipio}</td>
                  <td className="px-4 py-3 text-center">{r.pedidos}</td>
                  <td className="px-4 py-3">{formatearPrecio(r.gmv)}</td>
                  <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(r.descuento_prorrateado)} <span className="text-[10px] font-normal text-amber-600">est.</span></td>
                  <td className="px-4 py-3 text-[#1A1A1A]/60">{formatearPrecio(r.comision)}</td>
                  <td className="px-4 py-3 text-xs text-[#1A1A1A]/50">{totalDesc > 0 ? pct(r.descuento_prorrateado/totalDesc) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Por usuario ──────────────────────────────────────────

function TabPorUsuario({ cuponId }: { cuponId: number }) {
  const [data, setData]         = useState<{ ranking: PorUsuario[]; histograma: Record<string,number> } | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    apiFetch<{ ok:boolean; data:{ ranking:PorUsuario[]; histograma:Record<string,number> } }>(`/cupones/${cuponId}/por-usuario`)
      .then(r => setData(r?.data ?? null))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [cuponId])

  if (cargando) return <div className="h-32 flex items-center justify-center text-sm text-[#1A1A1A]/40">Cargando…</div>
  if (!data || data.ranking.length === 0) return <div className="h-32 flex items-center justify-center text-sm text-[#1A1A1A]/40">Sin datos de usuarios aún.</div>

  return (
    <div className="flex flex-col gap-4">
      {/* Histograma */}
      <div className="grid grid-cols-3 gap-3">
        {[['1','Una vez'],['2','Dos veces'],['3+','Tres o más']] .map(([k,lbl])=>(
          <div key={k} className={`bg-white rounded-xl border px-4 py-3 text-center ${k==='3+' && (data.histograma['3+']??0)>0 ? 'border-amber-300 bg-amber-50' : 'border-[#1A1A1A]/8'}`}>
            <p className="text-2xl font-bold text-[#1A1A1A]">{data.histograma[k]??0}</p>
            <p className="text-xs text-[#1A1A1A]/50">{lbl}</p>
            {k==='3+' && (data.histograma['3+']??0)>0 && <p className="text-[10px] text-amber-600 mt-0.5 font-semibold">Revisar repetidores</p>}
          </div>
        ))}
      </div>

      {/* Ranking */}
      <div className="bg-white rounded-xl border border-[#1A1A1A]/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-[#F8F5F0]/60 border-b border-[#1A1A1A]/5">
              <tr>{['#','Usuario','Teléfono','Veces','Desc. recibido','GMV generado','Primera','Última'].map(h=><th key={h} className="px-4 py-2 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {data.ranking.map((u,i)=>(
                <tr key={u.id} className={`hover:bg-[#F8F5F0]/50 ${u.veces > 2 ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-2.5 text-xs font-bold text-[#1A1A1A]/30">{i+1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-[#1A1A1A]">{u.nombre}</p>
                    <p className="text-xs text-[#1A1A1A]/40">{u.email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-[#1A1A1A]/60">{u.telefono ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-sm font-bold ${u.veces > 2 ? 'text-amber-600' : 'text-[#1A1A1A]'}`}>{u.veces}</span>
                    {u.veces > 2 && <span className="ml-1 text-[10px] text-amber-500">⚠</span>}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-[#2D6A4F]">{formatearPrecio(u.descuento_total)}</td>
                  <td className="px-4 py-2.5 text-[#1A1A1A]/60">{formatearPrecio(u.gmv_total)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#1A1A1A]/40 whitespace-nowrap">{fmt(u.primera_redencion)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#1A1A1A]/40 whitespace-nowrap">{fmt(u.ultima_redencion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Configuración ────────────────────────────────────────

function TabConfig({ m, onDesactivar }: { m: Metricas; onDesactivar: () => void }) {
  const c = m.cupon
  const ahora = new Date()
  const puedeDesactivar = c.activo && new Date(c.fin) > ahora
  const [desactivando, setDesactivando] = useState(false)

  async function desactivar() {
    setDesactivando(true)
    try { await apiFetch(`/cupones/${c.id}`, { method: 'DELETE' }); onDesactivar() }
    catch { /* */ } finally { setDesactivando(false) }
  }

  const fila = (label: string, valor: string) => (
    <div className="flex items-start justify-between py-2.5 border-b border-[#1A1A1A]/5 last:border-0">
      <span className="text-sm text-[#1A1A1A]/50">{label}</span>
      <span className="text-sm font-semibold text-[#1A1A1A] text-right max-w-[60%]">{valor}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div className="bg-white rounded-xl border border-[#1A1A1A]/8 px-4">
        {fila('Código', c.codigo)}
        {fila('Tipo', c.tipo === 'PORCENTAJE' ? `${c.valor}% de descuento` : `${formatearPrecio(c.valor)} fijo`)}
        {fila('Compra mínima', c.minimoCompra ? formatearPrecio(c.minimoCompra) : 'Sin mínimo')}
        {fila('Usos máximos (global)', c.usosMaximos ? String(c.usosMaximos) : 'Sin límite')}
        {fila('Usos máximos por usuario', c.usosMaximosPorUsuario ? String(c.usosMaximosPorUsuario) : 'Sin límite')}
        {fila('Solo compradores nuevos', c.soloNuevos ? 'Sí' : 'No')}
        {fila('Distribución', c.distribucion === 'PUBLICO' ? 'Pública' : 'Asignada (solo usuarios autorizados)')}
        {fila('Válido desde', fmt(c.inicio))}
        {fila('Válido hasta', fmt(c.fin))}
        {fila('Comercios restringidos', c.comercios.length > 0 ? c.comercios.map(cc=>cc.comercio.nombre).join(', ') : 'Todos los comercios')}
        {fila('Estado', c.estadoCalculado)}
      </div>

      {puedeDesactivar && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4">
          <p className="text-sm font-semibold text-red-700 mb-1">Desactivar cupón</p>
          <p className="text-xs text-red-600/80 mb-3">Al desactivarlo los clientes ya no podrán usarlo aunque aún esté dentro del periodo de vigencia. Esta acción no se puede revertir.</p>
          <button type="button" onClick={desactivar} disabled={desactivando}
            className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {desactivando ? 'Desactivando…' : 'Desactivar cupón'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

const TABS = [
  { id: 'resumen',    label: 'Resumen' },
  { id: 'usos',       label: 'Usos' },
  { id: 'comercios',  label: 'Por comercio' },
  { id: 'usuarios',   label: 'Por usuario' },
  { id: 'config',     label: 'Configuración' },
] as const

type TabId = typeof TABS[number]['id']

export default function DetalleCupon() {
  const { id } = useParams() as { id: string }
  const cuponId = parseInt(id)

  const [tab, setTab]             = useState<TabId>('resumen')
  const [metricas, setMetricas]   = useState<Metricas | null>(null)
  const [serie, setSerie]         = useState<Serie[]>([])
  const [cargando, setCargando]   = useState(true)
  const [desactivado, setDesactivado] = useState(false)

  useEffect(() => {
    if (isNaN(cuponId)) return
    Promise.all([
      apiFetch<{ ok:boolean; data:Metricas }>(`/cupones/${cuponId}/metricas`),
      apiFetch<{ ok:boolean; data:Serie[] }>(`/cupones/${cuponId}/serie?intervalo=dia`),
    ]).then(([m, s]) => {
      setMetricas(m?.data ?? null)
      setSerie(s?.data ?? [])
    }).catch(()=>{}).finally(()=>setCargando(false))
  }, [cuponId])

  if (cargando) return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 bg-[#1A1A1A]/8 rounded animate-pulse"/>
      <div className="h-40 bg-[#1A1A1A]/5 rounded-2xl animate-pulse"/>
    </div>
  )
  if (!metricas) return <div className="text-center py-20 text-[#1A1A1A]/40">Cupón no encontrado.</div>

  const c = metricas.cupon
  const estadoColor = c.estadoCalculado==='VIGENTE' ? 'bg-[#52B788]/15 text-[#2D6A4F]'
    : c.estadoCalculado==='PROGRAMADO' ? 'bg-[#D4A017]/15 text-[#9B7300]'
    : 'bg-[#1A1A1A]/10 text-[#1A1A1A]/50'

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera */}
      <div>
        <Link href="/admin/cupones" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">← Cupones</Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <code className="text-2xl font-bold text-[#1A1A1A] bg-[#F8F5F0] border border-[#1A1A1A]/8 px-3 py-1 rounded-xl tracking-wide">{c.codigo}</code>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${estadoColor}`}>{c.estadoCalculado}</span>
          {desactivado && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#1A1A1A]/10 text-[#1A1A1A]/50">Desactivado</span>}
        </div>
        <p className="text-sm text-[#1A1A1A]/50 mt-1">
          {c.tipo==='PORCENTAJE' ? `${c.valor}% de descuento` : `${formatearPrecio(c.valor)} de descuento`} · {fmt(c.inicio)} → {fmt(c.fin)}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F8F5F0] rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab===t.id ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'resumen'   && <TabResumen m={metricas} serie={serie} />}
      {tab === 'usos'      && <TabUsos cuponId={cuponId} />}
      {tab === 'comercios' && <TabPorComercio cuponId={cuponId} />}
      {tab === 'usuarios'  && <TabPorUsuario cuponId={cuponId} />}
      {tab === 'config'    && <TabConfig m={metricas} onDesactivar={() => setDesactivado(true)} />}
    </div>
  )
}
