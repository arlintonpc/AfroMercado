import type { Metadata } from 'next'
import { API_URL, SITE_URL, normalizarUrlMediaAbsoluta } from '@/lib/api/client'

const SITE = SITE_URL
const OG_LOGO = `${SITE_URL}/og-logo.png`

const EMPLOYMENT_TYPE_SCHEMA: Record<string, string> = {
  TIEMPO_COMPLETO: 'FULL_TIME',
  MEDIO_TIEMPO: 'PART_TIME',
  POR_DIAS: 'PER_DIEM',
  TEMPORAL: 'TEMPORARY',
  OTRO: 'OTHER',
}

async function fetchOferta(id: string) {
  try {
    const res = await fetch(`${API_URL}/empleo/ofertas/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await fetchOferta(id)
  if (!data) return { title: 'Oferta de empleo | Teravia' }
  const ubicacion = data.departamento ? `${data.municipio}, ${data.departamento}` : data.municipio
  const fotoRaw = data.publicadoPor?.avatarUrl ?? data.comercio?.logoUrl
  const fotoAbsoluta = normalizarUrlMediaAbsoluta(fotoRaw, OG_LOGO)
  const desc = data.descripcion?.slice(0, 160) ?? `Vacante de empleo y oportunidades en ${ubicacion}.`

  return {
    title: `${data.titulo} — Empleo en ${ubicacion} | Teravia`,
    description: desc,
    openGraph: {
      title: `${data.titulo} — ${ubicacion}`,
      description: desc,
      url: `${SITE_URL}/empleo/${id}`,
      siteName: 'Teravia',
      type: 'website',
      images: [{ url: fotoAbsoluta, width: 1200, height: 630, alt: data.titulo }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${data.titulo} — ${ubicacion}`,
      description: desc,
      images: [fotoAbsoluta],
    },
  }
}

export default async function EmpleoDetalleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchOferta(id)

  const jsonLd = data ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'JobPosting',
        '@id': `${SITE}/empleo/${id}`,
        title: data.titulo,
        description: data.descripcion,
        datePosted: data.createdAt,
        validThrough: data.fechaCierre ?? undefined,
        employmentType: EMPLOYMENT_TYPE_SCHEMA[data.tipoContrato] ?? 'OTHER',
        hiringOrganization: {
          '@type': 'Organization',
          name: data.comercio?.nombre ?? data.publicadoPor?.nombre ?? 'Teravia',
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: data.municipio,
            addressRegion: data.departamento ?? 'Chocó',
            addressCountry: 'CO',
          },
        },
        ...(data.salarioMin ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'COP',
            value: {
              '@type': 'QuantitativeValue',
              minValue: Number(data.salarioMin),
              maxValue: data.salarioMax ? Number(data.salarioMax) : Number(data.salarioMin),
              unitText: 'MONTH',
            },
          },
        } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Empleo', item: `${SITE}/empleo` },
          { '@type': 'ListItem', position: 3, name: data.titulo, item: `${SITE}/empleo/${id}` },
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
