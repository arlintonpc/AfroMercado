import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params
    const res = await fetch(`${API}/comercio/${id}`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error()
    const json = await res.json()
    const c = json.data ?? json
    const nombre = c.nombre ?? 'Tienda'
    const municipio = c.municipio ?? 'Chocó'
    const desc = c.descripcion ?? `Productos artesanales y culturales de ${nombre} en ${municipio}, Chocó.`
    const img = c.logoUrl ?? c.bannerUrl ?? null
    return {
      title: `${nombre} — AfroMercado`,
      description: desc.slice(0, 160),
      openGraph: {
        title: `${nombre} — AfroMercado`,
        description: desc.slice(0, 160),
        ...(img ? { images: [{ url: img }] } : {}),
      },
    }
  } catch {
    return { title: 'Tienda — AfroMercado' }
  }
}

export default function ComercioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
