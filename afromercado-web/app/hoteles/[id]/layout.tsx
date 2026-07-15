import { obtenerHotel } from '@/lib/api/hotel'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const hotel = await obtenerHotel(Number(id))
    const nombre = hotel.comercio.nombre
    const municipio = hotel.comercio.municipio
    const descripcion = hotel.comercio.descripcion
      ?? `Hospédate en ${nombre}, ${municipio}. Reserva en Teravia.`
    const imagen = hotel.habitaciones[0]?.fotos[0] ?? hotel.comercio.logoUrl

    return {
      title: `${nombre} — ${municipio} | Teravia`,
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
    return { title: 'Hotel | Teravia' }
  }
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const hotel = await obtenerHotel(Number(id)).catch(() => null)

  const jsonLd = hotel ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Hotel',
        '@id': `${SITE}/hoteles/${id}`,
        name: hotel.comercio.nombre,
        description: hotel.comercio.descripcion
          ?? `Hospédate en ${hotel.comercio.nombre}, ${hotel.comercio.municipio}. Reserva en Teravia.`,
        url: `${SITE}/hoteles/${id}`,
        image: hotel.habitaciones[0]?.fotos[0] ?? hotel.comercio.logoUrl ?? undefined,
        address: {
          '@type': 'PostalAddress',
          addressLocality: hotel.comercio.municipio,
          addressRegion: hotel.comercio.departamento ?? 'Chocó',
          addressCountry: 'CO',
        },
        ...(hotel.habitaciones[0] ? {
          priceRange: `$${Number(hotel.habitaciones[0].precioPorNoche).toLocaleString('es-CO')} COP`,
          makesOffer: {
            '@type': 'Offer',
            price: Number(hotel.habitaciones[0].precioPorNoche),
            priceCurrency: 'COP',
            availability: 'https://schema.org/InStock',
          },
        } : {}),
        ...(hotel.comercio.calificacion && hotel.comercio.totalReviews > 0 ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(hotel.comercio.calificacion).toFixed(1),
            reviewCount: hotel.comercio.totalReviews,
            bestRating: 5,
          },
        } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Hoteles', item: `${SITE}/hoteles` },
          { '@type': 'ListItem', position: 3, name: hotel.comercio.nombre, item: `${SITE}/hoteles/${id}` },
        ],
      },
    ],
  } : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  )
}
