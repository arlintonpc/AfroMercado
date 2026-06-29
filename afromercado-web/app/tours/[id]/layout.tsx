import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

async function fetchTour(id: string) {
  try {
    const res = await fetch(`${API}/tours/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await fetchTour(id)
  if (!data) return { title: 'Tour | AfroMercado' }
  const foto = data.fotos?.[0]
  return {
    title: `${data.nombre} — Tour en ${data.comercio.municipio} | AfroMercado`,
    description: [
      data.descripcion?.slice(0, 120),
      `${data.duracionHoras}h · Desde $${Number(data.precioPersona).toLocaleString('es-CO')}/persona.`,
    ].filter(Boolean).join(' '),
    openGraph: {
      title: `${data.nombre} — ${data.comercio.municipio}`,
      description: data.descripcion?.slice(0, 160) ?? `Tour en ${data.comercio.municipio}, Chocó`,
      images: foto ? [{ url: foto, width: 800, height: 600 }] : [],
      type: 'website',
    },
  }
}

export default async function TourLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchTour(id)

  const jsonLd = data ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TouristTrip',
        '@id': `${SITE}/tours/${id}`,
        name: data.nombre,
        description: data.descripcion ?? undefined,
        url: `${SITE}/tours/${id}`,
        image: data.fotos?.[0] ?? undefined,
        touristType: 'Cultural',
        itinerary: {
          '@type': 'ItemList',
          numberOfItems: 1,
        },
        offers: {
          '@type': 'Offer',
          price: Number(data.precioPersona),
          priceCurrency: 'COP',
          availability: 'https://schema.org/InStock',
        },
        provider: {
          '@type': 'LocalBusiness',
          name: data.comercio.nombre,
          address: {
            '@type': 'PostalAddress',
            addressLocality: data.comercio.municipio,
            addressRegion: data.comercio.departamento ?? 'Chocó',
            addressCountry: 'CO',
          },
        },
        ...(data.comercio.calificacion && data.comercio.totalReviews > 0 ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(data.comercio.calificacion).toFixed(1),
            reviewCount: data.comercio.totalReviews,
            bestRating: 5,
          },
        } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Tours',  item: `${SITE}/tours` },
          { '@type': 'ListItem', position: 3, name: data.nombre, item: `${SITE}/tours/${id}` },
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
