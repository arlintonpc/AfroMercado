export const metadata = {
  title: 'Hoteles y alojamientos en Colombia | Teravia',
  description: 'Encuentra y reserva hoteles, posadas y alojamientos comunitarios en toda Colombia. Reserva directamente con los dueños.',
  openGraph: {
    title: 'Hoteles en Colombia | Teravia',
    description: 'Alojamientos con identidad y cultura local en cada región de Colombia',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
