import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

async function fetchComercio(id: string) {
  try {
    const res = await fetch(`${API}/express/comercios/${id}/menu`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await fetchComercio(id)
  if (!data) return { title: 'Restaurante | AfroMercado' }
  const { comercio } = data
  return {
    title: `${comercio.nombre} — Comida en ${comercio.municipio} | AfroMercado`,
    description: `Pide comida de ${comercio.nombre} en ${comercio.municipio}. Domicilio y recogida en tienda a través de AfroMercado.`,
    openGraph: {
      title: `${comercio.nombre} — ${comercio.municipio}`,
      description: `Pide comida de ${comercio.nombre} en ${comercio.municipio}`,
      images: comercio.logoUrl ? [{ url: comercio.logoUrl, width: 800, height: 600 }] : [],
      type: 'website',
    },
  }
}

export default async function ExpressLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchComercio(id)

  const jsonLd = data ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Restaurant',
        '@id': `${SITE}/express/${id}`,
        name: data.comercio.nombre,
        image: data.comercio.logoUrl ?? undefined,
        url: `${SITE}/express/${id}`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: data.comercio.municipio,
          addressCountry: 'CO',
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
          { '@type': 'ListItem', position: 2, name: 'Sabores', item: `${SITE}/express` },
          { '@type': 'ListItem', position: 3, name: data.comercio.nombre, item: `${SITE}/express/${id}` },
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
