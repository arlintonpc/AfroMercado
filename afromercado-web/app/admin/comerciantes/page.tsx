'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import {
  listarComerciosAdmin,
  verificarComercianteAdmin,
  toggleWhatsappAdmin,
  toggleVerificadoEtnicoAdmin,
  setComisionComercioAdmin,
  revisarDeclaracionTerritorial,
  type AdminComercio,
  type CambioCriticoComercio,
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

type FiltroRevision = 'TODOS' | 'CON_CAMBIOS' | 'CON_SENALES' | 'SIN_DOCUMENTOS'

const FILTROS_REVISION: { id: FiltroRevision; etiqueta: string }[] = [
  { id: 'TODOS', etiqueta: 'Revisión completa' },
  { id: 'CON_CAMBIOS', etiqueta: 'Con cambios críticos' },
  { id: 'CON_SENALES', etiqueta: 'Con señales' },
  { id: 'SIN_DOCUMENTOS', etiqueta: 'Sin documentos' },
]

// ── Señales de fraude ──────────────────────────────────────────

function documentoFrenteUrl(comercio: AdminComercio): string | null {
  return comercio.fotoDocumentoFrenteUrl ?? comercio.fotoDocumentoUrl ?? null
}

function documentosIdentidadCompletos(comercio: AdminComercio): boolean {
  return Boolean(documentoFrenteUrl(comercio) && comercio.fotoDocumentoReversoUrl)
}

function señalesFraude(comercio: AdminComercio): string[] {
  const señales: string[] = []
  const horas = horasTrasRegistro(comercio.usuario.createdAt)
  if (horas < 1)               señales.push('⚡ Cuenta creada hace menos de 1 hora')
  if (!documentoFrenteUrl(comercio)) señales.push('📄 Sin frente del documento')
  if (!comercio.fotoDocumentoReversoUrl) señales.push('📄 Sin reverso del documento')
  if (!comercio.usuario.tipoDocumento || !comercio.usuario.numeroDocumento) señales.push('🪪 Sin documento de identidad')
  if (!comercio.usuario.telefono)  señales.push('📱 Sin teléfono')
  if (comercio.usuario.email.match(/@(mailinator|yopmail|tempmail|guerrillamail)\./i)) señales.push('📧 Email temporal')
  if (comercio.usuario.telefono && !comercio.usuario.telefono.match(/^3\d{9}$/)) señales.push('📱 Teléfono no colombiano')
  return señales
}

function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function textoBusquedaComercio(comercio: AdminComercio) {
  return normalizarTexto([
    comercio.nombre,
    comercio.municipio,
    comercio.usuario.nombre,
    comercio.usuario.email,
    comercio.usuario.telefono ?? '',
    comercio.usuario.numeroDocumento ?? '',
  ].join(' '))
}

function tieneCambiosCriticosPendientes(comercio: AdminComercio) {
  return Boolean(comercio.cambiosCriticos?.some((c) => c.estado === 'PENDIENTE'))
}

function pasaFiltroRevision(comercio: AdminComercio, filtro: FiltroRevision) {
  if (filtro === 'CON_CAMBIOS') return tieneCambiosCriticosPendientes(comercio)
  if (filtro === 'CON_SENALES') return señalesFraude(comercio).length > 0
  if (filtro === 'SIN_DOCUMENTOS') return !documentosIdentidadCompletos(comercio)
  return true
}

function snapshotSeguro(snapshot: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return snapshot && typeof snapshot === 'object' ? snapshot : {}
}

function valorSnapshot(snapshot: Record<string, unknown>, campo: string, fallback = '-'): string {
  const valor = snapshot[campo]
  if (valor === null || valor === undefined || valor === '') return fallback
  return String(valor)
}

function urlSnapshot(snapshot: Record<string, unknown>, campo: string): string | null {
  const valor = snapshot[campo]
  return typeof valor === 'string' && valor.trim() ? valor : null
}

