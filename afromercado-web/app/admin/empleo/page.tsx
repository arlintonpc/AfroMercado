'use client'

import { useEffect, useState } from 'react'
import { ofertasEmpleoPendientesModeracion, moderarOfertaEmpleo, type OfertaEmpleo } from '@/lib/api/empleo'
import { formatearPrecio } from '@/lib/formatearPrecio'

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

export default function AdminEmpleoPage() {
  const [ofertas, setOfertas] = useState<OfertaEmpleo[]>([]);
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    ofertasEmpleoPendientesModeracion().then(setOfertas).finally(() => setCargando(false))
  }, [])

  function handleResuelta(id: number) {
    setOfertas((prev) => prev.filter((o) => o.id !== id))
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#1A1A1A]">Moderación de empleo</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">Ofertas de trabajo esperando revisión antes de quedar públicas.</p>

      <div className="mt-6">
        {cargando ? (
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />)}
          </div>
        ) : ofertas.length === 0 ? (
          <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
            No hay ofertas pendientes de revisión.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {ofertas.map((o) => <TarjetaModeracion key={o.id} oferta={o} onResuelta={handleResuelta} />)}
          </div>
        )}
      </div>
    </div>
  )
}
