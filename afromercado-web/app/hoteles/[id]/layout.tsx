import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

async function fetchHotel(id: string) {
  try {
    const res = await fetch(`${API}/hoteles/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await fetchHotel(id)
  if (!data) return { title: 'Hotel | AfroMercado' }
  const foto = data.habitaciones?.[0]?.fotos?.[0]
  const desde = data.habitaciones?.length > 0
    ? Math.min(...data.habitaciones.map((h: any) => Number(h.precioPorNoche)))
    : null
  return {
    title: `${data.comercio.nombre} — Hotel en ${data.comercio.municipio} | AfroMercado`,
    description: [
      data.comercio.descripcion?.slice(0, 120),
      desde ? `Desde $${desde.toLocaleString('es-CO')}/noche.` : null,
      `${data.habitaciones?.length ?? 0} tipo${data.habitaciones?.length !== 1 ? 's' : ''} de habitación.`,
    ].filter(Boolean).join(' '),
    openGraph: {
      title: `${data.comercio.nombre} — ${data.comercio.municipio}`,
      description: data.comercio.descripcion?.slice(0, 160) ?? `Hotel en ${data.comercio.municipio}, Chocó`,
      images: foto ? [{ url: foto, width: 800, height: 600 }] : [],
      type: 'website',
    },
  }
}

export default async function HotelLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchHotel(id)

  const jsonLd = data ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LodgingBusiness',
        '@id': `${SITE}/hoteles/${id}`,
        name: data.comercio.nombre,
        description: data.comercio.descripcion ?? undefined,
        url: `${SITE}/hoteles/${id}`,
        image: data.habitaciones?.[0]?.fotos?.[0] ?? undefined,
        address: {
          '@type': 'PostalAddress',
          addressLocality: data.comercio.municipio,
          addressRegion: data.comercio.departamento ?? 'Chocó',
          addressCountry: 'CO',
        },
        ...(data.comercio.latitud && data.comercio.longitud ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: data.comercio.latitud,
            longitude: data.comercio.longitud,
          },
        } : {}),
        ...(data.comercio.calificacion && data.comercio.totalReviews > 0 ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(data.comercio.calificacion).toFixed(1),
            reviewCount: data.comercio.totalReviews,
            bestRating: 5,
          },
        } : {}),
        priceRange: data.habitaciones?.length > 0
          ? `COP ${Math.min(...data.habitaciones.map((h: any) => Number(h.precioPorNoche))).toLocaleString('es-CO')}+`
          : undefined,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio',   item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Hoteles',  item: `${SITE}/hoteles` },
          { '@type': 'ListItem', position: 3, name: data.comercio.nombre, item: `${SITE}/hoteles/${id}` },
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