function etiquetaTipoCambio(tipo: string): string {
  if (tipo === 'DOCUMENTO_IDENTIDAD') return 'Documento de identidad'
  if (tipo === 'CUENTA_DISPERSION') return 'Cuenta de pagos'
  if (tipo === 'DECLARACION_TERRITORIAL') return 'Declaración de organización territorial'
  return tipo.replaceAll('_', ' ').toLowerCase()
}

const ETIQUETA_TIPO_ORGANIZACION: Record<string, string> = {
  CONSEJO_COMUNITARIO: 'Consejo Comunitario',
  RESGUARDO_INDIGENA: 'Resguardo Indígena',
  ZONA_RESERVA_CAMPESINA: 'Zona de Reserva Campesina',
  OTRA: 'Otra',
}

function colorEstadoCambio(estado: string): string {
  if (estado === 'PENDIENTE') return 'bg-[#F39C12]/15 text-[#B7730A]'
  if (estado === 'APROBADO') return 'bg-[#52B788]/15 text-[#2D6A4F]'
  if (estado === 'RECHAZADO') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function MiniaturaDocumento({ etiqueta, url, compacta = false }: { etiqueta: string; url: string | null; compacta?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-[#1A1A1A]/45">{etiqueta}</div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <div className={`relative overflow-hidden rounded-lg border border-[#1A1A1A]/10 bg-[#F7F2EA] ${compacta ? 'h-16' : 'h-20'}`}>
            <Image
              src={url}
              alt={`${etiqueta} del documento`}
              fill
              className="object-contain"
              sizes="120px"
              unoptimized
            />
          </div>
          <span className="mt-1 block text-center text-[11px] font-semibold text-[#2D6A4F] underline">
            Abrir
          </span>
        </a>
      ) : (
        <div className={`flex items-center justify-center rounded-lg border border-dashed border-[#1A1A1A]/10 bg-[#F8F5F0] px-2 text-center text-[11px] text-[#1A1A1A]/35 ${compacta ? 'h-16' : 'h-20'}`}>
          Sin imagen
        </div>
      )}
    </div>
  )
}

function EnlacesDocumento({ titulo, snapshot, compacta = false }: { titulo: string; snapshot: Record<string, unknown>; compacta?: boolean }) {
  const frente = urlSnapshot(snapshot, 'frenteUrl')
  const reverso = urlSnapshot(snapshot, 'reversoUrl')
  return (
    <div className="rounded-lg border border-[#1A1A1A]/8 bg-white px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#1A1A1A]/45">{titulo}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <MiniaturaDocumento etiqueta="Frente" url={frente} compacta={compacta} />
        <MiniaturaDocumento etiqueta="Reverso" url={reverso} compacta={compacta} />
      </div>
    </div>
  )
}

function ResumenCuenta({ titulo, snapshot, compacta = false }: { titulo: string; snapshot: Record<string, unknown>; compacta?: boolean }) {
  return (
    <div className="rounded-lg border border-[#1A1A1A]/8 bg-white px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#1A1A1A]/45">{titulo}</div>
      <div className={`mt-1 text-xs text-[#1A1A1A]/70 ${compacta ? 'leading-snug' : 'leading-relaxed'}`}>
        <div>{valorSnapshot(snapshot, 'bancoNombre')} · {valorSnapshot(snapshot, 'tipoCuenta')}</div>
        <div>Titular: {valorSnapshot(snapshot, 'titularNombre')}</div>
        <div>Doc: {valorSnapshot(snapshot, 'tipoDocumento')} {valorSnapshot(snapshot, 'numeroDocumento')}</div>
        <div>Termina en: {valorSnapshot(snapshot, 'numeroCuentaUltimos4')}</div>
      </div>
    </div>
  )
}

