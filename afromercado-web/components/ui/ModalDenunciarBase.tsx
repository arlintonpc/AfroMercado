'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface MotivoDenunciaOption {
  value: string
  label: string
}

interface ModalDenunciarBaseProps<T> {
  /** Identificador único de la entidad denunciada, usado para namespacear el `name` de los radio buttons (ej. "producto", "inmueble"). */
  idBase: string
  /** 'radio' = lista de radio buttons (bienes-raices, catalogo). 'select' = dropdown (empleo, cultura). */
  variante: 'radio' | 'select'
  titulo: string
  subtitulo: string
  mensajeExito: string
  motivos: MotivoDenunciaOption[]
  /** Si se debe renderizar via createPortal(document.body) para escapar de contenedores con overflow/z-index propio. Default false. */
  usarPortal?: boolean
  onEnviar: (motivo: string, descripcion?: string) => Promise<T>
  onExito: (resultado: T) => void
  onCerrar: () => void
}

export default function ModalDenunciarBase<T>({
  idBase,
  variante,
  titulo,
  subtitulo,
  mensajeExito,
  motivos,
  usarPortal = false,
  onEnviar,
  onExito,
  onCerrar,
}: ModalDenunciarBaseProps<T>) {
  const [motivo, setMotivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleEnviar() {
    if (!motivo) {
      setError('Selecciona el motivo de tu denuncia')
      return
    }

    setEnviando(true)
    setError(null)
    try {
      const resultado = await onEnviar(motivo, descripcion.trim() || undefined)
      setExito(true)
      onExito(resultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la denuncia')
    } finally {
      setEnviando(false)
    }
  }

  const contenido = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1A1A1A]">{titulo}</h3>
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
              <p className="text-sm text-[#1A1A1A]/55 mb-5">{mensajeExito}</p>
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
              <p className="text-sm text-[#1A1A1A]/55 mb-4">{subtitulo}</p>

              <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">Motivo</label>
              {variante === 'radio' ? (
                <div className="flex flex-col gap-2 mb-3">
                  {motivos.map((m) => (
                    <label
                      key={m.value}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                        motivo === m.value
                          ? 'border-[#2D6A4F] bg-[#2D6A4F]/8 text-[#1A1A1A]'
                          : 'border-[#1A1A1A]/12 text-[#1A1A1A]/70 hover:bg-[#F8F5F0]'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`motivo-denuncia-${idBase}`}
                        value={m.value}
                        checked={motivo === m.value}
                        onChange={() => setMotivo(m.value)}
                        className="accent-[#2D6A4F]"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              ) : (
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 mb-3"
                >
                  <option value="">Selecciona un motivo</option>
                  {motivos.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              )}

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
    </div>
  )

  if (usarPortal && mounted) {
    return createPortal(contenido, document.body)
  }

  return contenido
}
