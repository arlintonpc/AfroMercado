'use client'

import { useEffect, useState } from 'react'
import {
  ofertasEmpleoPendientesModeracion,
  moderarOfertaEmpleo,
  listarDenunciasEmpleoPendientes,
  resolverDenunciaEmpleo,
  type OfertaEmpleo,
  type DenunciaOfertaEmpleo,
  type MotivoDenunciaEmpleo,
} from '@/lib/api/empleo'
import { formatearPrecio } from '@/lib/formatearPrecio'

const MOTIVO_DENUNCIA_LABEL: Record<MotivoDenunciaEmpleo, string> = {
  OFERTA_FALSA: 'Oferta falsa',
  EXPLOTACION_LABORAL: 'Explotación laboral',
  DISCRIMINATORIA: 'Discriminatoria',
  ESTAFA_DINERO: 'Estafa / piden dinero',
  CONTENIDO_INAPROPIADO: 'Contenido inapropiado',
  OTRO: 'Otro motivo',
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function TarjetaModeracion({ oferta, onResuelta }: { oferta: OfertaEmpleo; onResuelta: (id: number) => void }) {
  const [motivo, setMotivo] = useState('')
  const [mostrarRechazo, setMostrarRechazo] = useState(false)
  const [procesando, setProcesando] = useState(false)

  async function resolver(accion: 'APROBAR' | 'RECHAZAR') {
    setProcesando(true)
    try {
      await moderarOfertaEmpleo(oferta.id, accion, accion === 'RECHAZAR' ? motivo : undefined)
      onResuelta(oferta.id)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#D4A017]/25 bg-[#D4A017]/8 p-5">
      <p className="font-semibold text-[#1A1A1A]">{oferta.titulo}</p>
      <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
        Por {oferta.publicadoPor?.nombre} · {oferta.municipio}
        {oferta.salarioMin && ` · desde ${formatearPrecio(Number(oferta.salarioMin))}`}
      </p>
      <p className="text-sm text-[#1A1A1A]/70 mt-2 whitespace-pre-wrap">{oferta.descripcion}</p>
      {oferta.requisitos && <p className="text-xs text-[#1A1A1A]/50 mt-1">Requisitos: {oferta.requisitos}</p>}

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
        <button onClick={() => resolver('APROBAR')} disabled={procesando} className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50">
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

function TarjetaDenuncia({ denuncia, onResuelta }: { denuncia: DenunciaOfertaEmpleo; onResuelta: (id: number) => void }) {
  const [motivo, setMotivo] = useState('')
  const [mostrarConfirmBloqueoCuenta, setMostrarConfirmBloqueoCuenta] = useState(false)
  const [procesando, setProcesando] = useState(false)

  const oferta = denuncia.oferta

  async function resolver(accion: 'DESESTIMAR' | 'BLOQUEAR_OFERTA' | 'BLOQUEAR_CUENTA') {
    setProcesando(true)
    try {
      await resolverDenunciaEmpleo(denuncia.id, { accion, motivo: motivo.trim() || undefined })
      onResuelta(denuncia.id)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
      <p className="font-semibold text-[#1A1A1A]">{oferta?.titulo ?? `Oferta #${denuncia.ofertaEmpleoId}`}</p>
      <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
        Publicada por {oferta?.publicadoPor?.nombre ?? 'Desconocido'} · Denunciada por {denuncia.denunciante?.nombre ?? 'Desconocido'}
      </p>
      <p className="text-xs font-bold text-red-700 mt-2">Motivo: {MOTIVO_DENUNCIA_LABEL[denuncia.motivo]}</p>
      {denuncia.descripcion && <p className="text-sm text-[#1A1A1A]/70 mt-1 whitespace-pre-wrap">{denuncia.descripcion}</p>}
      <p className="text-xs text-[#1A1A1A]/40 mt-2">Denunciada el {fmtFecha(denuncia.createdAt)}</p>

      {mostrarConfirmBloqueoCuenta && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-100/60 p-3">
          <p className="text-xs font-bold text-red-800 mb-2">
            Esta acción cerrará TODAS las ofertas activas de este usuario y bloqueará su cuenta por completo. Es una acción severa e irreversible desde esta pantalla.
          </p>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Motivo del bloqueo de cuenta"
            className="w-full resize-none rounded-lg border border-red-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => resolver('DESESTIMAR')} disabled={procesando} className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50">
          Desestimar
        </button>
        <button onClick={() => resolver('BLOQUEAR_OFERTA')} disabled={procesando} className="rounded-lg border border-[#D4A017]/40 bg-[#D4A017]/10 px-3 py-1.5 text-xs font-bold text-[#8a6710] hover:bg-[#D4A017]/20 disabled:opacity-50">
          Bloquear oferta
        </button>
        {!mostrarConfirmBloqueoCuenta ? (
          <button onClick={() => setMostrarConfirmBloqueoCuenta(true)} className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-200">
            Bloquear cuenta completa
          </button>
        ) : (
          <button onClick={() => resolver('BLOQUEAR_CUENTA')} disabled={procesando} className="rounded-lg border border-red-400 bg-red-200 px-3 py-1.5 text-xs font-bold text-red-900 hover:bg-red-300 disabled:opacity-50">
            Confirmar bloqueo de cuenta
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminEmpleoPage() {
  const [tab, setTab] = useState<'MODERACION' | 'DENUNCIAS'>('MODERACION')

  const [ofertas, setOfertas] = useState<OfertaEmpleo[]>([])
  const [cargandoOfertas, setCargandoOfertas] = useState(true)

  const [denuncias, setDenuncias] = useState<DenunciaOfertaEmpleo[]>([])
  const [cargandoDenuncias, setCargandoDenuncias] = useState(true)

  useEffect(() => {
    ofertasEmpleoPendientesModeracion().then(setOfertas).finally(() => setCargandoOfertas(false))
    listarDenunciasEmpleoPendientes().then(setDenuncias).finally(() => setCargandoDenuncias(false))
  }, [])

  function handleResueltaOferta(id: number) {
    setOfertas((prev) => prev.filter((o) => o.id !== id))
  }

  function handleResueltaDenuncia(id: number) {
    setDenuncias((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#1A1A1A]">Empleo</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">Moderación de ofertas y denuncias del módulo de empleo comunitario.</p>

      <div className="mt-5 flex gap-2 border-b border-[#1A1A1A]/8">
        <button
          onClick={() => setTab('MODERACION')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'MODERACION' ? 'border-[#2D6A4F] text-[#2D6A4F]' : 'border-transparent text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
          }`}
        >
          Moderación de empleo{ofertas.length > 0 ? ` (${ofertas.length})` : ''}
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
          <p className="text-sm text-[#1A1A1A]/55 mb-4">Ofertas de trabajo esperando revisión antes de quedar públicas.</p>
          {cargandoOfertas ? (
            <div className="flex flex-col gap-4">
              {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />)}
            </div>
          ) : ofertas.length === 0 ? (
            <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
              No hay ofertas pendientes de revisión.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {ofertas.map((o) => <TarjetaModeracion key={o.id} oferta={o} onResuelta={handleResueltaOferta} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-sm text-[#1A1A1A]/55 mb-4">Denuncias de usuarios sobre ofertas de empleo publicadas.</p>
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
