'use client'

import ModalDenunciarBase from '@/components/ui/ModalDenunciarBase'
import { denunciarInmueble, MOTIVOS_DENUNCIA_INMUEBLE, type MotivoDenunciaInmueble } from '@/lib/api/bienes-raices'

interface ModalDenunciarInmuebleProps {
  inmuebleId: number
  onCerrar: () => void
  onExito: () => void
}

export default function ModalDenunciarInmueble({
  inmuebleId,
  onCerrar,
  onExito,
}: ModalDenunciarInmuebleProps) {
  const motivos = MOTIVOS_DENUNCIA_INMUEBLE.map((m) => ({
    value: m.value,
    label: m.value === 'ESTAFA_DINERO' ? 'Piden dinero por adelantado (estafa)' : m.label,
  }))

  return (
    <ModalDenunciarBase<void>
      idBase="inmueble"
      variante="radio"
      titulo="Reportar esta publicación"
      subtitulo="Cuéntanos qué está mal con esta publicación. Un administrador la revisará antes de tomar una decisión."
      mensajeExito="Un administrador revisará esta publicación. Gracias por ayudarnos a cuidar la comunidad."
      motivos={motivos}
      onCerrar={onCerrar}
      onExito={onExito}
      onEnviar={(motivo, descripcion) =>
        denunciarInmueble(inmuebleId, {
          motivo: motivo as MotivoDenunciaInmueble,
          descripcion,
        })
      }
    />
  )
}
