import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'
const API  = process.env.NEXT_PUBLIC_API_URL  ?? 'http://localhost:3001/api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: SITE,                  changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE}/productos`,   changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/ingresar`,    changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE}/terminos`,    changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE}/privacidad`,  changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE}/contacto`,    changeFrequency: 'monthly', priority: 0.3 },
  ]

  try {
    const res = await fetch(`${API}/productos?limite=500`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const json = await res.json() as {
        data?: { productos?: { id: number; updatedAt?: string }[] }
      }
      const productos = json.data?.productos ?? []
      const dinamicas: MetadataRoute.Sitemap = productos.map((p) => ({
        url:             `${SITE}/producto/${p.id}`,
        lastModified:    p.updatedAt ? new Date(p.updatedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority:        0.8,
      }))
      return [...estaticas, ...dinamicas]
    }
  } catch {
    // fetch fallido en build — solo páginas estáticas
  }

  return estaticas
}
