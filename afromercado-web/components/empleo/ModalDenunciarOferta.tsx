'use client'

import ModalDenunciarBase from '@/components/ui/ModalDenunciarBase'
import { denunciarOferta, type MotivoDenunciaEmpleo, type DenunciaOfertaEmpleo } from '@/lib/api/empleo'

const MOTIVOS: { value: string; label: string }[] = [
  { value: 'OFERTA_FALSA', label: 'Es una oferta falsa' },
  { value: 'EXPLOTACION_LABORAL', label: 'Parece explotación laboral' },
  { value: 'DISCRIMINATORIA', label: 'Es discriminatoria' },
  { value: 'ESTAFA_DINERO', label: 'Piden dinero o es una estafa' },
  { value: 'CONTENIDO_INAPROPIADO', label: 'Contenido inapropiado' },
  { value: 'OTRO', label: 'Otro motivo' },
]

interface ModalDenunciarOfertaProps {
  ofertaId: number
  onCerrar: () => void
  onExito: (denuncia: DenunciaOfertaEmpleo) => void
}

export default function ModalDenunciarOferta({
  ofertaId,
  onCerrar,
  onExito,
}: ModalDenunciarOfertaProps) {
  return (
    <ModalDenunciarBase<DenunciaOfertaEmpleo>
      idBase="oferta"
      variante="select"
      titulo="Denunciar esta oferta"
      subtitulo="Cuéntanos qué está mal con esta oferta. Un administrador la revisará antes de tomar una decisión."
      mensajeExito="Un administrador revisará esta oferta. Gracias por ayudarnos a cuidar la comunidad."
      motivos={MOTIVOS}
      onCerrar={onCerrar}
      onExito={onExito}
      onEnviar={(motivo, descripcion) =>
        denunciarOferta(ofertaId, {
          motivo: motivo as MotivoDenunciaEmpleo,
          descripcion,
        })
      }
    />
  )
}
