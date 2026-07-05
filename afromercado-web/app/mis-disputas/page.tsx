'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import { misDisputas, type Disputa, type EstadoDisputa, type ModuloOrigenDisputa, type MotivoDisputa } from '@/lib/api/disputas'

// ── Etiquetas legibles ────────────────────────────────────────

const MODULO_LABEL: Record<ModuloOrigenDisputa, string> = {
  PEDIDO: 'Pedido de tienda',
  EXPRESS: 'Pedido Express',
  HOTEL: 'Reserva de hotel',
  TOUR: 'Reserva de tour',
  TRANSPORTE: 'Reserva de transporte',
}

const MOTIVO_LABEL: Record<MotivoDisputa, string> = {
  PRODUCTO_NO_LLEGO: 'El producto no llegó',
  PRODUCTO_DEFECTUOSO_O_DANADO: 'Llegó defectuoso o dañado',
  PRODUCTO_INCOMPLETO: 'Llegó incompleto',
  PRODUCTO_DIFERENTE_AL_PEDIDO: 'Es diferente a lo pedido',
  CALIDAD_NO_CONFORME: 'Calidad no conforme',
  SERVICIO_NO_PRESTADO: 'Servicio no prestado',
  COBRO_INCORRECTO: 'Cobro incorrecto',
  OTRO: 'Otro motivo',
}

const ESTADO_INFO: Record<EstadoDisputa, { label: string; color: string }> = {
  ABIERTA: { label: 'Esperando respuesta del comercio', color: 'bg-amber-100 text-amber-700' },
  RESPONDIDA_COMERCIO: { label: 'Respondida, en revisión', color: 'bg-blue-100 text-blue-700' },
  RESUELTA_RECHAZADA: { label: 'Rechazada', color: 'bg-red-100 text-red-600' },
  RESUELTA_REEMBOLSO_TOTAL: { label: 'Reembolso total aprobado', color: 'bg-green-100 text-green-700' },
  RESUELTA_REEMBOLSO_PARCIAL: { label: 'Reembolso parcial aprobado', color: 'bg-green-100 text-green-700' },
  CERRADA_SIN_RESPUESTA: { label: 'Cerrada sin respuesta', color: 'bg-gray-100 text-gray-600' },
}

function fechaLegible(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Tarjeta de disputa ─────────────────────────────────────────

function TarjetaDisputa({ disputa }: { disputa: Disputa }) {
  const info = ESTADO_INFO[disputa.estado] ?? { label: disputa.estado, color: 'bg-gray-100 text-gray-600' }
  const tieneResolucion = disputa.estado.startsWith('RESUELTA_')
  const montoAprobado = disputa.montoReembolsoAprobado != null ? Number(disputa.montoReembolsoAprobado) : null

  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-[#1A1A1A]/40 font-semibold uppercase tracking-wide">
            {MODULO_LABEL[disputa.moduloOrigen] ?? disputa.moduloOrigen} · #{disputa.referenciaId}
          </p>
          <p className="text-sm text-[#1A1A1A]/55 mt-0.5">{fechaLegible(disputa.createdAt)}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${info.color}`}>
          {info.label}
        </span>
      </div>

      <p className="text-sm font-semibold text-[#1A1A1A] mt-3">
        {MOTIVO_LABEL[disputa.motivo] ?? disputa.motivo}
      </p>
      {disputa.comercio?.nombre && (
        <p className="text-xs text-[#1A1A1A]/45 mt-0.5">{disputa.comercio.nombre}</p>
      )}
      <p className="text-sm text-[#1A1A1A]/65 mt-2 whitespace-pre-wrap">{disputa.descripcion}</p>

      {disputa.respuestaComercio && (
        <div className="mt-3 rounded-xl bg-[#F8F5F0] border border-[#1A1A1A]/8 px-3 py-2.5">
          <p className="text-xs font-semibold text-[#1A1A1A]/50 mb-1">Respuesta del comercio</p>
          <p className="text-sm text-[#1A1A1A]/70 whitespace-pre-wrap">{disputa.respuestaComercio}</p>
        </div>
      )}

      {tieneResolucion && (
        <div className={`mt-3 rounded-xl px-3 py-2.5 border ${
          disputa.estado === 'RESUELTA_RECHAZADA'
            ? 'bg-red-50 border-red-100'
            : 'bg-[#52B788]/10 border-[#52B788]/25'
        }`}>
          <p className={`text-xs font-semibold mb-1 ${
            disputa.estado === 'RESUELTA_RECHAZADA' ? 'text-red-700' : 'text-[#2D6A4F]'
          }`}>
            Resolución
          </p>
          {disputa.resolucion && (
            <p className="text-sm text-[#1A1A1A]/70 whitespace-pre-wrap mb-1">{disputa.resolucion}</p>
          )}
          {montoAprobado != null && (
            <p className="text-sm font-bold text-[#2D6A4F]">
              Reembolso aprobado: {formatearPrecio(montoAprobado)}
            </p>
          )}
          {montoAprobado != null && !disputa.reembolsoTransferidoAt && (
            <p className="text-xs text-[#1A1A1A]/45 mt-1">La devolución está en proceso.</p>
          )}
          {montoAprobado != null && disputa.reembolsoTransferidoAt && (
            <p className="text-xs text-[#2D6A4F] mt-1">
              Transferido el {fechaLegible(disputa.reembolsoTransferidoAt)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TarjetaSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
      <Skeleton className="h-3 w-32 mb-2" />
      <Skeleton className="h-4 w-24 mb-4" />
      <Skeleton className="h-3 w-52 mb-1" />
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function PaginaMisDisputas() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [disputas, setDisputas] = useState<Disputa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/mis-disputas')
    }
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const data = await misDisputas()
        if (!cancelado) setDisputas(data)
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No pudimos cargar tus reclamos.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [autenticado, cargandoAuth])

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        <h1
          className="text-3xl text-[#1A1A1A] mb-1"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Mis reclamos
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-7">
          Sigue el estado de los problemas que has reportado sobre tus compras.
        </p>

        {error && (
          <div className="rounded-xl border border-[#C0392B]/20 bg-[#C0392B]/5 px-4 py-3 text-sm text-[#C0392B] mb-6">
            {error}
          </div>
        )}

        {cargando || cargandoAuth ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <TarjetaSkeleton key={i} />)}
          </div>
        ) : disputas.length === 0 ? (
          <EmptyState
            titulo="No tienes reclamos registrados"
            descripcion="Si algo sale mal con una compra ya entregada, puedes reportarlo desde el historial correspondiente."
          >
            <Link href="/mis-pedidos" className="mt-2">
              <Button>Ver mis pedidos</Button>
            </Link>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {disputas.map(d => <TarjetaDisputa key={d.id} disputa={d} />)}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
