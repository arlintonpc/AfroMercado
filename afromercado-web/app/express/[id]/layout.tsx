import type { Metadata } from 'next'
import { API_URL, SITE_URL, normalizarUrlMediaAbsoluta } from '@/lib/api/client'

const API = API_URL
const SITE = SITE_URL
const OG_LOGO = `${SITE_URL}/og-logo.png`

async function fetchComercio(id: string) {
  try {
    const res = await fetch(`${API_URL}/express/comercios/${id}/menu`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await fetchComercio(id)
  if (!data) return { title: 'Restaurante | Teravia' }
  const { comercio } = data
  const fotoAbsoluta = normalizarUrlMediaAbsoluta(comercio.logoUrl ?? comercio.bannerUrl, OG_LOGO)

  return {
    title: `${comercio.nombre} — Comida en ${comercio.municipio} | Teravia`,
    description: `Pide comida de ${comercio.nombre} en ${comercio.municipio}. Domicilio y recogida en tienda a través de Teravia.`,
    openGraph: {
      title: `${comercio.nombre} — ${comercio.municipio}`,
      description: `Pide comida de ${comercio.nombre} en ${comercio.municipio}`,
      images: [{ url: fotoAbsoluta, width: 1200, height: 630, alt: comercio.nombre }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${comercio.nombre} — ${comercio.municipio}`,
      description: `Pide comida de ${comercio.nombre} en ${comercio.municipio}`,
      images: [fotoAbsoluta],
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
