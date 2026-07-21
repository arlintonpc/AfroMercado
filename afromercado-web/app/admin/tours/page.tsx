'use client'

import { useEffect, useState } from 'react'
import {
  adminListarTours, adminCambiarEstadoTour, adminVerificarRntTour, adminReservasTour,
  type TourAdmin, type ReservaAdminTour,
} from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'

const ESTADO_STYLE: Record<string, string> = {
  PENDIENTE:  'bg-yellow-100 text-yellow-700',
  CONFIRMADA: 'bg-blue-100 text-blue-700',
  COMPLETADA: 'bg-green-100 text-green-700',
  CANCELADA:  'bg-gray-100 text-gray-500',
  RECHAZADA:  'bg-red-100 text-red-600',
}

function FilaTour({ t, onToggle, onToggleRnt }: { t: TourAdmin; onToggle: () => void; onToggleRnt: () => void }) {
  const [expandido, setExpandido] = useState(false)
  const [reservas, setReservas] = useState<ReservaAdminTour[] | null>(null)
  const [cargandoR, setCargandoR] = useState(false)

  async function toggleExpansion() {
    if (!expandido && reservas === null) {
      setCargandoR(true)
      try { setReservas(await adminReservasTour(t.id)) } catch { setReservas([]) }
      setCargandoR(false)
    }
    setExpandido(v => !v)
  }

  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-[#1A1A1A]">{t.nombre}</p>
            <p className="text-xs text-gray-400">{t.duracionHoras}h &middot; max {t.maxParticipantes} pers.</p>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-600">
          <p>{t.comercio.nombre}</p>
          <p className="text-xs text-gray-400">
            {t.comercio.municipio}{t.comercio.departamento ? `, ${t.comercio.departamento}` : ''}
          </p>
        </td>
        <td className="px-4 py-3 text-right font-medium">{formatearPrecio(Number(t.precioPersona))}/pers.</td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={toggleExpansion}
            className="text-sm font-semibold text-[#2D6A4F] hover:underline"
          >
            {t._count?.reservas ?? 0}
            <span className="ml-1 text-xs">{expandido ? '▲' : '▼'}</span>
          </button>
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            t.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}>
            {t.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            t.rntVerificado ? 'bg-blue-100 text-blue-700' : t.rnt ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {t.rntVerificado ? '✓ Verificado' : t.rnt ? 'Pendiente' : 'Sin RNT'}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex flex-col gap-1.5 items-end">
            <button
              onClick={onToggle}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                t.activo
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
              }`}
            >
              {t.activo ? 'Suspender' : 'Activar'}
            </button>
            <button
              onClick={onToggleRnt}
              disabled={!t.rnt}
              title={!t.rnt ? 'El operador aún no registró su número de RNT' : undefined}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                t.rntVerificado
                  ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  : 'border-blue-200 text-blue-600 hover:bg-blue-50'
              }`}
            >
              {t.rntVerificado ? 'Quitar verificación' : 'Verificar RNT'}
            </button>
          </div>
        </td>
      </tr>

      {expandido && (
        <tr>
          <td colSpan={7} className="bg-[#F7F5F2] px-6 py-4">
            {cargandoR ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !reservas || reservas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Sin reservas aun</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Codigo</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Cliente</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Fecha tour</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Pers.</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Total</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservas.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-3 py-2 font-mono text-gray-500">{r.codigo}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-[#1A1A1A]">{r.cliente.nombre}</p>
                          <p className="text-gray-400">{r.cliente.email}</p>
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(r.fechaTour).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-2 text-right">{r.participantes}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatearPrecio(Number(r.total))}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLE[r.estado] ?? ''}`}>
                            {r.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminToursPage() {
  const [tours, setTours] = useState<TourAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos')

  useEffect(() => {
    (async () => {
      try {
        const d = await adminListarTours()
        setTours(d)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los tours.')
      } finally {
        setCargando(false)
      }
    })()
  }, [])

  async function toggleEstado(tour: TourAdmin) {
    const actualizado = await adminCambiarEstadoTour(tour.id, !tour.activo)
    setTours(prev => prev.map(t => t.id === tour.id ? { ...t, activo: actualizado.activo } : t))
  }

  async function toggleRnt(tour: TourAdmin) {
    const actualizado = await adminVerificarRntTour(tour.id, !tour.rntVerificado)
    setTours(prev => prev.map(t => t.id === tour.id ? { ...t, rntVerificado: actualizado.rntVerificado } : t))
  }

  const filtrados = tours.filter(t => {
    if (filtroActivo === 'activos' && !t.activo) return false
    if (filtroActivo === 'inactivos' && t.activo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return t.nombre.toLowerCase().includes(q) || t.comercio.nombre.toLowerCase().includes(q) || t.comercio.municipio.toLowerCase().includes(q)
    }
    return true
  })

  const stats = {
    total: tours.length,
    activos: tours.filter(t => t.activo).length,
    reservas: tours.reduce((s, t) => s + (t._count?.reservas ?? 0), 0),
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Tours &amp; Experiencias</h1>
        <p className="text-sm text-gray-500 mt-1">Gestion de tours registrados en Teravia. Haz clic en el numero de reservas para verlas.</p>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total tours', val: stats.total, color: 'text-[#2D6A4F]' },
          { label: 'Activos', val: stats.activos, color: 'text-green-600' },
          { label: 'Total reservas', val: stats.reservas, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, operador o municipio..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
        />
        <div className="flex gap-1">
          {(['todos', 'activos', 'inactivos'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroActivo(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize border transition-colors ${
                filtroActivo === f ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay tours con esos filtros</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tour</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Operador / Ciudad</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Precio</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Reservas</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">RNT</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(t => (
                  <FilaTour key={t.id} t={t} onToggle={() => toggleEstado(t)} onToggleRnt={() => toggleRnt(t)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
