import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hoteles en el Chocó | AfroMercado',
  description:
    'Encuentra y reserva alojamientos únicos en Quibdó y el Chocó. Fincas, posadas y hoteles de comunidades afrocolombianas.',
}

export default function HotelesLayout({ children }: { children: React.ReactNode }) {
  return children
}
