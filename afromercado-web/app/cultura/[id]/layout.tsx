import type { Metadata } from 'next'
import { API_URL, SITE_URL, normalizarUrlMediaAbsoluta } from '@/lib/api/client'

const API = API_URL
const SITE = SITE_URL
const OG_LOGO = `${SITE_URL}/og-logo.png`

async function fetchEvento(id: string) {
  try {
    const res = await fetch(`${API_URL}/cultura/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await fetchEvento(id)
  if (!data) return { title: 'Evento cultural | Teravia' }

  const ubicacion = `${data.municipio}, ${data.departamento}`
  const descripcion = data.descripcion?.slice(0, 160) ?? `Evento cultural en ${ubicacion}`
  const imagenRaw = data.portadaUrl || data.fotos?.[0]
  const imagenAbsoluta = normalizarUrlMediaAbsoluta(imagenRaw, OG_LOGO)

  return {
    title: `${data.titulo} — ${ubicacion} | Teravia Cultura`,
    description: descripcion,
    openGraph: {
      title: data.titulo,
      description: descripcion,
      type: 'website',
      images: [{ url: imagenAbsoluta, width: 1200, height: 630, alt: data.titulo }],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.titulo,
      description: descripcion,
      images: [imagenAbsoluta],
    },
  }
}

export default async function CulturaDetalleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchEvento(id)

  const imagen = data ? (data.portadaUrl || data.fotos?.[0]) : null
  const entradas = data?.entradas ?? []
  const desde = entradas.length > 0 ? Math.min(...entradas.map((e: { precio: number | string }) => Number(e.precio))) : null

  const jsonLd = data ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Event',
        '@id': `${SITE}/cultura/${id}`,
        name: data.titulo,
        description: data.descripcion,
        startDate: data.fechaInicio,
        endDate: data.fechaFin ?? data.fechaInicio,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: data.estado === 'CANCELADO'
          ? 'https://schema.org/EventCancelled'
          : data.estado === 'POSPUESTO'
            ? 'https://schema.org/EventPostponed'
            : 'https://schema.org/EventScheduled',
        location: {
          '@type': 'Place',
          name: data.lugar || `${data.municipio}, ${data.departamento}`,
          address: {
            '@type': 'PostalAddress',
            addressLocality: data.municipio,
            addressRegion: data.departamento,
            addressCountry: 'CO',
          },
          ...(data.latitud != null && data.longitud != null ? {
            geo: { '@type': 'GeoCoordinates', latitude: data.latitud, longitude: data.longitud },
          } : {}),
        },
        ...(imagen ? { image: [imagen] } : {}),
        organizer: {
          '@type': 'Organization',
          name: data.comercio?.nombre ?? 'Teravia',
        },
        ...(desde != null ? {
          offers: {
            '@type': 'Offer',
            price: desde,
            priceCurrency: 'COP',
            availability: 'https://schema.org/InStock',
            url: `${SITE}/cultura/${id}`,
          },
        } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Cultura', item: `${SITE}/cultura` },
          { '@type': 'ListItem', position: 3, name: data.titulo, item: `${SITE}/cultura/${id}` },
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
