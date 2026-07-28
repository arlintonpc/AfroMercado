'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { API_URL, apiFetch, obtenerToken } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'

type Resumen = {
  ventas: number; ingresosBrutos: number; costoVentas: number; utilidadBruta: number
  gastosOperativos: number; utilidadOperativa: number; margenBrutoPorcentaje: number
  advertenciaCupones: string
}
type Gasto = { id: number; categoria: string; concepto: string; monto: number | string; fecha: string }
type Alertas = { stockBajo: Array<{ id: number; nombre: string }>; cuentasVencidas: Array<{ id: number; concepto: string }>; cajaNegativa: boolean; saldoCaja: number }
const categorias = ['FLETE', 'EMPAQUE', 'TRANSPORTE', 'SERVICIO', 'NOMINA', 'ARRIENDO', 'OTRO']

export default function ContabilidadOperativaPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState('FLETE')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [alertas, setAlertas] = useState<Alertas | null>(null)

  async function descargarReporte() {
    try {
      const respuesta = await fetch(`${API_URL}/inventario/finanzas/exportar`, { headers: { Authorization: `Bearer ${obtenerToken() ?? ''}` }, credentials: 'include' })
      if (!respuesta.ok) throw new Error('No se pudo generar el reporte.')
      const url = URL.createObjectURL(await respuesta.blob())
      const enlace = document.createElement('a')
      enlace.href = url; enlace.download = 'Teravia_Contabilidad.csv'; enlace.click()
      URL.revokeObjectURL(url)
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudo descargar el reporte.') }
  }

  async function cargar() {
    try {
      const [finanzas, gastosApi, alertasApi] = await Promise.all([
        apiFetch<{ data: Resumen }>('/inventario/finanzas/resumen'),
        apiFetch<{ gastos: Gasto[] }>('/inventario/gastos'),
        apiFetch<{ data: Alertas }>('/inventario/alertas'),
      ])
      setResumen(finanzas.data); setGastos(gastosApi.gastos ?? []); setAlertas(alertasApi.data)
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudo cargar la contabilidad.') }
  }
  useEffect(() => { void cargar() }, [])

  async function registrar(evento: FormEvent) {
    evento.preventDefault(); setError(null)
    if (!concepto.trim() || Number(monto) <= 0) return setError('Escribe concepto y un monto mayor que cero.')
    setGuardando(true)
    try {
      await apiFetch('/inventario/gastos', { method: 'POST', body: { categoria, concepto, monto: Number(monto) } })
      setConcepto(''); setMonto(''); await cargar()
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudo registrar el gasto.') }
    finally { setGuardando(false) }
  }

  const tarjetas = resumen ? [
    ['Ingresos por ventas', resumen.ingresosBrutos], ['Costo de ventas', resumen.costoVentas],
    ['Utilidad bruta', resumen.utilidadBruta], ['Gastos operativos', resumen.gastosOperativos],
    ['Utilidad operativa', resumen.utilidadOperativa],
  ] : []
  return <div className="mx-auto max-w-5xl space-y-6 pb-10">
    <div><Link href="/comerciante/dashboard" className="text-xs text-[#1A1A1A]/45 hover:text-[#2D6A4F]">← Panel de vendedor</Link><h1 className="mt-1 text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Contabilidad operativa</h1><p className="mt-1 text-sm text-[#1A1A1A]/55">Ventas confirmadas, costo vendido y gastos de tu comercio.</p><Link href="/comerciante/contabilidad/cuentas" className="mt-3 inline-block text-sm font-semibold text-[#2D6A4F] hover:underline">Gestionar cuentas y caja →</Link></div>
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <p className="rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-4 py-3 text-sm text-[#1B4332]">Reporte operativo provisional: base de caja, impuestos informativos y cupones excluidos. No modifica pagos ni liquidaciones.</p>
    {alertas && (alertas.cajaNegativa || alertas.stockBajo.length || alertas.cuentasVencidas.length) && <div className="rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/10 p-4 text-sm text-[#725400]"><p className="font-bold">Alertas operativas</p><p className="mt-1">{alertas.stockBajo.length} productos con stock bajo · {alertas.cuentasVencidas.length} cuentas vencidas{alertas.cajaNegativa ? ` · Caja negativa: ${formatearPrecio(alertas.saldoCaja)}` : ''}</p></div>}
    <div className="flex justify-end"><button onClick={() => void descargarReporte()} className="text-sm font-semibold text-[#2D6A4F] hover:underline">Descargar reporte CSV</button></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{tarjetas.map(([titulo, valor]) => <div key={titulo as string} className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-4"><p className="text-xs font-semibold uppercase text-[#1A1A1A]/45">{titulo}</p><p className="mt-2 text-xl font-bold text-[#1B4332]">{formatearPrecio(Number(valor))}</p></div>)}</div>
    {resumen && <p className="rounded-xl bg-[#D4A017]/10 px-4 py-3 text-sm text-[#725400]">Margen bruto: {resumen.margenBrutoPorcentaje}% · {resumen.advertenciaCupones}</p>}
    <form onSubmit={registrar} className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5"><h2 className="font-semibold">Registrar gasto operativo</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-xl border p-2.5">{categorias.map((item) => <option key={item}>{item}</option>)}</select><input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Concepto" className="rounded-xl border px-3 py-2.5"/><input type="number" min="1" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto COP" className="rounded-xl border px-3 py-2.5"/></div><div className="mt-4 flex justify-end"><Button type="submit" loading={guardando}>Guardar gasto</Button></div></form>
    <section className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white"><div className="border-b p-4"><h2 className="font-semibold">Gastos recientes</h2></div>{gastos.length ? gastos.slice(0, 12).map((gasto) => <div key={gasto.id} className="flex justify-between border-b px-4 py-3 text-sm"><div><p className="font-medium">{gasto.concepto}</p><p className="text-xs text-[#1A1A1A]/45">{gasto.categoria} · {new Date(gasto.fecha).toLocaleDateString('es-CO')}</p></div><strong>{formatearPrecio(Number(gasto.monto))}</strong></div>) : <p className="p-8 text-center text-sm text-[#1A1A1A]/45">Aún no hay gastos registrados.</p>}</section>
  </div>
}
