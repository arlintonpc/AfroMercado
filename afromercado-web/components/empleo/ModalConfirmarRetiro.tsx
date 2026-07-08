'use client'

import { createPortal } from 'react-dom'

interface ModalConfirmarRetiroProps {
  onCancelar: () => void
  onConfirmar: () => void
  confirmando?: boolean
}

export default function ModalConfirmarRetiro({
  onCancelar,
  onConfirmar,
  confirmando = false,
}: ModalConfirmarRetiroProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1A1A1A]">Retirar tu postulación</h3>
            <button
              onClick={onCancelar}
              className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors"
              aria-label="Cerrar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-[#1A1A1A]/55 mb-5">
            ¿Retirar tu postulación? Podrás volver a postularte más tarde si cambias de opinión.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="flex-1 rounded-xl border border-[#1A1A1A]/12 px-4 py-2 text-sm font-semibold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={confirmando}
              className="flex-1 rounded-xl bg-[#C0392B] hover:bg-[#a5301f] text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirmando ? 'Retirando…' : 'Retirar postulación'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
