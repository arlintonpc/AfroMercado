'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { denunciarPublicacionCultural, type MotivoDenunciaPublicacion, type DenunciaPublicacionCultural } from '@/lib/api/cultura'

const MOTIVOS: { valor: MotivoDenunciaPublicacion; etiqueta: string }[] = [
  { valor: 'CONTENIDO_INAPROPIADO', etiqueta: 'Contenido inapropiado' },
  { valor: 'SPAM', etiqueta: 'Es spam o publicidad' },
  { valor: 'DERECHOS_DE_AUTOR', etiqueta: 'No es contenido propio / derechos de autor' },
  { valor: 'NO_RELACIONADO', etiqueta: 'No está relacionado con cultura o turismo' },
  { valor: 'OTRO', etiqueta: 'Otro motivo' },
]

interface ModalDenunciarPublicacionProps {
  publicacionId: number
  onCerrar: () => void
  onExito: (denuncia: DenunciaPublicacionCultural) => void
}

export default function ModalDenunciarPublicacion({
  publicacionId,
  onCerrar,
  onExito,
}: ModalDenunciarPublicacionProps) {
  const [motivo, setMotivo] = useState<MotivoDenunciaPublicacion | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  async function handleEnviar() {
    if (!motivo) { setError('Selecciona el motivo de tu denuncia'); return }

    setEnviando(true)
    setError(null)
    try {
      const denuncia = await denunciarPublicacionCultural(publicacionId, {
        motivo,
        descripcion: descripcion.trim() || undefined,
      })
      setExito(true)
      onExito(denuncia)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la denuncia')
    } finally {
      setEnviando(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1A1A1A]">Denunciar esta publicación</h3>
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
              <p className="font-semibold text-[#1A1A1A] mb-1">Denuncia enviada</p>
              <p className="text-sm text-[#1A1A1A]/55 mb-5">
                Un administrador la revisará. Gracias por ayudarnos a cuidar la comunidad.
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
                Cuéntanos qué está mal con esta publicación. Un administrador la revisará antes de tomar una decisión.
              </p>

              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">Motivo</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoDenunciaPublicacion)}
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 mb-3"
              >
                <option value="">Selecciona un motivo</option>
                {MOTIVOS.map((m) => (
                  <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                ))}
              </select>

              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">
                Descripción <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
              </label>
              <textarea
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/35 resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 mb-3"
                rows={4}
                placeholder="Cuéntanos con el mayor detalle posible qué encontraste sospechoso"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={1000}
              />

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
                  {enviando ? 'Enviando…' : 'Enviar denuncia'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
