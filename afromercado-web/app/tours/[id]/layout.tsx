import type { Metadata } from 'next'
import { API_URL, SITE_URL, normalizarUrlMediaAbsoluta } from '@/lib/api/client'

const API = API_URL
const SITE = SITE_URL
const OG_LOGO = `${SITE_URL}/og-logo.png`

async function fetchTour(id: string) {
  try {
    const res = await fetch(`${API_URL}/tours/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await fetchTour(id)
  if (!data) return { title: 'Tour | Teravia' }
  const fotoRaw = data.fotos?.[0] ?? data.comercio?.logoUrl
  const fotoAbsoluta = normalizarUrlMediaAbsoluta(fotoRaw, OG_LOGO)

  return {
    title: `${data.nombre} — Tour en ${data.comercio.municipio} | Teravia`,
    description: [
      data.descripcion?.slice(0, 120),
      `${data.duracionHoras}h · Desde $${Number(data.precioPersona).toLocaleString('es-CO')}/persona.`,
    ].filter(Boolean).join(' '),
    openGraph: {
      title: `${data.nombre} — ${data.comercio.municipio}`,
      description: data.descripcion?.slice(0, 160) ?? `Tour en ${data.comercio.municipio}`,
      images: [{ url: fotoAbsoluta, width: 1200, height: 630, alt: data.nombre }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${data.nombre} — ${data.comercio.municipio}`,
      description: data.descripcion?.slice(0, 160) ?? `Tour en ${data.comercio.municipio}`,
      images: [fotoAbsoluta],
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
