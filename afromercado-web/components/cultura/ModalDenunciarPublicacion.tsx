'use client'

import ModalDenunciarBase from '@/components/ui/ModalDenunciarBase'
import { denunciarPublicacionCultural, type MotivoDenunciaPublicacion, type DenunciaPublicacionCultural } from '@/lib/api/cultura'

const MOTIVOS: { value: string; label: string }[] = [
  { value: 'CONTENIDO_INAPROPIADO', label: 'Contenido inapropiado' },
  { value: 'SPAM', label: 'Es spam o publicidad' },
  { value: 'DERECHOS_DE_AUTOR', label: 'No es contenido propio / derechos de autor' },
  { value: 'NO_RELACIONADO', label: 'No está relacionado con cultura o turismo' },
  { value: 'OTRO', label: 'Otro motivo' },
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
  return (
    <ModalDenunciarBase<DenunciaPublicacionCultural>
      idBase="publicacion"
      variante="select"
      titulo="Denunciar esta publicación"
      subtitulo="Cuéntanos qué está mal con esta publicación. Un administrador la revisará antes de tomar una decisión."
      mensajeExito="Un administrador la revisará. Gracias por ayudarnos a cuidar la comunidad."
      motivos={MOTIVOS}
      usarPortal={true}
      onCerrar={onCerrar}
      onExito={onExito}
      onEnviar={(motivo, descripcion) =>
        denunciarPublicacionCultural(publicacionId, {
          motivo: motivo as MotivoDenunciaPublicacion,
          descripcion,
        })
      }
    />
  )
}
