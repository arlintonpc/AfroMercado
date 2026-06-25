'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface SolicitudAdmin {
  id: number
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  vehiculoTipo: string
  vehiculoMarca: string
  vehiculoModelo: string
  vehiculoColor: string
  vehiculoPlaca: string
  vehiculoAnio: number
  licenciaNumero: string
  municipioBase?: string
  fotoVehiculoUrl: string | null
  fotoLicenciaUrl: string | null
  documentos?: Record<string, string> | null
  notasAdmin: string | null
  revisadoAt: string | null
  createdAt: string
  usuario: { id: number; nombre: string; email: string; telefono: string | null; rol: string }
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TIPO_EMOJI: Record<string, string> = {
  MOTO: '🏍️', BICICLETA: '🚲', CARRO: '🚗', CAMIONETA: '🚙', TRICIMOTO: '🛺',
}

const DOC_LABELS: Record<string, string> = {
  cedulaFrente: 'Cédula (frente)',
  cedulaReverso: 'Cédula (reverso)',
  selfie: 'Selfie',
  licenciaFoto: 'Licencia',
  matriculaFrente: 'Matrícula (frente)',
  matriculaReverso: 'Matrícula (reverso)',
  soat: 'SOAT',
}

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  APROBADA:  'bg-[#52B788]/15 text-[#2D6A4F] border-[#52B788]/30',
  RECHAZADA: 'bg-red-50 text-red-600 border-red-200',
}

// ─── Modal de revisión ────────────────────────────────────────────────────────

