'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  facturasAdmin,
  anularFacturaAdmin,
  reintentarFacturaAdmin,
  type FacturaElectronica,
  type EstadoFactura,
  type ModuloOrigenFactura,
} from '@/lib/api/facturacion'
import { formatearPrecio } from '@/lib/formatearPrecio'

const MODULO_LABEL: Record<ModuloOrigenFactura, string> = {
  PEDIDO: 'Pedido de tienda',
  EXPRESS: 'Pedido Express',
  HOTEL: 'Reserva de hotel',
  TOUR: 'Reserva de tour',
  TRANSPORTE: 'Reserva de transporte',
  CULTURA: 'Reserva cultural',
}

const ESTADO_LABEL: Record<EstadoFactura, string> = {
  PENDIENTE: 'Pendiente',
  ENVIADA: 'Enviada al proveedor',
  ACEPTADA: 'Aceptada (DIAN)',
  RECHAZADA: 'Rechazada',
  ERROR: 'Error — en reintento',
  ANULADA: 'Anulada',
  OMITIDA: 'Sin factura fiscal (solo comprobante interno)',
}

const ESTADO_COLOR: Record<EstadoFactura, string> = {
  PENDIENTE: 'bg-blue-100 text-blue-700',
  ENVIADA: 'bg-blue-100 text-blue-700',
  ACEPTADA: 'bg-[#52B788]/15 text-[#2D6A4F]',
  RECHAZADA: 'bg-red-100 text-red-700',
  ERROR: 'bg-[#F39C12]/15 text-[#B7730A]',
  ANULADA: 'bg-red-100 text-red-600',
  OMITIDA: 'bg-gray-100 text-gray-500',
}

const FILTROS_ESTADO: { id: EstadoFactura | 'TODOS'; etiqueta: string }[] = [
  { id: 'TODOS', etiqueta: 'Todos' },
  { id: 'OMITIDA', etiqueta: 'Sin factura fiscal' },
  { id: 'ERROR', etiqueta: 'Error' },
  { id: 'ENVIADA', etiqueta: 'Enviadas' },
  { id: 'ACEPTADA', etiqueta: 'Aceptadas' },
  { id: 'ANULADA', etiqueta: 'Anuladas' },
]

const FILTROS_MODULO: { id: ModuloOrigenFactura | 'TODOS'; etiqueta: string }[] = [
  { id: 'TODOS', etiqueta: 'Todos los módulos' },
  { id: 'PEDIDO', etiqueta: 'Pedido' },
  { id: 'EXPRESS', etiqueta: 'Express' },
  { id: 'HOTEL', etiqueta: 'Hotel' },
  { id: 'TOUR', etiqueta: 'Tour' },
  { id: 'TRANSPORTE', etiqueta: 'Transporte' },
  { id: 'CULTURA', etiqueta: 'Cultura' },
]

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ModalAnular({
  factura,
  onCerrar,
  onConfirmar,
}: {
  factura: FacturaElectronica
  onCerrar: () => void
  onConfirmar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#1A1A1A]">Anular factura #{factura.id}</h2>
        <p className="mt-1 text-sm text-[#1A1A1A]/55">{MODULO_LABEL[factura.moduloOrigen]} · #{factura.referenciaId}</p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Motivo de la anulación"
          className="mt-4 w-full resize-none rounded-lg border border-[#1A1A1A]/20 px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]">
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(motivo.trim())}
            disabled={!motivo.trim()}
            className="rounded-lg bg-[#C0392B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a5301f] disabled:opacity-50"
          >
            Anular
          </button>
        </div>
      </div>
    </div>
  )
}

