'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'

interface Alerta {
  tipo: string; severidad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFO'
  cuponId: number; cuponCodigo: string; descripcion: string
  evidencia: Record<string, unknown>
}

interface Integridad { pedidosHuerfanos: number; cuponesConDrift: number; ok: boolean }

const SEV_COLOR: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700 border-red-200',
  ALTA:    'bg-orange-100 text-orange-700 border-orange-200',
  MEDIA:   'bg-amber-100 text-amber-700 border-amber-200',
  INFO:    'bg-blue-50 text-blue-600 border-blue-200',
}
const SEV_ICONO: Record<string, string> = {
  CRITICA: '🔴', ALTA: '🟠', MEDIA: '🟡', INFO: 'ℹ️',
}
const TIPO_LABEL: Record<string, string> = {
  MULTI_CUENTA:       'Multi-cuenta',
  EXCESO_TOPE_USUARIO:'Exceso de tope por usuario',
  PEDIDO_HUERFANO:    'Pedido sin registro de uso',
  DRIFT_CONTADOR:     'Contador vs. log desincronizado',
  AUTO_COMPRA:        'Comerciante auto-comprando',
  CUPO_POR_AGOTARSE:  'Cupo casi agotado',
  EXPIRA_PRONTO:      'Cupón por expirar',
}
const TIPO_DESC: Record<string, string> = {
  MULTI_CUENTA:       'El mismo número de teléfono aparece en múltiples cuentas usando el mismo cupón.',
  EXCESO_TOPE_USUARIO:'Un usuario usó el cupón más veces de las permitidas — posible bug de concurrencia.',
  PEDIDO_HUERFANO:    'Pedido con cupón aplicado pero sin registro en CuponUso — el registro asíncrono falló.',
  DRIFT_CONTADOR:     'El campo usosActuales del cupón no coincide con el conteo real en CuponUso.',
  AUTO_COMPRA:        'Un comerciante está comprando en su propia tienda usando un cupón de descuento.',
  CUPO_POR_AGOTARSE:  'El cupón ha consumido más del 90% de su cupo total.',
  EXPIRA_PRONTO:      'El cupón expira en menos de 48 horas.',
}

export default function CentroAlertas() {
  const [alertas, setAlertas]         = useState<Alerta[]>([])
  const [integridad, setIntegridad]   = useState<Integridad | null>(null)
  const [cargando, setCargando]       = useState(true)
  const [filtroSev, setFiltroSev]     = useState<string>('')
  const [filtroTipo, setFiltroTipo]   = useState<string>('')

  useEffect(() => {
    Promise.all([
      apiFetch<{ ok:boolean; data:Alerta[] }>('/cupones/alertas'),
      apiFetch<{ ok:boolean; data:Integridad }>('/cupones/auditoria/integridad'),
    ]).then(([a, i]) => {
      setAlertas(a?.data ?? [])
      setIntegridad(i?.data ?? null)
    }).catch(()=>{}).finally(()=>setCargando(false))
  }, [])

  const filtradas = alertas.filter(a => {
    if (filtroSev  && a.severidad !== filtroSev) return false
    if (filtroTipo && a.tipo !== filtroTipo)      return false
    return true
  })

  const contPorSev = { CRITICA: 0, ALTA: 0, MEDIA: 0, INFO: 0 }
  for (const a of alertas) contPorSev[a.severidad] = (contPorSev[a.severidad] ?? 0) + 1

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/cupones" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">← Cupones</Link>
        <h1 className="text-3xl text-[#1A1A1A] mt-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Centro de alertas</h1>
        <p className="text-sm text-[#1A1A1A]/50 mt-0.5">Patrones de abuso, anomalías e integridad de datos.</p>
      </div>

      {/* Estado de integridad */}
      {integridad && (
        <div className={`rounded-2xl border px-5 py-4 flex items-start gap-4 ${integridad.ok ? 'bg-[#52B788]/10 border-[#52B788]/30' : 'bg-amber-50 border-amber-300'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg ${integridad.ok ? 'bg-[#52B788]/20' : 'bg-amber-200'}`}>
            {integridad.ok ? '✓' : '⚠'}
          </div>
          <div>
            <p className={`text-sm font-semibold ${integridad.ok ? 'text-[#2D6A4F]' : 'text-amber-800'}`}>
              {integridad.ok ? 'Integridad de datos: correcta' : 'Se detectaron problemas de integridad de datos'}
            </p>
            {!integridad.ok && (
              <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
                {integridad.pedidosHuerfanos > 0 && <li>→ {integridad.pedidosHuerfanos} pedido{integridad.pedidosHuerfanos>1?'s':''} con cupón sin registro en CuponUso</li>}
                {integridad.cuponesConDrift > 0  && <li>→ {integridad.cuponesConDrift} cupón{integridad.cuponesConDrift>1?'es':''} con contador y log desincronizados</li>}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Resumen de severidades */}
      <div className="grid grid-cols-4 gap-3">
        {(['CRITICA','ALTA','MEDIA','INFO'] as const).map(s => (
          <button key={s} onClick={() => setFiltroSev(filtroSev===s ? '' : s)}
            className={`rounded-xl border px-4 py-3 text-center transition-all ${filtroSev===s ? SEV_COLOR[s]+' ring-2 ring-current/30' : 'bg-white border-[#1A1A1A]/8 hover:bg-[#F8F5F0]'}`}>
            <p className="text-2xl font-bold">{contPorSev[s]}</p>
            <p className="text-xs font-semibold mt-0.5">{SEV_ICONO[s]} {s}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filtroSev||filtroTipo) && (
          <button onClick={() => { setFiltroSev(''); setFiltroTipo('') }} className="text-xs text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors">Limpiar filtros</button>
        )}
        <p className="ml-auto text-xs text-[#1A1A1A]/40">{filtradas.length} alerta{filtradas.length!==1?'s':''}</p>
      </div>

      {/* Lista de alertas */}
      {cargando ? (
        <div className="flex flex-col gap-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-[#1A1A1A]/6 rounded-2xl animate-pulse"/>)}</div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 px-5 py-16 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-base font-semibold text-[#1A1A1A]/60">
            {alertas.length === 0 ? 'No hay alertas detectadas' : 'Sin alertas con este filtro'}
          </p>
          <p className="text-sm text-[#1A1A1A]/40 mt-1">
            {alertas.length === 0 ? 'Todo parece estar en orden con los cupones.' : 'Prueba cambiando los filtros.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtradas.map((a, i) => (
            <div key={i} className={`rounded-2xl border px-5 py-4 ${SEV_COLOR[a.severidad]}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{SEV_ICONO[a.severidad]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold uppercase tracking-wide">{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
                    <Link href={`/admin/cupones/${a.cuponId}`}
                      className="font-mono text-xs font-bold underline underline-offset-2 opacity-80 hover:opacity-100">
                      {a.cuponCodigo}
                    </Link>
                  </div>
                  <p className="text-sm">{a.descripcion}</p>
                  <p className="text-xs opacity-60 mt-0.5">{TIPO_DESC[a.tipo]}</p>

                  {/* Evidencia colapsada */}
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer opacity-60 hover:opacity-100 select-none">Ver evidencia</summary>
                    <pre className="mt-1.5 text-[10px] bg-black/10 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(a.evidencia, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
