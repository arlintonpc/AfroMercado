'use client'

import { useEffect, useState } from 'react'
import {
  adminPendientesInmuebles,
  adminModerarInmueble,
  adminDenunciasInmuebles,
  adminResolverDenunciaInmueble,
  LABEL_TIPO_INMUEBLE,
  ICONO_TIPO_INMUEBLE,
  LABEL_TIPO_OPERACION_INMUEBLE,
  MOTIVOS_DENUNCIA_INMUEBLE,
  type Inmueble,
  type DenunciaInmueble,
  type MotivoDenunciaInmueble,
} from '@/lib/api/bienes-raices'
import { formatearPrecio } from '@/lib/formatearPrecio'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

const MOTIVO_DENUNCIA_LABEL: Record<MotivoDenunciaInmueble, string> =
  Object.fromEntries(MOTIVOS_DENUNCIA_INMUEBLE.map((m) => [m.value, m.label])) as Record<MotivoDenunciaInmueble, string>

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtUbicacion(inmueble: Inmueble): string {
  const partes = [inmueble.municipio, inmueble.departamento]
  if (inmueble.vereda) partes.unshift(inmueble.vereda)
  return partes.filter(Boolean).join(', ')
}

function TarjetaModeracion({ inmueble, onResuelta }: { inmueble: Inmueble; onResuelta: (id: number) => void }) {
  const [motivo, setMotivo] = useState('')
  const [mostrarRechazo, setMostrarRechazo] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  const tieneDocumento = !!inmueble.documentoSoporteUrl

  async function resolver(accion: 'APROBAR' | 'RECHAZAR') {
    setError('')
    setProcesando(true)
    try {
      await adminModerarInmueble(inmueble.id, { accion, motivo: accion === 'RECHAZAR' ? motivo : undefined })
      onResuelta(inmueble.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar la solicitud.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#D4A017]/25 bg-[#D4A017]/8 p-5">
      <div className="flex gap-4">
        {inmueble.fotoUrls?.[0] ? (
          <img
            src={inmueble.fotoUrls[0]}
            alt={inmueble.titulo}
            className="w-24 h-24 rounded-xl object-cover flex-shrink-0 border border-[#1A1A1A]/10"
          />
        ) : (
          <div className="w-24 h-24 rounded-xl flex-shrink-0 border border-[#1A1A1A]/10 bg-[#1A1A1A]/5 flex items-center justify-center text-2xl">
            {ICONO_TIPO_INMUEBLE[inmueble.tipoInmueble]}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#1A1A1A]">{inmueble.titulo}</p>
          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
            {ICONO_TIPO_INMUEBLE[inmueble.tipoInmueble]} {LABEL_TIPO_INMUEBLE[inmueble.tipoInmueble]} · {LABEL_TIPO_OPERACION_INMUEBLE[inmueble.tipoOperacion]} · {fmtUbicacion(inmueble)}
          </p>
          <p className="text-sm font-bold text-[#1B4332] mt-1">{formatearPrecio(Number(inmueble.precio))}</p>
          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
            {[
              inmueble.areaM2 != null ? `${inmueble.areaM2} m²` : null,
              inmueble.habitaciones != null ? `${inmueble.habitaciones} hab.` : null,
              inmueble.banos != null ? `${inmueble.banos} baños` : null,
            ].filter(Boolean).join(' · ')}
          </p>
          {inmueble.folioMatricula && (
            <p className="text-xs text-[#1A1A1A]/50 mt-0.5">Folio de matrícula: {inmueble.folioMatricula}</p>
          )}
        </div>
      </div>

      {inmueble.descripcion && (
        <p className="text-sm text-[#1A1A1A]/70 mt-3 whitespace-pre-wrap">{inmueble.descripcion}</p>
      )}

      <div className="mt-3 rounded-lg border border-[#1A1A1A]/10 bg-white/60 p-3 text-xs text-[#1A1A1A]/70">
        <p className="font-semibold text-[#1A1A1A]">Publicado por {inmueble.publicador?.nombre ?? 'Desconocido'}</p>
        {inmueble.publicador?.email && <p>{inmueble.publicador.email}</p>}
        {inmueble.publicador?.telefono && <p>{inmueble.publicador.telefono}</p>}
      </div>

      <div className="mt-3">
        {tieneDocumento ? (
          <a
            href={inmueble.documentoSoporteUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2D6A4F]/30 bg-[#2D6A4F]/10 px-3 py-1.5 text-xs font-bold text-[#2D6A4F] hover:bg-[#2D6A4F]/20"
          >
            📄 Ver documento de soporte
          </a>
        ) : (
          <p className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
            ⚠️ Sin documento de soporte — no se puede aprobar
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {mostrarRechazo && (
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Motivo del rechazo"
          className="mt-3 w-full resize-none rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
        />
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => resolver('APROBAR')}
          disabled={procesando || !tieneDocumento}
          title={!tieneDocumento ? 'No se puede aprobar sin documento de soporte' : undefined}
          className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Aprobar
        </button>
        {!mostrarRechazo ? (
          <button onClick={() => setMostrarRechazo(true)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">
            Rechazar
          </button>
        ) : (
          <button onClick={() => resolver('RECHAZAR')} disabled={procesando || !motivo.trim()} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
            Confirmar rechazo
          </button>
        )}
      </div>
    </div>
  )
}

function TarjetaDenuncia({ denuncia, onResuelta }: { denuncia: DenunciaInmueble; onResuelta: (id: number) => void }) {
  const [notaRevision, setNotaRevision] = useState('')
  const [mostrarConfirmBloqueoCuenta, setMostrarConfirmBloqueoCuenta] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  const inmueble = denuncia.inmueble

  async function resolver(accion: 'DESESTIMAR' | 'BLOQUEAR_PUBLICACION' | 'BLOQUEAR_CUENTA') {
    setError('')
    setProcesando(true)
    try {
      await adminResolverDenunciaInmueble(denuncia.id, { accion, notaRevision: notaRevision.trim() || undefined })
      onResuelta(denuncia.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar la solicitud.')
      setProcesando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
      <p className="font-semibold text-[#1A1A1A]">{inmueble?.titulo ?? `Inmueble #${denuncia.inmuebleId}`}</p>
      <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
        Denunciada por {denuncia.denunciante?.nombre ?? 'Desconocido'}
      </p>
      <p className="text-xs font-bold text-red-700 mt-2">Motivo: {MOTIVO_DENUNCIA_LABEL[denuncia.motivo]}</p>
      {denuncia.descripcion && <p className="text-sm text-[#1A1A1A]/70 mt-1 whitespace-pre-wrap">{denuncia.descripcion}</p>}
      <p className="text-xs text-[#1A1A1A]/40 mt-2">Denunciada el {fmtFecha(denuncia.createdAt)}</p>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <textarea
        value={notaRevision}
        onChange={(e) => setNotaRevision(e.target.value)}
        rows={2}
        placeholder="Nota de revisión (opcional)"
        className="mt-3 w-full resize-none rounded-lg border border-red-200 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => resolver('DESESTIMAR')} disabled={procesando} className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50">
          Desestimar
        </button>
        <button onClick={() => resolver('BLOQUEAR_PUBLICACION')} disabled={procesando} className="rounded-lg border border-[#D4A017]/40 bg-[#D4A017]/10 px-3 py-1.5 text-xs font-bold text-[#8a6710] hover:bg-[#D4A017]/20 disabled:opacity-50">
          Bloquear publicación
        </button>
        <button
          onClick={() => setMostrarConfirmBloqueoCuenta(true)}
          disabled={procesando}
          className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-200 disabled:opacity-50"
        >
          Bloquear cuenta completa
        </button>
      </div>

      {mostrarConfirmBloqueoCuenta && (
        <ModalConfirmacion
          titulo="Bloquear cuenta completa"
          mensaje="Esta acción bloqueará por completo la cuenta del publicador y cerrará todas sus publicaciones activas del módulo de Bienes Raíces. Es una acción severa e irreversible desde esta pantalla."
          confirmando={procesando}
          destructivo
          textoConfirmar="Bloquear cuenta"
          textoConfirmando="Bloqueando…"
          onCancelar={() => setMostrarConfirmBloqueoCuenta(false)}
          onConfirmar={() => resolver('BLOQUEAR_CUENTA')}
        />
      )}
    </div>
  )
}

export default function AdminInmueblesPage() {
  const [tab, setTab] = useState<'MODERACION' | 'DENUNCIAS'>('MODERACION')

  const [inmuebles, setInmuebles] = useState<Inmueble[]>([])
  const [cargandoInmuebles, setCargandoInmuebles] = useState(true)

  const [denuncias, setDenuncias] = useState<DenunciaInmueble[]>([])
  const [cargandoDenuncias, setCargandoDenuncias] = useState(true)

  useEffect(() => {
    adminPendientesInmuebles().then(setInmuebles).finally(() => setCargandoInmuebles(false))
    adminDenunciasInmuebles().then(setDenuncias).finally(() => setCargandoDenuncias(false))
  }, [])

  function handleResueltaInmueble(id: number) {
    setInmuebles((prev) => prev.filter((i) => i.id !== id))
  }

  function handleResueltaDenuncia(id: number) {
    setDenuncias((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#1A1A1A]">🏘️ Bienes Raíces</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">Verificación de publicaciones y denuncias del módulo de Bienes Raíces.</p>

      <div className="mt-5 flex gap-2 border-b border-[#1A1A1A]/8">
        <button
          onClick={() => setTab('MODERACION')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'MODERACION' ? 'border-[#2D6A4F] text-[#2D6A4F]' : 'border-transparent text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
          }`}
        >
          Pendientes de verificación{inmuebles.length > 0 ? ` (${inmuebles.length})` : ''}
        </button>
        <button
          onClick={() => setTab('DENUNCIAS')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'DENUNCIAS' ? 'border-[#2D6A4F] text-[#2D6A4F]' : 'border-transparent text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
          }`}
        >
          Denuncias{denuncias.length > 0 ? ` (${denuncias.length})` : ''}
        </button>
      </div>

      {tab === 'MODERACION' ? (
        <div className="mt-6">
          <p className="text-sm text-[#1A1A1A]/55 mb-4">
            Publicaciones esperando verificación antes de quedar públicas. Solo se pueden aprobar si tienen documento de soporte cargado.
          </p>
          {cargandoInmuebles ? (
            <div className="flex flex-col gap-4">
              {[1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />)}
            </div>
          ) : inmuebles.length === 0 ? (
            <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
              No hay publicaciones pendientes de verificación.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {inmuebles.map((i) => <TarjetaModeracion key={i.id} inmueble={i} onResuelta={handleResueltaInmueble} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-sm text-[#1A1A1A]/55 mb-4">Denuncias de usuarios sobre publicaciones de Bienes Raíces.</p>
          {cargandoDenuncias ? (
            <div className="flex flex-col gap-4">
              {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />)}
            </div>
          ) : denuncias.length === 0 ? (
            <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
              No hay denuncias pendientes de revisión.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {denuncias.map((d) => <TarjetaDenuncia key={d.id} denuncia={d} onResuelta={handleResueltaDenuncia} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
