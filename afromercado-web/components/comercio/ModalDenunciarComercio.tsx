'use client'

import ModalDenunciarBase from '@/components/ui/ModalDenunciarBase'
import { denunciarComercio, MOTIVOS_DENUNCIA_COMERCIO, type MotivoDenunciaComercio } from '@/lib/api/comercios'

interface ModalDenunciarComercioProps {
  comercioId: number
  onCerrar: () => void
  onExito: () => void
}

export default function ModalDenunciarComercio({
  comercioId,
  onCerrar,
  onExito,
}: ModalDenunciarComercioProps) {
  return (
    <ModalDenunciarBase<void>
      idBase="comercio"
      variante="radio"
      titulo="Reportar este comercio"
      subtitulo="Cuéntanos qué está mal con este comercio. Un administrador lo revisará antes de tomar una decisión."
      mensajeExito="Un administrador revisará este comercio. Gracias por ayudarnos a cuidar la comunidad."
      motivos={MOTIVOS_DENUNCIA_COMERCIO}
      onCerrar={onCerrar}
      onExito={onExito}
      onEnviar={(motivo, descripcion) =>
        denunciarComercio(comercioId, {
          motivo: motivo as MotivoDenunciaComercio,
          descripcion,
        })
      }
    />
  )
}
