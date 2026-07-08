'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import FormularioDeclaracionTerritorial from '@/components/comerciante/FormularioDeclaracionTerritorial'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'
import { revocarDeclaracionTerritorial, type Comercio } from '@/components/comerciante/api'

/**
 * Panel de la declaración de organización territorial dentro del perfil del
 * comerciante. Pantalla separada del resto del formulario de perfil por su
 * sensibilidad legal (Ley 1581): nunca se mezcla con Términos generales.
 */

const ETIQUETA_TIPO: Record<string, string> = {
  CONSEJO_COMUNITARIO: 'Consejo Comunitario',
  RESGUARDO_INDIGENA: 'Resguardo Indígena',
  ZONA_RESERVA_CAMPESINA: 'Zona de Reserva Campesina',
  OTRA: 'Otra',
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  comercio: Comercio
  onActualizado: (comercio: Comercio) => void
}

export default function PanelDeclaracionTerritorial({ comercio, onActualizado }: Props) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [revocando, setRevocando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [confirmarRevocar, setConfirmarRevocar] = useState(false)

  const tieneDeclaracionAprobada = Boolean(comercio.organizacionTerritorialTipo)
  const tienePendiente = comercio.cambiosCriticos?.some(
    (c) => c.tipo === 'DECLARACION_TERRITORIAL' && c.estado === 'PENDIENTE',
  ) ?? false

  function handleRevocar() {
    setConfirmarRevocar(true)
  }

  async function confirmarRevocarDeclaracion() {
    setConfirmarRevocar(false)
    setRevocando(true)
    setAviso(null)
    try {
      await revocarDeclaracionTerritorial()
      onActualizado({
        ...comercio,
        organizacionTerritorialTipo: null,
        organizacionTerritorialNombre: null,
        organizacionTerritorialFecha: null,
      })
      setAviso({ tipo: 'exito', texto: 'Declaración revocada correctamente.' })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No pudimos revocar la declaración.' })
    } finally {
      setRevocando(false)
    }
  }

  function handleExitoFormulario() {
    setMostrarFormulario(false)
    setAviso({
      tipo: 'exito',
      texto: 'Tu declaración quedó enviada para revisión. Un administrador la evaluará pronto.',
    })
  }

  return (
    <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 sm:p-6 shadow-sm flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-[#1A1A1A]">Organización territorial</h2>
        <p className="mt-1 text-sm text-[#1A1A1A]/55">
          Declara si tu negocio pertenece a un Consejo Comunitario, Resguardo Indígena, Zona de
          Reserva Campesina u otra organización territorial. Es opcional y no afecta tu venta en
          AfroMercado.
        </p>
      </div>

      {aviso && (
        <div className={[
          'rounded-xl border px-4 py-3 text-sm font-medium',
          aviso.tipo === 'exito'
            ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]'
            : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
        ].join(' ')}>
          {aviso.texto}
        </div>
      )}

      {tieneDeclaracionAprobada ? (
        <div className="rounded-xl border border-[#52B788]/30 bg-[#52B788]/8 p-4">
          <p className="text-sm font-semibold text-[#2D6A4F]">
            {ETIQUETA_TIPO[comercio.organizacionTerritorialTipo ?? ''] ?? comercio.organizacionTerritorialTipo}
          </p>
          <p className="mt-1 text-sm text-[#1A1A1A]/70">{comercio.organizacionTerritorialNombre}</p>
          {comercio.organizacionTerritorialFecha && (
            <p className="mt-1 text-xs text-[#1A1A1A]/50">
              Declarado el {fechaCorta(comercio.organizacionTerritorialFecha)}
            </p>
          )}
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={revocando}
            onClick={handleRevocar}
            className="mt-3"
          >
            Revocar declaración
          </Button>
        </div>
      ) : tienePendiente ? (
        <div className="rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/8 px-4 py-3 text-sm text-[#9B7300]">
          Tu declaración está en revisión. Te avisaremos cuando el administrador la evalúe.
        </div>
      ) : (
        <div>
          <p className="text-sm text-[#1A1A1A]/55">Aún no tienes una declaración registrada.</p>
          <Button type="button" variant="secondary" onClick={() => setMostrarFormulario(true)} className="mt-3">
            Declarar organización territorial
          </Button>
        </div>
      )}

      {mostrarFormulario && (
        <FormularioDeclaracionTerritorial
          onExito={handleExitoFormulario}
          onCerrar={() => setMostrarFormulario(false)}
        />
      )}

      {confirmarRevocar && (
        <ModalConfirmacion
          titulo="Revocar declaración"
          mensaje="¿Seguro? Esto no afecta tu cuenta, solo elimina esta declaración específica."
          onCancelar={() => setConfirmarRevocar(false)}
          onConfirmar={confirmarRevocarDeclaracion}
          confirmando={revocando}
        />
      )}
    </div>
  )
}