function ModalRevisar({
  solicitud,
  onRevisada,
  onCerrar,
}: {
  solicitud: SolicitudAdmin
  onRevisada: (actualizada: SolicitudAdmin) => void
  onCerrar: () => void
}) {
  const [notas, setNotas]       = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function revisar(accion: 'APROBAR' | 'RECHAZAR') {
    setProcesando(true)
    setError(null)
    try {
      const res = await apiFetch<{ ok: boolean; data: SolicitudAdmin }>(
        `/admin/solicitudes-repartidor/${solicitud.id}/revisar`,
        { method: 'PATCH', body: { accion, notas: notas.trim() } },
      )
      onRevisada(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar.')
      setProcesando(false)
    }
  }

  const urlRunt = `https://www.runt.com.co/consultaCiudadana/#/consultaVehiculo`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="my-4 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="font-semibold text-[#1A1A1A]">Revisar solicitud</h2>
          <button onClick={onCerrar} className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">
          {/* Datos del solicitante */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/40 mb-2">Solicitante</p>
            <div className="rounded-xl bg-[#F8F5F0] px-4 py-3">
              <p className="font-semibold text-[#1A1A1A]">{solicitud.usuario.nombre}</p>
              <p className="text-sm text-[#1A1A1A]/60">{solicitud.usuario.email}</p>
              {solicitud.usuario.telefono && (
                <p className="text-sm text-[#2D6A4F] font-medium">{solicitud.usuario.telefono}</p>
              )}
            </div>
          </section>

          {/* Datos del vehículo */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/40 mb-2">Vehículo</p>
            <div className="rounded-xl bg-[#F8F5F0] px-4 py-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div>
                <p className="text-xs text-[#1A1A1A]/40">Tipo</p>
                <p className="font-medium">{TIPO_EMOJI[solicitud.vehiculoTipo] ?? ''} {solicitud.vehiculoTipo}</p>
              </div>
              <div>
                <p className="text-xs text-[#1A1A1A]/40">Año</p>
                <p className="font-medium">{solicitud.vehiculoAnio}</p>
              </div>
              <div>
                <p className="text-xs text-[#1A1A1A]/40">Marca / Modelo</p>
                <p className="font-medium">{solicitud.vehiculoMarca} {solicitud.vehiculoModelo}</p>
              </div>
              <div>
                <p className="text-xs text-[#1A1A1A]/40">Color</p>
                <p className="font-medium">{solicitud.vehiculoColor}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-[#1A1A1A]/40">Placa</p>
                <div className="flex items-center gap-3">
                  <p className="font-mono font-bold text-lg tracking-widest text-[#2D6A4F]">
                    {solicitud.vehiculoPlaca}
                  </p>
                  <a
                    href={urlRunt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-[#2D6A4F]/30 px-3 py-1 text-xs font-semibold text-[#2D6A4F] hover:bg-[#2D6A4F]/8 transition-colors"
                  >
                    Verificar en RUNT ↗
                  </a>
                </div>
                <p className="text-xs text-[#1A1A1A]/35 mt-0.5">
                  Ingresa al RUNT y consulta la placa manualmente para verificar propietario y estado.
                </p>
              </div>
            </div>
          </section>

          {/* Licencia */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/40 mb-2">Licencia de conducción</p>
            <div className="rounded-xl bg-[#F8F5F0] px-4 py-3 text-sm">
              <p className="text-xs text-[#1A1A1A]/40">Número</p>
              <p className="font-mono font-semibold text-[#1A1A1A]">{solicitud.licenciaNumero}</p>
            </div>
          </section>

          {/* Municipio de operación */}
          {solicitud.municipioBase && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/40 mb-2">Municipio de operación principal</p>
              <div className="rounded-xl bg-[#F8F5F0] px-4 py-3 text-sm">
                <p className="font-semibold text-[#1A1A1A]">{solicitud.municipioBase}</p>
              </div>
            </section>
          )}

          {/* Documentos */}
          {solicitud.documentos && Object.values(solicitud.documentos).some(Boolean) && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1A1A]/40 mb-2">Documentos</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(solicitud.documentos).map(([k, url]) =>
                  url ? (
                    <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={DOC_LABELS[k] ?? k}
                        className="h-24 w-full rounded-lg border border-[#1A1A1A]/10 object-cover"
                      />
                      <p className="mt-1 text-center text-[11px] text-[#1A1A1A]/55">{DOC_LABELS[k] ?? k}</p>
                    </a>
                  ) : null,
                )}
              </div>
              <p className="mt-1 text-xs text-[#1A1A1A]/35">Toca una imagen para verla en grande.</p>
            </section>
          )}

          {/* Notas */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">
              Notas (opcional — se envían al solicitante si rechazas)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Ej: La placa no coincide con los registros del RUNT…"
              className="w-full rounded-xl border border-[#1A1A1A]/15 px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => revisar('RECHAZAR')}
              disabled={procesando}
              className="flex-1 rounded-xl border border-red-300 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {procesando ? '…' : 'Rechazar'}
            </button>
            <button
              onClick={() => revisar('APROBAR')}
              disabled={procesando}
              className="flex-1 rounded-xl bg-[#2D6A4F] py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] disabled:opacity-50 transition-colors"
            >
              {procesando ? 'Aprobando…' : '✓ Aprobar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta solicitud ────────────────────────────────────────────────────────

function TarjetaSolicitud({
  s,
  onRevisar,
}: {
  s: SolicitudAdmin
  onRevisar: (s: SolicitudAdmin) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1A1A1A]">{s.usuario.nombre}</p>
          <p className="text-sm text-[#1A1A1A]/55">{s.usuario.telefono ?? s.usuario.email}</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold flex-shrink-0 ${ESTADO_BADGE[s.estado]}`}>
          {s.estado}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-[#F8F5F0] px-3 py-2">
        <span className="text-lg">{TIPO_EMOJI[s.vehiculoTipo] ?? '🚗'}</span>
        <div className="text-sm">
          <span className="font-semibold text-[#1A1A1A]">{s.vehiculoMarca} {s.vehiculoModelo}</span>
          <span className="text-[#1A1A1A]/50 ml-2">{s.vehiculoColor} · {s.vehiculoAnio}</span>
        </div>
        <span className="ml-auto font-mono text-sm font-bold text-[#2D6A4F]">{s.vehiculoPlaca}</span>
      </div>

      <div className="flex items-center justify-between text-xs text-[#1A1A1A]/40">
        <span>Solicitado {fmtFecha(s.createdAt)}</span>
        {s.revisadoAt && <span>Revisado {fmtFecha(s.revisadoAt)}</span>}
      </div>

      {s.notasAdmin && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{s.notasAdmin}</p>
      )}

      {s.estado === 'PENDIENTE' && (
        <button
          onClick={() => onRevisar(s)}
          className="w-full rounded-xl bg-[#2D6A4F] py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
        >
          Revisar solicitud
        </button>
      )}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

type Filtro = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'TODAS'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'PENDIENTE',  label: 'Pendientes' },
  { id: 'APROBADA',   label: 'Aprobadas' },
  { id: 'RECHAZADA',  label: 'Rechazadas' },
  { id: 'TODAS',      label: 'Todas' },
]

export default function SolicitudesRepartidorPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudAdmin[]>([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [filtro, setFiltro]           = useState<Filtro>('PENDIENTE')
  const [revisando, setRevisando]     = useState<SolicitudAdmin | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await apiFetch<{ ok: boolean; data: SolicitudAdmin[] }>('/admin/solicitudes-repartidor')
      setSolicitudes(res.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function handleRevisada(actualizada: SolicitudAdmin) {
    setSolicitudes((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)))
    setRevisando(null)
  }

  const visibles = filtro === 'TODAS'
    ? solicitudes
    : solicitudes.filter((s) => s.estado === filtro)

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">
            ← Panel
          </Link>
          <h1
            className="mt-1 text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Solicitudes de repartidor
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">
            Revisa y aprueba a los candidatos. Verifica la placa en el RUNT antes de aprobar.
          </p>
        </div>
        <button
          onClick={cargar} disabled={cargando}
          className="rounded-xl border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5 disabled:opacity-40 transition-colors"
        >
          {cargando ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Filtros */}
      <div className="flex gap-1 rounded-2xl bg-[#1A1A1A]/5 p-1 w-fit flex-wrap">
        {FILTROS.map((f) => {
          const count = f.id === 'TODAS' ? solicitudes.length : solicitudes.filter((s) => s.estado === f.id).length
          return (
            <button
              key={f.id} onClick={() => setFiltro(f.id)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                filtro === f.id ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80',
              ].join(' ')}
            >
              {f.label}
              {count > 0 && (
                <span className={`ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  filtro === f.id
                    ? f.id === 'PENDIENTE' ? 'bg-amber-500 text-white' : 'bg-[#2D6A4F] text-white'
                    : 'bg-[#1A1A1A]/10 text-[#1A1A1A]/60'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-[#1A1A1A]/5 animate-pulse" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[#1A1A1A]/60">
            {filtro === 'PENDIENTE' ? 'No hay solicitudes pendientes 🎉' : 'Sin resultados'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibles.map((s) => (
            <TarjetaSolicitud key={s.id} s={s} onRevisar={setRevisando} />
          ))}
        </div>
      )}

      {/* Modal revisar */}
      {revisando && (
        <ModalRevisar
          solicitud={revisando}
          onRevisada={handleRevisada}
          onCerrar={() => setRevisando(null)}
        />
      )}
    </div>
  )
}
