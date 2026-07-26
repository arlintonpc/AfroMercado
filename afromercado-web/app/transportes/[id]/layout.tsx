import type { Metadata } from 'next'
import { API_URL, SITE_URL, normalizarUrlMediaAbsoluta } from '@/lib/api/client'

const API = API_URL
const SITE = SITE_URL
const OG_LOGO = `${SITE_URL}/og-logo.png`

async function fetchTransporte(id: string) {
  try {
    const res = await fetch(`${API_URL}/transportes/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await fetchTransporte(id)
  if (!data) return { title: 'Transporte | Teravia' }
  const fotoRaw = data.fotos?.[0] ?? data.comercio?.logoUrl
  const fotoAbsoluta = normalizarUrlMediaAbsoluta(fotoRaw, OG_LOGO)
  const rutas = data.rutas?.filter((r: any) => r.activo) ?? []
  const descripcion = [
    data.descripcion?.slice(0, 120),
    rutas.length > 0 ? `${rutas.length} ruta${rutas.length !== 1 ? 's' : ''} disponible${rutas.length !== 1 ? 's' : ''}.` : null,
  ].filter(Boolean).join(' ')

  return {
    title: `${data.nombre} — Transporte en ${data.comercio.municipio} | Teravia`,
    description: descripcion,
    openGraph: {
      title: `${data.nombre} — ${data.comercio.municipio}`,
      description: descripcion,
      images: [{ url: fotoAbsoluta, width: 1200, height: 630, alt: data.nombre }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${data.nombre} — ${data.comercio.municipio}`,
      description: descripcion,
      images: [fotoAbsoluta],
    },
  }
}

export default async function TransporteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchTransporte(id)
  const rutas = data?.rutas?.filter((r: any) => r.activo) ?? []
  const precioMin = rutas.length > 0 ? Math.min(...rutas.map((r: any) => Number(r.precioAsiento))) : null

  const jsonLd = data ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': `${SITE}/transportes/${id}`,
        name: data.nombre,
        description: data.descripcion ?? `Servicio de transporte ${data.tipo} en ${data.comercio.municipio}.`,
        url: `${SITE}/transportes/${id}`,
        image: data.fotos?.[0] ?? undefined,
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
        ...(precioMin !== null ? {
          priceRange: `COP ${precioMin.toLocaleString('es-CO')}+`,
        } : {}),
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
          { '@type': 'ListItem', position: 1, name: 'Inicio',       item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Transportes',  item: `${SITE}/transportes` },
          { '@type': 'ListItem', position: 3, name: data.nombre,    item: `${SITE}/transportes/${id}` },
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
