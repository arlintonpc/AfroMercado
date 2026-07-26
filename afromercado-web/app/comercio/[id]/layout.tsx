import type { Metadata } from 'next'
import { normalizarUrlMediaAbsoluta } from '@/lib/api/client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'
const OG_LOGO = `${SITE}/og-logo.png`

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params
    const res = await fetch(`${API}/comercio/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error()
    const json = await res.json()
    const c = json.data ?? json
    const nombre = c.nombre ?? 'Tienda'
    const municipio = c.municipio ?? 'Colombia'
    const desc = c.descripcion ?? `Productos artesanales y culturales de ${nombre} en ${municipio}.`
    const imgRaw = c.logoUrl ?? c.bannerUrl ?? null
    const imgAbsoluta = normalizarUrlMediaAbsoluta(imgRaw, OG_LOGO)

    return {
      title: `${nombre} — Teravia`,
      description: desc.slice(0, 160),
      openGraph: {
        title: `${nombre} — Teravia`,
        description: desc.slice(0, 160),
        images: [{ url: imgAbsoluta, width: 1200, height: 630, alt: nombre }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${nombre} — Teravia`,
        description: desc.slice(0, 160),
        images: [imgAbsoluta],
      },
    }
  } catch {
    return { title: 'Tienda — Teravia' }
  }
}

export default function ComercioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
