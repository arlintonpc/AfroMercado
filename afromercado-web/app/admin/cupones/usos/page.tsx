'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'

interface UsoItem {
  id: number; createdAt: string; nUsoDelUsuario: number; pctEfectivo: number
  cupon: { id: number; codigo: string; tipo: string; valor: number }
  usuario: { id: number; nombre: string; email: string; telefono?: string }
  pedido: { codigo: string; estado: string; subtotal: string; total: string; cuponDescuento: string | null; subPedidos: { comercio: { nombre: string } }[] }
}

const BADGE: Record<string,string> = { CONFIRMADO:'bg-[#52B788]/15 text-[#2D6A4F]', ENTREGADO:'bg-[#2D6A4F]/20 text-[#1a4530]', PENDIENTE_PAGO:'bg-[#D4A017]/15 text-[#9B7300]', VERIFICANDO_PAGO:'bg-[#D4A017]/15 text-[#9B7300]', CANCELADO:'bg-red-100 text-red-600' }
const LABEL: Record<string,string> = { CONFIRMADO:'Confirmado', ENTREGADO:'Entregado', PENDIENTE_PAGO:'Pendiente', VERIFICANDO_PAGO:'Verificando', CANCELADO:'Cancelado' }

function fmtHora(iso: string) { return new Date(iso).toLocaleString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }

