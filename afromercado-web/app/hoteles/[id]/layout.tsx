import { obtenerHotel } from '@/lib/api/hotel'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const hotel = await obtenerHotel(Number(id))
    const nombre = hotel.comercio.nombre
    const municipio = hotel.comercio.municipio
    const descripcion = hotel.comercio.descripcion
      ?? `Hospédate en ${nombre}, ${municipio}. Reserva en AfroMercado.`
    const imagen = hotel.habitaciones[0]?.fotos[0] ?? hotel.comercio.logoUrl

    return {
      title: `${nombre} — ${municipio} | AfroMercado`,
      description: descripcion.slice(0, 160),
      openGraph: {
        title: `${nombre} — ${municipio}`,
        description: descripcion.slice(0, 160),
        images: imagen ? [{ url: imagen }] : [],
        type: 'website',
      },
      alternates: { canonical: `/hoteles/${id}` },
    }
  } catch {
    return { title: 'Hotel | AfroMercado' }
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
