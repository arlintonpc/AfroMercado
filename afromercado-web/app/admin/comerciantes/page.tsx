'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  listarComerciosAdmin,
  verificarComercianteAdmin,
  toggleWhatsappAdmin,
  setComisionComercioAdmin,
  type AdminComercio,
  type EstadoComerciante,
} from '@/components/admin/api'

// ── Utilidades ────────────────────────────────────────────────

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function horasTrasRegistro(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000
}

const ESTADO_LABEL: Record<EstadoComerciante, string> = {
  PENDIENTE_REVISION: 'Por revisar',
  APROBADO:           'Aprobado',
  RECHAZADO:          'Rechazado',
  SUSPENDIDO:         'Suspendido',
}

const ESTADO_COLOR: Record<EstadoComerciante, string> = {
  PENDIENTE_REVISION: 'bg-[#F39C12]/15 text-[#B7730A]',
  APROBADO:           'bg-[#52B788]/15 text-[#2D6A4F]',
  RECHAZADO:          'bg-red-100 text-red-700',
  SUSPENDIDO:         'bg-gray-100 text-gray-600',
}

const FILTROS: { id: EstadoComerciante | 'TODOS'; etiqueta: string }[] = [
  { id: 'TODOS',             etiqueta: 'Todos'       },
  { id: 'PENDIENTE_REVISION', etiqueta: 'Por revisar' },
  { id: 'APROBADO',          etiqueta: 'Aprobados'   },
  { id: 'RECHAZADO',         etiqueta: 'Rechazados'  },
  { id: 'SUSPENDIDO',        etiqueta: 'Suspendidos' },
]

// ── Señales de fraude ──────────────────────────────────────────

function señalesFraude(comercio: AdminComercio): string[] {
  const señales: string[] = []
  const horas = horasTrasRegistro(comercio.usuario.createdAt)
  if (horas < 1)               señales.push('⚡ Cuenta creada hace menos de 1 hora')
  if (!comercio.fotoDocumentoUrl) señales.push('📄 Sin foto de documento')
  if (!comercio.usuario.tipoDocumento || !comercio.usuario.numeroDocumento) señales.push('🪪 Sin documento de identidad')
  if (!comercio.usuario.telefono)  señales.push('📱 Sin teléfono')
  if (comercio.usuario.email.match(/@(mailinator|yopmail|tempmail|guerrillamail)\./i)) señales.push('📧 Email temporal')
  if (comercio.usuario.telefono && !comercio.usuario.telefono.match(/^3\d{9}$/)) señales.push('📱 Teléfono no colombiano')
  return señales
}

// ── Modal de acción ────────────────────────────────────────────

