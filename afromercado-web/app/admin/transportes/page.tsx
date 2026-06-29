'use client'

import { useEffect, useState } from 'react'
import { adminListarTransportes, adminCambiarEstadoTransporte, type TransporteAdmin } from '@/lib/api/transporte'

const TIPO_ICONO: Record<string, string> = { LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶' }

export default function AdminTransportesPage() {
  const [transportes, setTransportes] = useState<TransporteAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos')

  useEffect(() => {
    adminListarTransportes().then(d => { setTransportes(d); setCargando(false) })
  }, [])

  async function toggleEstado(t: TransporteAdmin) {
    const actualizado = await adminCambiarEstadoTransporte(t.id, !t.activo)
    setTransportes(prev => prev.map(x => x.id === t.id ? { ...x, activo: actualizado.activo } : x))
  }

  const filtrados = transportes.filter(t => {
    if (filtroActivo === 'activos' && !t.activo) return false
    if (filtroActivo === 'inactivos' && t.activo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return t.nombre.toLowerCase().includes(q) || t.comercio.nombre.toLowerCase().includes(q) || t.comercio.municipio.toLowerCase().includes(q)
    }
    return true
  })

  const stats = { total: transportes.length, activos: transportes.filter(t => t.activo).length }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">🛥️ Transporte Fluvial</h1>
        <p className="text-sm text-gray-500 mt-1">Servicios de transporte fluvial registrados</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {[{ label: 'Total', val: stats.total, color: 'text-[#023E8A]' }, { label: 'Activos', val: stats.activos, color: 'text-green-600' }].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar…"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
        <div className="flex gap-1">
          {(['todos', 'activos', 'inactivos'] as const).map(f => (
            <button key={f} onClick={() => setFiltroActivo(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize border ${filtroActivo === f ? 'bg-[#023E8A] text-white border-[#023E8A]' : 'bg-white text-gray-600 border-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#023E8A] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Servicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Operador / Ciudad</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Rutas</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{TIPO_ICONO[t.tipo] ?? '🛥️'} {t.nombre}</p>
                      <p className="text-xs text-gray-400">{t.tipo}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{t.comercio.nombre}</p>
                      <p className="text-xs text-gray-400">{t.comercio.municipio}{t.comercio.departamento ? `, ${t.comercio.departamento}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{t._count?.rutas ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${t.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {t.activo ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleEstado(t)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${t.activo ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {t.activo ? 'Suspender' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
