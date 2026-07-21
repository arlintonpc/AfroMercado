'use client'

import { useEffect, useState } from 'react'
import {
  listarDenunciasPublicacionPendientes,
  resolverDenunciaPublicacion,
  type DenunciaPublicacionCultural,
  type MotivoDenunciaPublicacion,
} from '@/lib/api/cultura'

const MOTIVO_DENUNCIA_LABEL: Record<MotivoDenunciaPublicacion, string> = {
  CONTENIDO_INAPROPIADO: 'Contenido inapropiado',
  SPAM: 'Spam o publicidad',
  DERECHOS_DE_AUTOR: 'Derechos de autor',
  NO_RELACIONADO: 'No relacionado con cultura o turismo',
  OTRO: 'Otro motivo',
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function TarjetaDenunciaPublicacion({ denuncia, onResuelta }: { denuncia: DenunciaPublicacionCultural; onResuelta: (id: number) => void }) {
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)

  const publicacion = denuncia.publicacion

  async function resolver(accion: 'DESESTIMAR' | 'OCULTAR') {
    setProcesando(true)
    try {
      await resolverDenunciaPublicacion(denuncia.id, { accion, motivo: motivo.trim() || undefined })
      onResuelta(denuncia.id)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
      <p className="font-semibold text-[#1A1A1A]">{publicacion?.titulo ?? `Publicación #${denuncia.publicacionCulturalId}`}</p>
      {publicacion?.comercio && (
        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#D4A017]/12 px-2.5 py-1 text-xs font-semibold text-[#8A5A00]">
          🏪 Comercio: {publicacion.comercio.nombre}
        </p>
      )}
      <p className="text-xs text-[#1A1A1A]/50 mt-1">
        {publicacion?.comercio ? 'Publicada por el comercio' : `Publicada por ${publicacion?.autor?.nombre ?? 'Desconocido'}`} · Denunciada por {denuncia.denunciante?.nombre ?? 'Desconocido'}
      </p>
      <p className="text-xs font-bold text-red-700 mt-2">Motivo: {MOTIVO_DENUNCIA_LABEL[denuncia.motivo]}</p>
      {denuncia.descripcion && <p className="text-sm text-[#1A1A1A]/70 mt-1 whitespace-pre-wrap">{denuncia.descripcion}</p>}
      <p className="text-xs text-[#1A1A1A]/40 mt-2">Denunciada el {fmtFecha(denuncia.createdAt)}</p>

      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
        placeholder="Nota de revisión (opcional)"
        className="mt-3 w-full resize-none rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => resolver('DESESTIMAR')} disabled={procesando} className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50">
          Desestimar
        </button>
        <button onClick={() => resolver('OCULTAR')} disabled={procesando} className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-200 disabled:opacity-50">
          Ocultar publicación
        </button>
      </div>
    </div>
  )
}

export default function AdminCulturaPage() {
  const [denuncias, setDenuncias] = useState<DenunciaPublicacionCultural[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    listarDenunciasPublicacionPendientes().then(setDenuncias).finally(() => setCargando(false))
  }, [])

  function handleResuelta(id: number) {
    setDenuncias((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#1A1A1A]">Cultura</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">
        Denuncias de publicaciones de &quot;Comparte tu Territorio&quot; (fotos, videos e historias compartidas por la comunidad).
      </p>

      <div className="mt-6">
        {cargando ? (
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />)}
          </div>
        ) : denuncias.length === 0 ? (
          <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
            No hay denuncias pendientes de revisión.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {denuncias.map((d) => <TarjetaDenunciaPublicacion key={d.id} denuncia={d} onResuelta={handleResuelta} />)}
          </div>
        )}
      </div>
    </div>
  )
}