function ResumenDeclaracionTerritorial({ snapshot }: { snapshot: Record<string, unknown> }) {
  const tipo = valorSnapshot(snapshot, 'tipo')
  return (
    <div className="rounded-lg border border-[#1A1A1A]/8 bg-white px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#1A1A1A]/45">Declaración</div>
      <div className="mt-1 text-xs leading-relaxed text-[#1A1A1A]/70">
        <div>{ETIQUETA_TIPO_ORGANIZACION[tipo] ?? tipo}</div>
        <div>Organización: {valorSnapshot(snapshot, 'nombreOrganizacion')}</div>
      </div>
    </div>
  )
}

function CambioCriticoCard({
  cambio,
  comercio,
  compacta = false,
  onRevisar,
  procesando = false,
}: {
  cambio: CambioCriticoComercio
  comercio: AdminComercio
  compacta?: boolean
  onRevisar?: (cambio: CambioCriticoComercio, accion: 'APROBAR' | 'RECHAZAR') => void
  procesando?: boolean
}) {
  const anterior = snapshotSeguro(cambio.snapshotAnterior)
  const nuevoGuardado = snapshotSeguro(cambio.snapshotNuevo)
  const esDocumento = cambio.tipo === 'DOCUMENTO_IDENTIDAD'
  const esCuenta = cambio.tipo === 'CUENTA_DISPERSION'
  const esDeclaracionTerritorial = cambio.tipo === 'DECLARACION_TERRITORIAL'
  const nuevo = esDocumento && cambio.estado === 'PENDIENTE'
    ? {
        ...nuevoGuardado,
        frenteUrl: documentoFrenteUrl(comercio) || nuevoGuardado.frenteUrl || null,
        reversoUrl: comercio.fotoDocumentoReversoUrl || nuevoGuardado.reversoUrl || null,
      }
    : nuevoGuardado

  return (
    <div className={`rounded-xl border border-[#D4A017]/25 bg-[#D4A017]/8 ${compacta ? 'p-2.5' : 'p-2'}`}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="text-xs font-bold text-[#1A1A1A]">{etiquetaTipoCambio(cambio.tipo)}</div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${colorEstadoCambio(cambio.estado)}`}>
          {cambio.estado}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-[#1A1A1A]/45">
        Solicitado {fechaCorta(cambio.createdAt)}
      </div>
      {cambio.productosDesactivados > 0 && (
        <div className="mt-1 text-[11px] font-medium text-[#C0392B]">
          {cambio.productosDesactivados} productos pausados
        </div>
      )}
      <div className={`mt-2 grid gap-2 ${compacta ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {esDocumento && (
          <>
            <EnlacesDocumento titulo="Antes" snapshot={anterior} compacta={compacta} />
            <EnlacesDocumento titulo="Después" snapshot={nuevo} compacta={compacta} />
          </>
        )}
        {esCuenta && (
          <>
            <ResumenCuenta titulo="Antes" snapshot={anterior} compacta={compacta} />
            <ResumenCuenta titulo="Después" snapshot={nuevo} compacta={compacta} />
          </>
        )}
        {esDeclaracionTerritorial && <ResumenDeclaracionTerritorial snapshot={nuevoGuardado} />}
        {!esDocumento && !esCuenta && !esDeclaracionTerritorial && (
          <div className="text-xs text-[#1A1A1A]/50">Cambio registrado para revisión administrativa.</div>
        )}
      </div>
      {esDeclaracionTerritorial && cambio.estado === 'PENDIENTE' && onRevisar && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onRevisar(cambio, 'APROBAR')}
            disabled={procesando}
            className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50"
          >
            Aprobar
          </button>
          <button
            onClick={() => onRevisar(cambio, 'RECHAZAR')}
            disabled={procesando}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}
    </div>
  )
}