export default function LogUsos() {
  const [items, setItems]       = useState<UsoItem[]>([])
  const [total, setTotal]       = useState(0)
  const [pagina, setPagina]     = useState(1)
  const [cargando, setCargando] = useState(true)
  const [q, setQ]               = useState('')
  const [estado, setEstado]     = useState('')
  const [desde, setDesde]       = useState('')
  const [hasta, setHasta]       = useState('')

  const cargar = useCallback(async (pag: number) => {
    setCargando(true)
    try {
      const p = new URLSearchParams({ pagina: String(pag), porPagina: '50' })
      if (q.trim()) p.set('q', q.trim())
      if (estado)   p.set('estado', estado)
      if (desde)    p.set('desde', desde)
      if (hasta)    p.set('hasta', hasta)
      const res = await apiFetch<{ ok:boolean; data:{ items:UsoItem[]; total:number } }>(`/cupones/usos?${p}`)
      setItems(res?.data?.items ?? [])
      setTotal(res?.data?.total ?? 0)
    } catch { /* */ } finally { setCargando(false) }
  }, [q, estado, desde, hasta])

  useEffect(() => { void cargar(1) }, [cargar])

  function buscar() { setPagina(1); cargar(1) }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/cupones" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">← Cupones</Link>
        <h1 className="text-3xl text-[#1A1A1A] mt-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Log de usos</h1>
        <p className="text-sm text-[#1A1A1A]/50 mt-0.5">Cada fila es una redención individual de cualquier cupón.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input type="text" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && buscar()}
            placeholder="Buscar: nombre, teléfono, email, código de pedido, código de cupón…"
            className="flex-1 min-w-[200px] rounded-xl border border-[#1A1A1A]/10 bg-[#F8F5F0]/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:bg-white" />
          <button onClick={buscar} className="bg-[#2D6A4F] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#245a42] transition-colors">Buscar</button>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1) }}
            className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            <option value="CONFIRMADO,ENTREGADO">Solo realizados</option>
            <option value="PENDIENTE_PAGO,VERIFICANDO_PAGO">Pendientes de pago</option>
            <option value="CANCELADO">Cancelados</option>
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#1A1A1A]/50">Desde</span>
            <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPagina(1) }}
              className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#1A1A1A]/50">Hasta</span>
            <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPagina(1) }}
              className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm" />
          </div>
          {(q||estado||desde||hasta) && (
            <button onClick={() => { setQ(''); setEstado(''); setDesde(''); setHasta(''); setPagina(1) }}
              className="text-xs text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors">Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
          <p className="text-sm font-semibold text-[#1A1A1A]/60">{cargando ? 'Cargando…' : `${total} uso${total!==1?'s':''}`}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
              <tr>{['Fecha','Cupón','Comprador','Pedido','Estado','Subtotal','Descuento','% efectivo','N.º uso'].map(h=><th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {cargando ? [1,2,3,4,5].map(i=>(
                <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>
              )) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-16 text-center"><p className="text-base font-semibold text-[#1A1A1A]/50">Sin resultados</p><p className="text-sm text-[#1A1A1A]/30 mt-1">Prueba ajustando los filtros.</p></td></tr>
              ) : items.map(uso => {
                const desc = Number(uso.pedido.cuponDescuento ?? 0)
                const sub  = Number(uso.pedido.subtotal)
                const comercios = uso.pedido.subPedidos.map(s=>s.comercio.nombre)
                const esAnomalo = uso.pctEfectivo > 50 || uso.nUsoDelUsuario > 1 || uso.pedido.estado==='CANCELADO'
                return (
                  <tr key={uso.id} className={`transition-colors ${esAnomalo ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-[#F8F5F0]/60'}`}>
                    <td className="px-4 py-2.5 text-xs text-[#1A1A1A]/50 whitespace-nowrap">{fmtHora(uso.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/cupones/${uso.cupon.id}`} className="font-mono text-xs font-bold text-[#2D6A4F] hover:underline">{uso.cupon.codigo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-[#1A1A1A] truncate max-w-[140px]">{uso.usuario.nombre}</p>
                      <p className="text-xs text-[#1A1A1A]/40 truncate max-w-[140px]">{uso.usuario.telefono ?? uso.usuario.email}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-mono text-xs font-semibold">{uso.pedido.codigo}</p>
                      {comercios.length>0 && <p className="text-[10px] text-[#1A1A1A]/40 truncate max-w-[110px]">{comercios.slice(0,2).join(', ')}{comercios.length>2?` +${comercios.length-2}`:''}</p>}
                    </td>
                    <td className="px-4 py-2.5"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${BADGE[uso.pedido.estado]??'bg-gray-100 text-gray-600'}`}>{LABEL[uso.pedido.estado]??uso.pedido.estado}</span></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatearPrecio(sub)}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#2D6A4F] whitespace-nowrap">−{formatearPrecio(desc)}</td>
                    <td className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap ${uso.pctEfectivo>50?'text-red-500':uso.pctEfectivo>25?'text-amber-600':'text-[#1A1A1A]/60'}`}>{uso.pctEfectivo.toFixed(1)}%{uso.pctEfectivo>50?' ⚠':''}</td>
                    <td className={`px-4 py-2.5 text-center text-xs font-bold ${uso.nUsoDelUsuario>1?'text-amber-600':'text-[#1A1A1A]/30'}`}>{uso.nUsoDelUsuario}{uso.nUsoDelUsuario>1?' ⚠':''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {total > 50 && (
          <div className="px-5 py-3 border-t border-[#1A1A1A]/5 flex items-center justify-between">
            <p className="text-xs text-[#1A1A1A]/40">Mostrando {(pagina-1)*50+1}–{Math.min(pagina*50,total)} de {total}</p>
            <div className="flex gap-2">
              <button onClick={() => { const p=pagina-1; setPagina(p); cargar(p) }} disabled={pagina===1} className="text-xs px-3 py-1.5 border border-[#1A1A1A]/10 rounded-lg disabled:opacity-40 hover:bg-[#F8F5F0] transition-colors">← Anterior</button>
              <button onClick={() => { const p=pagina+1; setPagina(p); cargar(p) }} disabled={pagina>=Math.ceil(total/50)} className="text-xs px-3 py-1.5 border border-[#1A1A1A]/10 rounded-lg disabled:opacity-40 hover:bg-[#F8F5F0] transition-colors">Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
