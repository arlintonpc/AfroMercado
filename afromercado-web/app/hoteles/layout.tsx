export const metadata = {
  title: 'Hoteles y alojamientos en el Chocó | AfroMercado',
  description: 'Encuentra y reserva hoteles, posadas y alojamientos en el Chocó afrocolombianos. Reserva directamente con los dueños.',
  openGraph: {
    title: 'Hoteles en el Chocó | AfroMercado',
    description: 'Alojamientos con cultura afrocolombiana en el Chocó',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
