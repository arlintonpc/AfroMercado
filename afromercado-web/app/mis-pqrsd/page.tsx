'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { misPqrsd, type Pqrsd, type EstadoPqrsd, type TipoPqrsd } from '@/lib/api/pqrsd'

const TIPO_LABEL: Record<TipoPqrsd, string> = {
  PETICION: 'Petición',
  QUEJA: 'Queja',
  RECLAMO: 'Reclamo',
  SUGERENCIA: 'Sugerencia',
  DENUNCIA: 'Denuncia',
}

const ESTADO_INFO: Record<EstadoPqrsd, { label: string; color: string }> = {
  ABIERTO: { label: 'Abierto', color: 'bg-amber-100 text-amber-700' },
  EN_PROCESO: { label: 'En proceso', color: 'bg-blue-100 text-blue-700' },
  RESPONDIDO: { label: 'Respondido', color: 'bg-green-100 text-green-700' },
  CERRADO: { label: 'Cerrado', color: 'bg-gray-100 text-gray-600' },
}

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TarjetaPqrsd({ ticket }: { ticket: Pqrsd }) {
  const info = ESTADO_INFO[ticket.estado]
  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-[#1A1A1A]/40 font-semibold uppercase tracking-wide">{TIPO_LABEL[ticket.tipo]}</p>
          <p className="text-sm font-semibold text-[#1A1A1A] mt-0.5">{ticket.asunto}</p>
          <p className="text-sm text-[#1A1A1A]/55 mt-0.5">{fechaLegible(ticket.createdAt)}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${info.color}`}>{info.label}</span>
      </div>
      <p className="text-sm text-[#1A1A1A]/65 mt-2 whitespace-pre-wrap">{ticket.mensaje}</p>
      {ticket.respuesta && (
        <div className="mt-3 rounded-xl bg-[#F8F5F0] border border-[#1A1A1A]/8 px-3 py-2.5">
          <p className="text-xs font-semibold text-[#1A1A1A]/50 mb-1">Respuesta</p>
          <p className="text-sm text-[#1A1A1A]/70 whitespace-pre-wrap">{ticket.respuesta}</p>
        </div>
      )}
    </div>
  )
}

export default function PaginaMisPqrsd() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [tickets, setTickets] = useState<Pqrsd[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/mis-pqrsd')
    }
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    misPqrsd()
      .then(setTickets)
      .catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar tus mensajes.'))
      .finally(() => setCargando(false))
  }, [autenticado, cargandoAuth])

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        <h1 className="text-3xl text-[#1A1A1A] mb-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Mis mensajes
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-7">Sigue el estado de tus peticiones, quejas o sugerencias.</p>

        {error && (
          <div className="rounded-xl border border-[#C0392B]/20 bg-[#C0392B]/5 px-4 py-3 text-sm text-[#C0392B] mb-6">{error}</div>
        )}

        {cargando || cargandoAuth ? (
          <div className="flex flex-col gap-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
                <Skeleton className="h-3 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState titulo="No tienes mensajes registrados" descripcion="Escríbenos desde la página de Contacto si necesitas ayuda." />
        ) : (
          <div className="flex flex-col gap-4">
            {tickets.map(t => <TarjetaPqrsd key={t.id} ticket={t} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