function TarjetaFactura({
  factura,
  procesando,
  onReintentar,
  onAnular,
}: {
  factura: FacturaElectronica
  procesando: boolean
  onReintentar: (f: FacturaElectronica) => void
  onAnular: (f: FacturaElectronica, motivo: string) => void
}) {
  const [modalAnular, setModalAnular] = useState(false)

  return (
    <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[#1A1A1A]">
            {MODULO_LABEL[factura.moduloOrigen] ?? factura.moduloOrigen} · #{factura.referenciaId}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1A1A1A]/45">
            {factura.comercio?.nombre ?? 'Comercio'} · comprador {factura.comprador?.nombre ?? '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1A1A1A]/45">{fechaCorta(factura.createdAt)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ESTADO_COLOR[factura.estado]}`}>
          {ESTADO_LABEL[factura.estado] ?? factura.estado}
        </span>
      </div>

      <p className="mt-3 text-xs font-medium text-[#1A1A1A]/55">
        Subtotal: {formatearPrecio(Number(factura.subtotal))}
        {Number(factura.ivaTotal) > 0 && <> · IVA: {formatearPrecio(Number(factura.ivaTotal))}</>}
        {' · '}Total: <span className="font-bold text-[#1A1A1A]">{formatearPrecio(Number(factura.total))}</span>
      </p>

      {factura.errorMensaje && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{factura.errorMensaje}</p>
      )}

      {factura.pdfUrl && (
        <a href={factura.pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#2D6A4F] underline">
          Ver PDF
        </a>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {factura.estado === 'ERROR' && (
          <button
            onClick={() => onReintentar(factura)}
            disabled={procesando}
            className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#235540] disabled:opacity-50"
          >
            Reintentar
          </button>
        )}
        {(factura.estado === 'ENVIADA' || factura.estado === 'ACEPTADA') && (
          <button
            onClick={() => setModalAnular(true)}
            disabled={procesando}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Anular
          </button>
        )}
      </div>

      {modalAnular && (
        <ModalAnular
          factura={factura}
          onCerrar={() => setModalAnular(false)}
          onConfirmar={(motivo) => {
            setModalAnular(false)
            onAnular(factura, motivo)
          }}
        />
      )}
    </div>
  )
}

export default function AdminFacturasPage() {
  const [facturas, setFacturas] = useState<FacturaElectronica[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoFactura | 'TODOS'>('TODOS')
  const [filtroModulo, setFiltroModulo] = useState<ModuloOrigenFactura | 'TODOS'>('TODOS')

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)
    facturasAdmin({
      estado: filtroEstado === 'TODOS' ? undefined : filtroEstado,
      moduloOrigen: filtroModulo === 'TODOS' ? undefined : filtroModulo,
    })
      .then(setFacturas)
      .catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar las facturas.'))
      .finally(() => setCargando(false))
  }, [filtroEstado, filtroModulo])

  useEffect(() => { cargar() }, [cargar])

  async function handleReintentar(factura: FacturaElectronica) {
    setProcesandoId(factura.id)
    try {
      const actualizada = await reintentarFacturaAdmin(factura.moduloOrigen, factura.referenciaId)
      setFacturas((prev) => prev.map((f) => (f.id === actualizada.id ? actualizada : f)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo reintentar la emisión.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleAnular(factura: FacturaElectronica, motivo: string) {
    setProcesandoId(factura.id)
    try {
      const actualizada = await anularFacturaAdmin(factura.id, motivo)
      setFacturas((prev) => prev.map((f) => (f.id === actualizada.id ? actualizada : f)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo anular la factura.')
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#1A1A1A]">Facturación electrónica</h1>
      <p className="mt-1 text-sm text-[#1A1A1A]/55">
        Hoy no hay un proveedor DIAN contratado — todas las facturas quedan &quot;Sin factura fiscal&quot; hasta que se active uno.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTROS_ESTADO.map(({ id, etiqueta }) => (
          <button
            key={id}
            onClick={() => setFiltroEstado(id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              filtroEstado === id ? 'bg-[#2D6A4F] text-white' : 'border border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/65 hover:bg-[#F8F5F0]'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FILTROS_MODULO.map(({ id, etiqueta }) => (
          <button
            key={id}
            onClick={() => setFiltroModulo(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              filtroModulo === id ? 'bg-[#D4A017] text-[#1A1A1A]' : 'border border-[#1A1A1A]/10 bg-[#F8F5F0] text-[#1A1A1A]/55 hover:bg-white'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
            <p className="font-medium">{error}</p>
            <button onClick={cargar} className="mt-2 font-semibold underline">Reintentar</button>
          </div>
        ) : cargando ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#1A1A1A]/6" />
            ))}
          </div>
        ) : facturas.length === 0 ? (
          <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white px-5 py-10 text-center text-sm text-[#1A1A1A]/55">
            No hay facturas con estos filtros.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {facturas.map((f) => (
              <TarjetaFactura
                key={f.id}
                factura={f}
                procesando={procesandoId === f.id}
                onReintentar={handleReintentar}
                onAnular={handleAnular}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
