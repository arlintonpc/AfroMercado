'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CampoTexto, CampoSelect } from '@/components/comerciante/Campos'
import {
  solicitarDeclaracionTerritorial,
  type TipoOrganizacionTerritorial,
} from '@/components/comerciante/api'

/**
 * Formulario para solicitar (queda pendiente de revisión admin) una
 * declaración de organización territorial. Pantalla/modal separada del
 * resto del perfil: nunca se mezcla con los Términos generales de la
 * plataforma porque es un dato sensible (Ley 1581) con su propio
 * consentimiento explícito.
 */

const OPCIONES_TIPO: { valor: TipoOrganizacionTerritorial; etiqueta: string }[] = [
  { valor: 'CONSEJO_COMUNITARIO', etiqueta: 'Consejo Comunitario' },
  { valor: 'RESGUARDO_INDIGENA', etiqueta: 'Resguardo Indígena' },
  { valor: 'ZONA_RESERVA_CAMPESINA', etiqueta: 'Zona de Reserva Campesina' },
  { valor: 'OTRA', etiqueta: 'Otra' },
]

interface Props {
  onExito: () => void
  onCerrar: () => void
}

export default function FormularioDeclaracionTerritorial({ onExito, onCerrar }: Props) {
  const [tipo, setTipo] = useState<TipoOrganizacionTerritorial | ''>('')
  const [nombreOrganizacion, setNombreOrganizacion] = useState('')
  const [aceptaAlmacenarDeclaracion, setAceptaAlmacenarDeclaracion] = useState(false)
  const [aceptaMostrarSelloPublico, setAceptaMostrarSelloPublico] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const puedeEnviar = aceptaAlmacenarDeclaracion && Boolean(tipo) && nombreOrganizacion.trim().length > 0

  async function handleEnviar() {
    if (!puedeEnviar || !tipo) return
    setEnviando(true)
    setError(null)
    try {
      await solicitarDeclaracionTerritorial({
        tipo,
        nombreOrganizacion: nombreOrganizacion.trim(),
        consentimientos: {
          aceptaAlmacenarDeclaracion: true,
          aceptaMostrarSelloPublico,
        },
      })
      onExito()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar la declaración.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-[#1A1A1A]/8 px-6 py-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Declaración de organización territorial</h2>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <p className="text-sm leading-relaxed text-[#1A1A1A]/65">
            Esta declaración permite identificar tu negocio como parte de un Consejo Comunitario,
            Resguardo Indígena, Zona de Reserva Campesina u otra organización territorial. Teravia
            la usa para fines de elegibilidad en programas de apoyo institucional y trazabilidad, no
            para restringir tu venta en la plataforma. Un administrador revisará tu solicitud antes de
            aprobarla.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <CampoSelect
              label="Tipo de organización"
              name="tipoOrganizacionTerritorial"
              placeholder="Elige el tipo"
              value={tipo}
              onChange={(v) => setTipo(v as TipoOrganizacionTerritorial)}
              opciones={OPCIONES_TIPO}
            />

            <CampoTexto
              label="Nombre de la organización"
              name="nombreOrganizacion"
              placeholder="Ej: Consejo Comunitario Mayor del Alto San Juan"
              value={nombreOrganizacion}
              onChange={setNombreOrganizacion}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#1B4332]/15 bg-[#F7F5F2] p-4">
            <label className="flex items-start gap-3 text-sm text-[#1A1A1A]">
              <input
                type="checkbox"
                checked={aceptaAlmacenarDeclaracion}
                onChange={(e) => setAceptaAlmacenarDeclaracion(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#1B4332]"
              />
              <span>
                Autorizo que Teravia almacene esta declaración para fines de elegibilidad en
                programas de apoyo y trazabilidad institucional.
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-[#1A1A1A]">
              <input
                type="checkbox"
                checked={aceptaMostrarSelloPublico}
                onChange={(e) => setAceptaMostrarSelloPublico(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#1B4332]"
              />
              <span>
                Autorizo que se muestre públicamente un sello de organización territorial en mi
                perfil.
              </span>
            </label>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-[#1A1A1A]/70">
            No autorizar esto no afecta tu cuenta ni tu capacidad de vender en Teravia. Puedes
            revocar esta autorización en cualquier momento desde tu panel.
          </p>

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-[#C0392B]/20 bg-[#C0392B]/8 px-4 py-3 text-sm text-[#C0392B]">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#1A1A1A]/8 px-6 py-4">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]"
          >
            Cancelar
          </button>
          <Button type="button" loading={enviando} disabled={!puedeEnviar} onClick={handleEnviar}>
            Enviar para revisión
          </Button>
        </div>
      </div>
    </div>
  )
}
