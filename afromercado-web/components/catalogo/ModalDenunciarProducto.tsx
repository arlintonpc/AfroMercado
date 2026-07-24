'use client'

import ModalDenunciarBase from '@/components/ui/ModalDenunciarBase'
import { denunciarProducto, MOTIVOS_DENUNCIA_PRODUCTO, type MotivoDenunciaProducto } from '@/lib/api/productos'

interface ModalDenunciarProductoProps {
  productoId: number
  onCerrar: () => void
  onExito: () => void
}

export default function ModalDenunciarProducto({
  productoId,
  onCerrar,
  onExito,
}: ModalDenunciarProductoProps) {
  return (
    <ModalDenunciarBase<void>
      idBase="producto"
      variante="radio"
      titulo="Reportar este producto"
      subtitulo="Cuéntanos qué está mal con este producto. Un administrador lo revisará antes de tomar una decisión."
      mensajeExito="Un administrador revisará este producto. Gracias por ayudarnos a cuidar la comunidad."
      motivos={MOTIVOS_DENUNCIA_PRODUCTO}
      onCerrar={onCerrar}
      onExito={onExito}
      onEnviar={(motivo, descripcion) =>
        denunciarProducto(productoId, {
          motivo: motivo as MotivoDenunciaProducto,
          descripcion,
        })
      }
    />
  )
}
