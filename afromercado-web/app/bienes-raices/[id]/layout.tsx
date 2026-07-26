import type { Metadata } from 'next'
import { API_URL, SITE_URL, normalizarUrlMediaAbsoluta } from '@/lib/api/client'

const OG_LOGO = `${SITE_URL}/og-logo.png`

async function fetchInmueble(id: string) {
  try {
    const res = await fetch(`${API_URL}/inmuebles/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? json.inmueble ?? json
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const data = await fetchInmueble(id)

  if (!data) {
    return {
      title: 'Bienes Raíces | Teravia',
      description: 'Predios formalizados de comunidades locales: casas, lotes y fincas en Colombia.',
    }
  }

  const titulo = data.titulo || data.nombre || 'Predio territorial'
  const municipio = data.municipio || 'Chocó'
  const departamento = data.departamento || 'Colombia'
  const tipoLabel = data.tipoInmueble ? String(data.tipoInmueble).toLowerCase() : 'predio'
  const precio = data.precio ? `$${Number(data.precio).toLocaleString('es-CO')} COP` : null
  const precioStr = precio ? ` · ${precio}` : ''
  const descripcionRaw = data.descripcion?.slice(0, 140) || `Excelente ${tipoLabel} en ${municipio}, ${departamento}.`
  const descripcion = `${municipio}, ${departamento}${precioStr} — ${descripcionRaw}`

  const fotoRaw = data.fotos?.[0] || data.fotoUrl || data.comercio?.logoUrl
  const fotoAbsoluta = normalizarUrlMediaAbsoluta(fotoRaw, OG_LOGO)

  return {
    title: `${titulo} — ${municipio} | Teravia Bienes Raíces`,
    description: descripcion,
    openGraph: {
      title: `${titulo} — ${municipio}, ${departamento}`,
      description: descripcion,
      url: `${SITE_URL}/bienes-raices/${id}`,
      siteName: 'Teravia',
      type: 'website',
      images: [
        {
          url: fotoAbsoluta,
          width: 1200,
          height: 630,
          alt: titulo,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${titulo} — ${municipio}, ${departamento}`,
      description: descripcion,
      images: [fotoAbsoluta],
    },
    alternates: {
      canonical: `${SITE_URL}/bienes-raices/${id}`,
    },
  }
}

export default async function BienesRaicesDetalleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
