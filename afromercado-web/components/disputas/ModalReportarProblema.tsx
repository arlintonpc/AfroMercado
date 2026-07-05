'use client'

import { useState } from 'react'
import { crearDisputa, type ModuloOrigenDisputa, type MotivoDisputa, type Disputa } from '@/lib/api/disputas'

const MOTIVOS: { valor: MotivoDisputa; etiqueta: string }[] = [
  { valor: 'PRODUCTO_NO_LLEGO', etiqueta: 'El producto no llegó' },
  { valor: 'PRODUCTO_DEFECTUOSO_O_DANADO', etiqueta: 'Llegó defectuoso o dañado' },
  { valor: 'PRODUCTO_INCOMPLETO', etiqueta: 'Llegó incompleto' },
  { valor: 'PRODUCTO_DIFERENTE_AL_PEDIDO', etiqueta: 'Es diferente a lo que pedí' },
  { valor: 'CALIDAD_NO_CONFORME', etiqueta: 'La calidad no es la esperada' },
  { valor: 'SERVICIO_NO_PRESTADO', etiqueta: 'El servicio no se prestó' },
  { valor: 'COBRO_INCORRECTO', etiqueta: 'Me cobraron mal' },
  { valor: 'OTRO', etiqueta: 'Otro motivo' },
]

interface ModalReportarProblemaProps {
  moduloOrigen: ModuloOrigenDisputa
  referenciaId: number
  onCerrar: () => void
  onExito: (disputa: Disputa) => void
}

export default function ModalReportarProblema({
  moduloOrigen,
  referenciaId,
  onCerrar,
  onExito,
}: ModalReportarProblemaProps) {
  const [motivo, setMotivo] = useState<MotivoDisputa | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [montoReembolsoSolicitado, setMontoReembolsoSolicitado] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  async function handleEnviar() {
    if (!motivo) { setError('Selecciona el motivo de tu reclamo'); return }
    if (!descripcion.trim()) { setError('Describe el problema para poder revisarlo'); return }

    setEnviando(true)
    setError(null)
    try {
      const monto = montoReembolsoSolicitado.trim() ? Number(montoReembolsoSolicitado) : undefined
      if (monto !== undefined && (!Number.isFinite(monto) || monto <= 0)) {
        setError('El monto de reembolso debe ser un número mayor a 0')
        setEnviando(false)
        return
      }
      const disputa = await crearDisputa({
        moduloOrigen,
        referenciaId,
        motivo,
        descripcion: descripcion.trim(),
        montoReembolsoSolicitado: monto,
      })
      setExito(true)
      onExito(disputa)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el reclamo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1A1A1A]">Reportar un problema</h3>
            <button
              onClick={onCerrar}
              className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors"
              aria-label="Cerrar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {exito ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-[#52B788]/15 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="font-semibold text-[#1A1A1A] mb-1">Reclamo enviado</p>
              <p className="text-sm text-[#1A1A1A]/55 mb-5">
                El comercio tiene 48 horas para responder. Puedes seguir el estado en &quot;Mis reclamos&quot;.
              </p>
              <button
                type="button"
                onClick={onCerrar}
                className="w-full rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#1A1A1A]/55 mb-4">
                Cuéntanos qué pasó con tu compra. El comercio será notificado y tendrá 48 horas para responder.
              </p>

              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">Motivo</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoDisputa)}
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 mb-3"
              >
                <option value="">Selecciona un motivo</option>
                {MOTIVOS.map((m) => (
                  <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                ))}
              </select>

              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">Descripción</label>
              <textarea
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 mb-3"
                rows={4}
                placeholder="Describe qué pasó con el mayor detalle posible"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={1000}
              />

              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">
                Monto de reembolso solicitado <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
              </label>
              <input
                type="number"
                min={1}
                step={100}
                value={montoReembolsoSolicitado}
                onChange={(e) => setMontoReembolsoSolicitado(e.target.value)}
                placeholder="Ej: 25000"
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 mb-1"
              />
              <p className="text-xs text-[#1A1A1A]/40 mb-4">Déjalo vacío si aún no sabes cuánto pedir.</p>

              {error && (
                <p className="text-xs text-[#C0392B] mb-3">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCerrar}
                  className="flex-1 rounded-xl border border-[#1A1A1A]/12 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEnviar}
                  disabled={enviando}
                  className="flex-1 rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enviando ? 'Enviando…' : 'Enviar reclamo'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
