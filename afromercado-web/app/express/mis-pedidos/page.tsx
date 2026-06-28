'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { misPedidosExpress, type PedidoExpress } from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE:      '⏳ Pendiente',
  ACEPTADO:       '✅ Aceptado',
  EN_PREPARACION: '👨‍🍳 Preparando',
  LISTO:          '🔔 Listo',
  EN_CAMINO:      '🛵 En camino',
  ENTREGADO:      '🎉 Entregado',
  CANCELADO:      '❌ Cancelado',
  RECHAZADO:      '🚫 Rechazado',
}

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:      'bg-[#FFF3CD] text-[#856404]',
  ACEPTADO:       'bg-[#D1E7DD] text-[#0F5132]',
  EN_PREPARACION: 'bg-[#CCE5FF] text-[#004085]',
  LISTO:          'bg-[#D4EDDA] text-[#155724]',
  EN_CAMINO:      'bg-[#D1ECF1] text-[#0C5460]',
  ENTREGADO:      'bg-[#D4EDDA] text-[#155724]',
  CANCELADO:      'bg-[#F8D7DA] text-[#721C24]',
  RECHAZADO:      'bg-[#F8D7DA] text-[#721C24]',
}

export default function MisPedidosExpressPage() {
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoExpress[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (cargandoAuth) return
    if (!autenticado) { router.push('/login'); return }
    misPedidosExpress().then(data => { setPedidos(data); setCargando(false) })
  }, [autenticado, cargandoAuth, router])

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="animate-pulse text-[#2D6A4F]">Cargando pedidos...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/express" className="text-[#2D6A4F] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A] text-lg">Mis pedidos Express</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-3">
        {pedidos.length === 0 ? (
          <div className="text-center py-16 text-[#999]">
            <p className="text-4xl mb-3">🛵</p>
            <p className="font-medium">Aún no tienes pedidos Express</p>
            <Link href="/express" className="mt-4 inline-block text-[#2D6A4F] underline text-sm">Ver restaurantes</Link>
          </div>
        ) : (
          pedidos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[#1A1A1A]">
                    {p.configExpress?.comercio.nombre ?? `Pedido #${p.id}`}
                  </p>
                  <p className="text-xs text-[#999] mt-0.5">
                    {new Date(p.creadoAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${ESTADO_COLOR[p.estado] ?? 'bg-[#EEE] text-[#666]'}`}>
                  {ESTADO_LABEL[p.estado] ?? p.estado}
                </span>
              </div>

              <div className="mt-3 space-y-1">
                {p.items.map(i => (
                  <p key={i.id} className="text-sm text-[#444]">
                    {i.cantidad}× {i.producto?.nombre ?? `Producto #${i.productoId}`}
                  </p>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-[#F0EBE3] flex justify-between items-center">
                <span className="text-xs text-[#999]">
                  {p.modalidad === 'DOMICILIO' ? '🛵 Domicilio' : p.modalidad === 'MESA' ? '🪑 Mesa' : '🏪 Recoger'} · {p.metodoPago}
                </span>
                <span className="font-bold text-[#1A1A1A]">{formatearPrecio(p.total)}</span>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
