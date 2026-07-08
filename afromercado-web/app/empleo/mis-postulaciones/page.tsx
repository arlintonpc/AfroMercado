'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ModalConfirmarRetiro from '@/components/empleo/ModalConfirmarRetiro'
import { useAuth } from '@/context/AuthContext'
import { misPostulacionesEmpleo, retirarPostulacionEmpleo, type PostulacionEmpleo, type EstadoPostulacionEmpleo } from '@/lib/api/empleo'

const ESTADO_INFO: Record<EstadoPostulacionEmpleo, { label: string; color: string }> = {
  ENVIADA: { label: 'Enviada', color: 'bg-amber-100 text-amber-700' },
  VISTA: { label: 'Vista por el empleador', color: 'bg-blue-100 text-blue-700' },
  PRESELECCIONADO: { label: 'Preseleccionado', color: 'bg-[#52B788]/15 text-[#2D6A4F]' },
  RECHAZADA: { label: 'No seleccionado', color: 'bg-red-100 text-red-600' },
  CONTRATADO: { label: '¡Contratado!', color: 'bg-[#D4A017]/20 text-[#9B7300]' },
  RETIRADA: { label: 'Retirada', color: 'bg-[#1A1A1A]/8 text-[#1A1A1A]/50' },
}

const RETIRABLE: EstadoPostulacionEmpleo[] = ['ENVIADA', 'VISTA', 'PRESELECCIONADO']

export default function PaginaMisPostulacionesEmpleo() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [postulaciones, setPostulaciones] = useState<PostulacionEmpleo[]>([])
  const [cargando, setCargando] = useState(true)
  const [retirandoId, setRetirandoId] = useState<number | null>(null)
  const [idParaRetirar, setIdParaRetirar] = useState<number | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/empleo/mis-postulaciones')
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    misPostulacionesEmpleo().then(setPostulaciones).finally(() => setCargando(false))
  }, [autenticado, cargandoAuth])

  async function retirar(id: number) {
    setRetirandoId(id)
    try {
      const actualizada = await retirarPostulacionEmpleo(id)
      setPostulaciones((prev) => prev.map((p) => (p.id === id ? actualizada : p)))
    } finally {
      setRetirandoId(null)
      setIdParaRetirar(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        <h1 className="text-3xl text-[#1A1A1A] mb-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Mis postulaciones
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-6">Sigue el estado de las ofertas a las que te postulaste.</p>

        {cargando || cargandoAuth ? (
          <div className="h-32 rounded-2xl bg-white border border-[#1A1A1A]/8 animate-pulse" />
        ) : postulaciones.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-[#1A1A1A]/55 mb-4">Todavía no te has postulado a ninguna oferta.</p>
            <Link href="/empleo" className="inline-block rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors">
              Explorar ofertas
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {postulaciones.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <Link href={`/empleo/${p.oferta?.id}`} className="font-semibold text-[#1A1A1A] hover:text-[#2D6A4F]">
                    {p.oferta?.titulo}
                  </Link>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO_INFO[p.estado].color}`}>
                    {ESTADO_INFO[p.estado].label}
                  </span>
                </div>
                <p className="text-xs text-[#1A1A1A]/50 mt-0.5">📍 {p.oferta?.municipio}</p>
                {p.notasPublicador && (
                  <p className="text-sm text-[#1A1A1A]/65 mt-2">Nota del empleador: {p.notasPublicador}</p>
                )}
                {RETIRABLE.includes(p.estado) && (
                  <button
                    type="button"
                    onClick={() => setIdParaRetirar(p.id)}
                    disabled={retirandoId === p.id}
                    className="mt-3 rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]/60 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                  >
                    {retirandoId === p.id ? 'Retirando…' : 'Retirar postulación'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
      {idParaRetirar !== null && (
        <ModalConfirmarRetiro
          confirmando={retirandoId === idParaRetirar}
          onCancelar={() => setIdParaRetirar(null)}
          onConfirmar={() => retirar(idParaRetirar)}
        />
      )}
    </div>
  )
}