function ResumenCambiosPendientes({
  cambios,
  comercio,
}: {
  cambios: CambioCriticoComercio[]
  comercio: AdminComercio
}) {
  if (cambios.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      {cambios.slice(0, 3).map((cambio) => (
        <CambioCriticoCard key={cambio.id} cambio={cambio} comercio={comercio} compacta />
      ))}
      {cambios.length > 3 && (
        <p className="text-xs font-medium text-[#1A1A1A]/50">
          Hay {cambios.length - 3} cambios adicionales en esta revisión.
        </p>
      )}
    </div>
  )
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
  const [confirmoDocumento, setConfirmoDocumento] = useState(false)
  const [confirmoCambios, setConfirmoCambios] = useState(false)
  const necesitaMotivo = accion === 'RECHAZAR' || accion === 'SUSPENDER'
  const requiereRevisionDocumento = accion === 'APROBAR' || accion === 'REHABILITAR'
  const cambiosPendientes = comercio.cambiosCriticos?.filter((c) => c.estado === 'PENDIENTE') ?? []
  const requiereRevisionCambios = requiereRevisionDocumento && cambiosPendientes.length > 0
  const docsCompletos = documentosIdentidadCompletos(comercio)

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
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-[#1A1A1A]/8 px-6 py-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{TITULO[accion]}</h2>
        </div>

        <div className="overflow-y-auto px-6 py-4">

        {requiereRevisionDocumento && (
          <div className="mt-4 rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/10 p-3 text-sm text-[#9B7300]">
            <p className="font-semibold">Revisión obligatoria del documento</p>
            <p className="mt-1 leading-relaxed">
              Antes de aprobar, abre Frente y Reverso. Deben corresponder al documento de identidad registrado,
              no a libreta militar, carnet, certificado, logo o documento de otra persona.
            </p>
            {!docsCompletos && (
              <p className="mt-2 font-semibold text-[#C0392B]">
                Falta frente o reverso del documento. No se puede aprobar.
              </p>
            )}
            <label className="mt-3 flex items-start gap-2 text-xs font-medium text-[#1A1A1A]/70">
              <input
                type="checkbox"
                checked={confirmoDocumento}
                disabled={!docsCompletos}
                onChange={(e) => setConfirmoDocumento(e.target.checked)}
                className="mt-0.5"
              />
              <span>Confirmo que revise ambos lados y corresponden al documento de identidad del comerciante.</span>
            </label>
          </div>
        )}

        {requiereRevisionCambios && (
          <div className="mt-4 rounded-xl border border-[#C0392B]/20 bg-[#C0392B]/8 p-3 text-sm text-[#8E2B1F]">
            <p className="font-semibold">Cambio crítico pendiente</p>
            <p className="mt-1 leading-relaxed">
              Este comercio cambió datos sensibles después de estar aprobado. Compara aquí el antes/después antes de aprobar.
            </p>
            <ResumenCambiosPendientes cambios={cambiosPendientes} comercio={comercio} />
            <label className="mt-3 flex items-start gap-2 text-xs font-medium text-[#1A1A1A]/70">
              <input
                type="checkbox"
                checked={confirmoCambios}
                onChange={(e) => setConfirmoCambios(e.target.checked)}
                className="mt-0.5"
              />
              <span>Confirmo que comparé los cambios críticos pendientes.</span>
            </label>
          </div>
        )}

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

        </div>

        <div className="flex justify-end gap-2 border-t border-[#1A1A1A]/8 px-6 py-4">
          <button
            onClick={onCerrar}
            className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(motivo)}
            disabled={(necesitaMotivo && !motivo.trim()) || (requiereRevisionDocumento && (!docsCompletos || !confirmoDocumento)) || (requiereRevisionCambios && !confirmoCambios)}
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

// ── Página principal ───────────────────────────────────────────

function CardComerciante({
  comercio,
  procesando,
  onAccion,
  onWhatsapp,
  onVerificadoEtnico,
  onComision,
  onRevisarDeclaracionTerritorial,
}: {
  comercio: AdminComercio
  procesando: boolean
  onAccion: (c: AdminComercio, a: 'APROBAR' | 'RECHAZAR' | 'SUSPENDER' | 'REHABILITAR') => void
  onWhatsapp: (c: AdminComercio) => void
  onVerificadoEtnico: (c: AdminComercio) => void
  onComision: (c: AdminComercio) => void
  onRevisarDeclaracionTerritorial: (c: AdminComercio, cambio: CambioCriticoComercio, accion: 'APROBAR' | 'RECHAZAR') => void
}) {
  const señales = señalesFraude(comercio)
  const tasaActual = comercio.comisiones[0] ? `${(Number(comercio.comisiones[0].tasa) * 100).toFixed(1)}%` : '10.0%'
  const docFrente = documentoFrenteUrl(comercio)
  const tieneCambios = Boolean(comercio.cambiosCriticos?.length)
  const cambiosPendientes = comercio.cambiosCriticos?.filter((c) => c.estado === 'PENDIENTE').length ?? 0

  return (
    <article className="overflow-hidden rounded-3xl border border-[#1A1A1A]/8 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.9fr_0.8fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-2">
            <h3 className="text-lg font-bold leading-tight text-[#1A1A1A]">{comercio.nombre}</h3>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${ESTADO_COLOR[comercio.estadoRegistro]}`}>
              {ESTADO_LABEL[comercio.estadoRegistro]}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#1A1A1A]/50">
            {comercio.municipio} · registro {fechaCorta(comercio.createdAt)}
          </p>
          {comercio.motivoRechazo && (
            <p className="mt-2 rounded-xl bg-[#F39C12]/10 px-3 py-2 text-xs font-medium text-[#9B7300]">
              {comercio.motivoRechazo}
            </p>
          )}
          {señales.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {señales.map((s) => (
                <span key={s} className="rounded-full bg-[#C0392B]/8 px-2.5 py-1 text-xs font-semibold text-[#C0392B]">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#F8F5F0] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">Propietario</p>
          <p className="mt-1 font-semibold text-[#1A1A1A]">{comercio.usuario.nombre}</p>
          <p className="text-sm text-[#1A1A1A]/55">{comercio.usuario.email}</p>
          {comercio.usuario.telefono && <p className="text-sm text-[#1A1A1A]/55">{comercio.usuario.telefono}</p>}
          {comercio.usuario.numeroDocumento && (
            <p className="text-sm text-[#1A1A1A]/55">
              {comercio.usuario.tipoDocumento} {comercio.usuario.numeroDocumento}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#F8F5F0] p-4 text-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">Productos</p>
            <p className="mt-1 text-lg font-bold text-[#1A1A1A]">{comercio._count.productos}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">Comisión</p>
            <button onClick={() => onComision(comercio)} disabled={procesando}
              className="mt-1 text-lg font-bold text-[#2D6A4F] hover:underline disabled:opacity-50">
              {tasaActual}
            </button>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">Documento</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {docFrente ? (
                <a href={docFrente} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#2D6A4F] underline">
                  Frente
                </a>
              ) : (
                <span className="text-[#C0392B]">Sin frente</span>
              )}
              {comercio.fotoDocumentoReversoUrl ? (
                <a href={comercio.fotoDocumentoReversoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#2D6A4F] underline">
                  Reverso
                </a>
              ) : (
                <span className="text-[#C0392B]">Sin reverso</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">WhatsApp</p>
            {comercio.whatsapp ? (
              <button
                onClick={() => onWhatsapp(comercio)}
                disabled={procesando}
                className={`mt-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  comercio.whatsappVisible
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {comercio.whatsappVisible ? 'Visible' : 'Oculto'}
              </button>
            ) : (
              <span className="mt-1 block text-[#1A1A1A]/35">Sin número</span>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A1A1A]/40">Sello étnico/territorial</p>
            <button
              onClick={() => onVerificadoEtnico(comercio)}
              disabled={procesando}
              className={`mt-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                comercio.verificadoEtnico
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {comercio.verificadoEtnico ? 'Otorgado' : 'No otorgado'}
            </button>
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-start justify-end gap-2 lg:w-32 lg:flex-col lg:items-stretch">
          {comercio.estadoRegistro === 'PENDIENTE_REVISION' && (
            <>
              <button onClick={() => onAccion(comercio, 'APROBAR')} disabled={procesando}
                className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-bold text-white hover:bg-[#235540] disabled:opacity-50">
                Aprobar
              </button>
              <button onClick={() => onAccion(comercio, 'RECHAZAR')} disabled={procesando}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                Rechazar
              </button>
            </>
          )}
          {comercio.estadoRegistro === 'APROBADO' && (
            <button onClick={() => onAccion(comercio, 'SUSPENDER')} disabled={procesando}
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-50">
              Suspender
            </button>
          )}
          {(comercio.estadoRegistro === 'RECHAZADO' || comercio.estadoRegistro === 'SUSPENDIDO') && (
            <button onClick={() => onAccion(comercio, 'REHABILITAR')} disabled={procesando}
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-bold text-white hover:bg-[#235540] disabled:opacity-50">
              Rehabilitar
            </button>
          )}
        </div>
      </div>

      <details className="border-t border-[#1A1A1A]/8 bg-[#FBF8F1]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-bold text-[#1A1A1A]">
          <span>
            Revisión sensible
            {cambiosPendientes > 0 && (
              <span className="ml-2 rounded-full bg-[#D4A017]/20 px-2 py-0.5 text-xs text-[#9B7300]">
                {cambiosPendientes} pendiente{cambiosPendientes > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <span className="text-xs text-[#1A1A1A]/45">
            {tieneCambios ? 'Abrir acordeón' : 'Sin cambios críticos'}
          </span>
        </summary>
        <div className="px-5 pb-5">
          {tieneCambios ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {(comercio.cambiosCriticos ?? []).map((cambio) => (
                <CambioCriticoCard
                  key={cambio.id}
                  cambio={cambio}
                  comercio={comercio}
                  compacta
                  procesando={procesando}
                  onRevisar={(c, accion) => onRevisarDeclaracionTerritorial(comercio, c, accion)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#1A1A1A]/10 bg-white px-4 py-5 text-sm text-[#1A1A1A]/45">
              Este comercio no tiene cambios críticos recientes.
            </p>
          )}
        </div>
      </details>
    </article>
  )
}

export default function ComerciantesAdminPage() {
  const [comercios, setComercios]   = useState<AdminComercio[]>([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filtro, setFiltro]         = useState<EstadoComerciante | 'TODOS'>('TODOS')
  const [busqueda, setBusqueda]     = useState('')
  const [filtroRevision, setFiltroRevision] = useState<FiltroRevision>('TODOS')
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

  async function handleVerificadoEtnico(comercio: AdminComercio) {
    setProcesandoId(comercio.id)
    try {
      const actualizado = await toggleVerificadoEtnicoAdmin(comercio.id)
      setComercios((prev) => prev.map((c) => c.id === comercio.id ? { ...c, verificadoEtnico: actualizado.verificadoEtnico } : c))
      setAviso({ tipo: 'exito', texto: `Sello étnico/territorial ${actualizado.verificadoEtnico ? 'otorgado a' : 'retirado de'} "${comercio.nombre}".` })
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

  async function handleRevisarDeclaracionTerritorial(
    comercio: AdminComercio,
    cambio: CambioCriticoComercio,
    accion: 'APROBAR' | 'RECHAZAR',
  ) {
    setProcesandoId(comercio.id)
    try {
      const actualizado = await revisarDeclaracionTerritorial(comercio.id, accion)
      setComercios((prev) => prev.map((c) => c.id === comercio.id ? { ...c, ...actualizado } : c))
      setAviso({
        tipo: 'exito',
        texto: accion === 'APROBAR'
          ? `Declaración territorial de "${comercio.nombre}" aprobada.`
          : `Declaración territorial de "${comercio.nombre}" rechazada.`,
      })
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' })
    } finally {
      setProcesandoId(null)
    }
  }

  const pendientes = comercios.filter((c) => c.estadoRegistro === 'PENDIENTE_REVISION').length
  const query = normalizarTexto(busqueda)
  const comerciosFiltrados = comercios.filter((comercio) => {
    const coincideTexto = !query || textoBusquedaComercio(comercio).includes(query)
    return coincideTexto && pasaFiltroRevision(comercio, filtroRevision)
  })
  const conCambios = comercios.filter(tieneCambiosCriticosPendientes).length
  const conSenales = comercios.filter((c) => señalesFraude(c).length > 0).length
  const sinDocumentos = comercios.filter((c) => !documentosIdentidadCompletos(c)).length
  const conteoFiltroRevision: Record<FiltroRevision, number> = {
    TODOS: comercios.length,
    CON_CAMBIOS: conCambios,
    CON_SENALES: conSenales,
    SIN_DOCUMENTOS: sinDocumentos,
  }

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

      {/* Búsqueda y filtros */}
      <section className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label htmlFor="buscar-comerciante" className="text-xs font-bold uppercase tracking-wide text-[#1A1A1A]/45">
              Buscar comerciante
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[#1A1A1A]/10 bg-[#F8F5F0] px-4 py-3">
              <span className="text-[#1A1A1A]/35" aria-hidden="true">⌕</span>
              <input
                id="buscar-comerciante"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Tienda, propietario, email, teléfono o documento"
                className="w-full bg-transparent text-sm font-medium text-[#1A1A1A] outline-none placeholder:text-[#1A1A1A]/35"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="rounded-full px-2 py-1 text-xs font-bold text-[#1A1A1A]/45 hover:bg-white"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="text-sm font-medium text-[#1A1A1A]/55">
            Mostrando <span className="font-bold text-[#1A1A1A]">{comerciosFiltrados.length}</span> de{' '}
            <span className="font-bold text-[#1A1A1A]">{comercios.length}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTROS.map(({ id, etiqueta }) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                filtro === id
                  ? 'bg-[#2D6A4F] text-white'
                  : 'border border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/65 hover:bg-[#F8F5F0]'
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {FILTROS_REVISION.map(({ id, etiqueta }) => (
            <button
              key={id}
              onClick={() => setFiltroRevision(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                filtroRevision === id
                  ? 'bg-[#D4A017] text-[#1A1A1A]'
                  : 'border border-[#1A1A1A]/10 bg-[#F8F5F0] text-[#1A1A1A]/55 hover:bg-white'
              }`}
            >
              {etiqueta}
              <span className="ml-1.5 rounded-full bg-white/70 px-1.5 text-[10px]">
                {conteoFiltroRevision[id]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Lista */}
      <section>
        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
            <p className="font-medium">{error}</p>
            <button onClick={cargar} className="mt-2 font-semibold underline">Reintentar</button>
          </div>
        ) : !cargando && comerciosFiltrados.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#1A1A1A]/10 bg-white px-5 py-12 text-center">
            <p className="font-semibold text-[#1A1A1A]">No hay comercios con estos filtros.</p>
            <p className="mt-1 text-sm text-[#1A1A1A]/45">Prueba limpiando la búsqueda o cambiando el filtro de revisión.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {cargando
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-3xl bg-white shadow-sm" />
                ))
              : comerciosFiltrados.map((comercio) => (
                  <CardComerciante
                    key={comercio.id}
                    comercio={comercio}
                    procesando={procesandoId === comercio.id}
                    onAccion={(c, a) => setModalAccion({ comercio: c, accion: a })}
                    onWhatsapp={handleWhatsapp}
                    onVerificadoEtnico={handleVerificadoEtnico}
                    onComision={(c) => setModalComision(c)}
                    onRevisarDeclaracionTerritorial={handleRevisarDeclaracionTerritorial}
                  />
                ))}
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