function ModalAccion({
  comercio,
  accion,
  onConfirmar,
  onCerrar,
}: {
  comercio: AdminComercio
  accion: 'APROBAR' | 'RECHAZAR' | 'SUSPENDER' | 'REHABILITAR'
  onConfirmar: (motivo: string) => void
  onCerrar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const necesitaMotivo = accion === 'RECHAZAR' || accion === 'SUSPENDER'

  const TITULO: Record<string, string> = {
    APROBAR:     `Aprobar "${comercio.nombre}"`,
    RECHAZAR:    `Rechazar "${comercio.nombre}"`,
    SUSPENDER:   `Suspender "${comercio.nombre}"`,
    REHABILITAR: `Rehabilitar "${comercio.nombre}"`,
  }
  const COLOR_BTN: Record<string, string> = {
    APROBAR:     'bg-[#2D6A4F] hover:bg-[#235540] text-white',
    RECHAZAR:    'bg-red-600 hover:bg-red-700 text-white',
    SUSPENDER:   'bg-orange-500 hover:bg-orange-600 text-white',
    REHABILITAR: 'bg-[#2D6A4F] hover:bg-[#235540] text-white',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#1A1A1A]">{TITULO[accion]}</h2>

        {necesitaMotivo && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">
              Motivo {accion === 'RECHAZAR' ? '(se le comunicará al comerciante)' : ''}
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
              placeholder="Ej: Documento no legible, información incompleta..."
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCerrar}
            className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(motivo)}
            disabled={necesitaMotivo && !motivo.trim()}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${COLOR_BTN[accion]}`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal comisión ─────────────────────────────────────────────

function ModalComision({
  comercio,
  onConfirmar,
  onCerrar,
}: {
  comercio: AdminComercio
  onConfirmar: (tasa: number, motivo: string) => void
  onCerrar: () => void
}) {
  const tasaActual = comercio.comisiones[0] ? Number(comercio.comisiones[0].tasa) * 100 : 10
  const [tasaPct, setTasaPct] = useState(String(tasaActual))
  const [motivo, setMotivo]   = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#1A1A1A]">Comisión — {comercio.nombre}</h2>
        <p className="mt-1 text-sm text-[#1A1A1A]/55">Tasa actual: {tasaActual}%</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Nueva tasa (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={tasaPct}
              onChange={(e) => setTasaPct(e.target.value)}
              className="w-full rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Motivo</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: comercio nuevo, plan especial..."
              className="w-full rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]">
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(parseFloat(tasaPct) / 100, motivo)}
            disabled={!tasaPct || isNaN(parseFloat(tasaPct))}
            className="rounded-lg bg-[#2D6A4F] hover:bg-[#235540] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Fila de comerciante ────────────────────────────────────────

function FilaComerciante({
  comercio,
  procesando,
  onAccion,
  onWhatsapp,
  onComision,
}: {
  comercio: AdminComercio
  procesando: boolean
  onAccion: (c: AdminComercio, a: 'APROBAR' | 'RECHAZAR' | 'SUSPENDER' | 'REHABILITAR') => void
  onWhatsapp: (c: AdminComercio) => void
  onComision: (c: AdminComercio) => void
}) {
  const señales = señalesFraude(comercio)
  const tasaActual = comercio.comisiones[0] ? `${(Number(comercio.comisiones[0].tasa) * 100).toFixed(1)}%` : '10.0%'

  return (
    <tr className="border-b border-[#1A1A1A]/5 last:border-0 hover:bg-[#F8F5F0]/60">
      {/* Nombre + señales */}
      <td className="px-4 py-4 align-top min-w-[180px]">
        <div className="font-semibold text-[#1A1A1A]">{comercio.nombre}</div>
        <div className="text-xs text-[#1A1A1A]/50 mt-0.5">{comercio.municipio} · {fechaCorta(comercio.createdAt)}</div>
        {señales.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {señales.map((s) => (
              <div key={s} className="text-xs text-orange-600 font-medium">{s}</div>
            ))}
          </div>
        )}
      </td>

      {/* Propietario */}
      <td className="px-4 py-4 align-top">
        <div className="text-sm font-medium text-[#1A1A1A]">{comercio.usuario.nombre}</div>
        <div className="text-xs text-[#1A1A1A]/50">{comercio.usuario.email}</div>
        {comercio.usuario.telefono && <div className="text-xs text-[#1A1A1A]/50">{comercio.usuario.telefono}</div>}
        {comercio.usuario.numeroDocumento && (
          <div className="text-xs text-[#1A1A1A]/50">
            {comercio.usuario.tipoDocumento} {comercio.usuario.numeroDocumento}
          </div>
        )}
      </td>

      {/* Documento + stats */}
      <td className="px-4 py-4 align-top text-center text-sm text-[#1A1A1A]/70">
        {comercio._count.productos}
        {comercio.fotoDocumentoUrl && (
          <div className="mt-1">
            <a href={comercio.fotoDocumentoUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium text-[#2D6A4F] underline">
              Doc
            </a>
          </div>
        )}
      </td>

      {/* Estado */}
      <td className="px-4 py-4 align-top">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLOR[comercio.estadoRegistro]}`}>
          {ESTADO_LABEL[comercio.estadoRegistro]}
        </span>
        {comercio.motivoRechazo && (
          <div className="mt-1 text-xs text-[#1A1A1A]/50 max-w-[140px] truncate" title={comercio.motivoRechazo}>
            {comercio.motivoRechazo}
          </div>
        )}
      </td>

      {/* Comisión */}
      <td className="px-4 py-4 align-top text-center">
        <button onClick={() => onComision(comercio)} disabled={procesando}
          className="text-sm font-semibold text-[#2D6A4F] hover:underline disabled:opacity-50">
          {tasaActual}
        </button>
      </td>

      {/* WhatsApp visible */}
      <td className="px-4 py-4 align-top text-center">
        {comercio.whatsapp ? (
          <button
            onClick={() => onWhatsapp(comercio)}
            disabled={procesando}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              comercio.whatsappVisible
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {comercio.whatsappVisible ? '✓ Visible' : 'Oculto'}
          </button>
        ) : (
          <span className="text-xs text-[#1A1A1A]/30">Sin número</span>
        )}
      </td>

      {/* Acciones */}
      <td className="px-4 py-4 align-top">
        <div className="flex flex-wrap gap-1.5 justify-end">
          {comercio.estadoRegistro === 'PENDIENTE_REVISION' && (
            <>
              <button onClick={() => onAccion(comercio, 'APROBAR')} disabled={procesando}
                className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#235540] disabled:opacity-50">
                Aprobar
              </button>
              <button onClick={() => onAccion(comercio, 'RECHAZAR')} disabled={procesando}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                Rechazar
              </button>
            </>
          )}
          {comercio.estadoRegistro === 'APROBADO' && (
            <button onClick={() => onAccion(comercio, 'SUSPENDER')} disabled={procesando}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50">
              Suspender
            </button>
          )}
          {(comercio.estadoRegistro === 'RECHAZADO' || comercio.estadoRegistro === 'SUSPENDIDO') && (
            <button onClick={() => onAccion(comercio, 'REHABILITAR')} disabled={procesando}
              className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#235540] disabled:opacity-50">
              Rehabilitar
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Página principal ───────────────────────────────────────────

export default function ComerciantesAdminPage() {
  const [comercios, setComercios]   = useState<AdminComercio[]>([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filtro, setFiltro]         = useState<EstadoComerciante | 'TODOS'>('TODOS')
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso]           = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [modalAccion, setModalAccion] = useState<{ comercio: AdminComercio; accion: 'APROBAR' | 'RECHAZAR' | 'SUSPENDER' | 'REHABILITAR' } | null>(null)
  const [modalComision, setModalComision] = useState<AdminComercio | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const estado = filtro === 'TODOS' ? undefined : filtro
      setComercios(await listarComerciosAdmin(false, estado))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  async function handleAccion(comercio: AdminComercio, accion: 'APROBAR' | 'RECHAZAR' | 'SUSPENDER' | 'REHABILITAR', motivo: string) {
    setModalAccion(null)
    setProcesandoId(comercio.id)
    try {
      const actualizado = await verificarComercianteAdmin(comercio.id, accion, motivo)
      setComercios((prev) => prev.map((c) => c.id === comercio.id ? { ...c, ...actualizado } : c))
      const MSGS: Record<string, string> = {
        APROBAR:     `"${comercio.nombre}" aprobado.`,
        RECHAZAR:    `"${comercio.nombre}" rechazado.`,
        SUSPENDER:   `"${comercio.nombre}" suspendido.`,
        REHABILITAR: `"${comercio.nombre}" rehabilitado.`,
      }
      setAviso({ tipo: 'exito', texto: MSGS[accion] })
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' })
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleWhatsapp(comercio: AdminComercio) {
    setProcesandoId(comercio.id)
    try {
      const actualizado = await toggleWhatsappAdmin(comercio.id)
      setComercios((prev) => prev.map((c) => c.id === comercio.id ? { ...c, whatsappVisible: actualizado.whatsappVisible } : c))
      setAviso({ tipo: 'exito', texto: `WhatsApp ${actualizado.whatsappVisible ? 'activado' : 'desactivado'} para "${comercio.nombre}".` })
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' })
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleComision(comercio: AdminComercio, tasa: number, motivo: string) {
    setModalComision(null)
    setProcesandoId(comercio.id)
    try {
      const nueva = await setComisionComercioAdmin(comercio.id, tasa, motivo)
      setComercios((prev) => prev.map((c) =>
        c.id === comercio.id
          ? { ...c, comisiones: [{ tasa: nueva.tasa, motivo: nueva.motivo, desde: new Date().toISOString(), hasta: null }] }
          : c
      ))
      setAviso({ tipo: 'exito', texto: `Comisión de "${comercio.nombre}" actualizada a ${(tasa * 100).toFixed(1)}%.` })
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' })
    } finally {
      setProcesandoId(null)
    }
  }

  const pendientes = comercios.filter((c) => c.estadoRegistro === 'PENDIENTE_REVISION').length

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Comerciantes
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Aprueba solicitudes, controla comisiones y WhatsApp de cada comercio.
          </p>
        </div>
        <button onClick={cargar} disabled={cargando}
          className="rounded-xl border border-[#1A1A1A]/10 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-[#F8F5F0] disabled:opacity-50">
          Actualizar
        </button>
      </div>

      {/* Aviso */}
      {aviso && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          aviso.tipo === 'exito' ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]' : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {aviso.texto}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map(({ id, etiqueta }) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filtro === id
                ? 'bg-[#2D6A4F] text-white'
                : 'border border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/70 hover:bg-[#F8F5F0]'
            }`}
          >
            {etiqueta}
            {id === 'PENDIENTE_REVISION' && pendientes > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 text-xs font-bold ${filtro === id ? 'bg-white/20 text-white' : 'bg-[#F39C12]/20 text-[#B7730A]'}`}>
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm">
        {error ? (
          <div className="px-5 py-8 text-center text-sm text-red-600">
            <p className="font-medium">{error}</p>
            <button onClick={cargar} className="mt-2 font-semibold underline">Reintentar</button>
          </div>
        ) : !cargando && comercios.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-[#1A1A1A]">No hay comercios con este filtro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                  <th className="px-4 py-3 font-semibold">Comercio / señales</th>
                  <th className="px-4 py-3 font-semibold">Propietario</th>
                  <th className="px-4 py-3 text-center font-semibold">Prods</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-center font-semibold">Comisión</th>
                  <th className="px-4 py-3 text-center font-semibold">WhatsApp</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#1A1A1A]/5">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 w-full animate-pulse rounded bg-[#1A1A1A]/8" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : comercios.map((comercio) => (
                      <FilaComerciante
                        key={comercio.id}
                        comercio={comercio}
                        procesando={procesandoId === comercio.id}
                        onAccion={(c, a) => setModalAccion({ comercio: c, accion: a })}
                        onWhatsapp={handleWhatsapp}
                        onComision={(c) => setModalComision(c)}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modales */}
      {modalAccion && (
        <ModalAccion
          comercio={modalAccion.comercio}
          accion={modalAccion.accion}
          onConfirmar={(motivo) => handleAccion(modalAccion.comercio, modalAccion.accion, motivo)}
          onCerrar={() => setModalAccion(null)}
        />
      )}
      {modalComision && (
        <ModalComision
          comercio={modalComision}
          onConfirmar={(tasa, motivo) => handleComision(modalComision, tasa, motivo)}
          onCerrar={() => setModalComision(null)}
        />
      )}
    </div>
  )
}
