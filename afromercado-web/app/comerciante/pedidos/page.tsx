'use client'

import { useEffect, useState } from 'react'
import { listarMisPedidos, avanzarEstadoPedido, type MiSubPedido } from '@/components/comerciante/api'

type Pestana = 'CONFIRMADO' | 'EN_PREPARACION' | 'LISTO' | 'HISTORIAL'

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'CONFIRMADO', etiqueta: 'Por preparar' },
  { id: 'EN_PREPARACION', etiqueta: 'En preparación' },
  { id: 'LISTO', etiqueta: 'Listos' },
  { id: 'HISTORIAL', etiqueta: 'Historial' },
]

const ETIQUETA_ESTADO: Record<string, string> = {
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}

const COLOR_ESTADO: Record<string, string> = {
  CONFIRMADO: 'bg-[#D4A017]/15 text-[#A07810]',
  EN_PREPARACION: 'bg-blue-100 text-blue-700',
  LISTO: 'bg-[#2D6A4F]/15 text-[#2D6A4F]',
  EN_CAMINO: 'bg-purple-100 text-purple-700',
  ENTREGADO: 'bg-[#1A1A1A]/10 text-[#1A1A1A]/60',
  CANCELADO: 'bg-red-100 text-red-600',
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function cop(v: number) {
  return `$${Number(v).toLocaleString('es-CO')} COP`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg
        className="animate-spin text-[#2D6A4F]"
        width="36"
        height="36"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function TarjetaPedido({
  sp,
  avanzando,
  onAvanzar,
}: {
  sp: MiSubPedido
  avanzando: boolean
  onAvanzar: (sp: MiSubPedido) => void
}) {
  const puedeAvanzar = sp.estado === 'CONFIRMADO' || sp.estado === 'EN_PREPARACION'
  const etiquetaBoton =
    sp.estado === 'CONFIRMADO' ? 'Empezar preparación' : 'Marcar como listo'
  const colorBoton =
    sp.estado === 'CONFIRMADO'
      ? 'bg-[#2D6A4F] hover:bg-[#24573f] text-white'
      : 'bg-[#D4A017] hover:bg-[#b88a12] text-white'

  return (
    <div className="rounded-xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-[#1A1A1A]">
            Pedido #{sp.pedido.id}
          </p>
          <p className="mt-0.5 text-sm text-[#1A1A1A]/50">
            {formatearFecha(sp.pedido.createdAt)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${COLOR_ESTADO[sp.estado] ?? 'bg-[#1A1A1A]/10 text-[#1A1A1A]/60'}`}
        >
          {ETIQUETA_ESTADO[sp.estado] ?? sp.estado}
        </span>
      </div>

      <ul className="mb-3 space-y-1">
        {sp.items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm text-[#1A1A1A]/80">
            <span className="min-w-[2rem] rounded bg-[#2D6A4F]/10 px-1.5 py-0.5 text-center text-xs font-bold text-[#2D6A4F]">
              {item.cantidad}x
            </span>
            <span>{item.producto.nombre}</span>
          </li>
        ))}
      </ul>

      <div className="mb-3 space-y-1 border-t border-[#1A1A1A]/8 pt-3 text-sm">
        <p className="text-[#1A1A1A]/70">
          <span className="font-medium text-[#1A1A1A]">Comprador: </span>
          {sp.pedido.comprador.nombre}
          {sp.pedido.comprador.telefono && (
            <span className="ml-1 text-[#1A1A1A]/50">· {sp.pedido.comprador.telefono}</span>
          )}
        </p>
        <p className="text-[#1A1A1A]/70">
          <span className="font-medium text-[#1A1A1A]">Dirección: </span>
          {sp.pedido.direccionTexto}
        </p>
        {sp.pedido.notas && (
          <p className="text-[#1A1A1A]/70">
            <span className="font-medium text-[#1A1A1A]">Notas: </span>
            {sp.pedido.notas}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-bold text-[#2D6A4F]">{cop(sp.neto)}</p>
        {puedeAvanzar && (
          <button
            type="button"
            disabled={avanzando}
            onClick={() => onAvanzar(sp)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${colorBoton}`}
          >
            {avanzando ? 'Actualizando…' : etiquetaBoton}
          </button>
        )}
      </div>
    </div>
  )
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<MiSubPedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pestana, setPestana] = useState<Pestana>('CONFIRMADO')
  const [avanzando, setAvanzando] = useState<number | null>(null)

  useEffect(() => {
    listarMisPedidos()
      .then(setPedidos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar pedidos'))
      .finally(() => setCargando(false))
  }, [])

  async function handleAvanzar(sp: MiSubPedido) {
    setAvanzando(sp.id)
    try {
      const actualizado = await avanzarEstadoPedido(sp.id)
      setPedidos((prev) =>
        prev.map((p) => (p.id === sp.id ? { ...p, estado: actualizado.estado } : p))
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al actualizar el pedido')
    } finally {
      setAvanzando(null)
    }
  }

  const filtrados = pedidos.filter((sp) =>
    pestana === 'HISTORIAL'
      ? ['ENTREGADO', 'CANCELADO', 'EN_CAMINO'].includes(sp.estado)
      : sp.estado === pestana
  )

  const conteos: Record<Pestana, number> = {
    CONFIRMADO: pedidos.filter((p) => p.estado === 'CONFIRMADO').length,
    EN_PREPARACION: pedidos.filter((p) => p.estado === 'EN_PREPARACION').length,
    LISTO: pedidos.filter((p) => p.estado === 'LISTO').length,
    HISTORIAL: pedidos.filter((p) =>
      ['ENTREGADO', 'CANCELADO', 'EN_CAMINO'].includes(p.estado)
    ).length,
  }

  return (
    <div>
      <h1
        className="mb-6 text-2xl font-bold text-[#1A1A1A]"
        style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
      >
        Mis pedidos
      </h1>

      {/* Pestañas */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-[#1A1A1A]/10">
        {PESTANAS.map((p) => {
          const activa = pestana === p.id
          const cuenta = conteos[p.id]
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              className={`relative flex items-center gap-1.5 px-4 pb-3 pt-2 text-sm font-semibold transition-colors ${
                activa
                  ? 'text-[#2D6A4F] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#2D6A4F]'
                  : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80'
              }`}
            >
              {p.etiqueta}
              {cuenta > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
                    activa ? 'bg-[#2D6A4F] text-white' : 'bg-[#1A1A1A]/10 text-[#1A1A1A]/60'
                  }`}
                >
                  {cuenta}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      {cargando ? (
        <Spinner />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-[#1A1A1A]/8 bg-white p-12 text-center">
          <p className="text-[#1A1A1A]/40">
            {pestana === 'CONFIRMADO' && 'No hay pedidos por preparar.'}
            {pestana === 'EN_PREPARACION' && 'No tienes pedidos en preparación.'}
            {pestana === 'LISTO' && 'No hay pedidos listos para recoger.'}
            {pestana === 'HISTORIAL' && 'El historial está vacío.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtrados.map((sp) => (
            <TarjetaPedido
              key={sp.id}
              sp={sp}
              avanzando={avanzando === sp.id}
              onAvanzar={handleAvanzar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
