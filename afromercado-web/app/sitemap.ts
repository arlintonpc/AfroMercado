import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'
const API  = process.env.NEXT_PUBLIC_API_URL  ?? 'http://localhost:3001/api'

type ItemConId = { id: number; updatedAt?: string }

async function fetchIds(path: string, extractor: (j: any) => ItemConId[]): Promise<ItemConId[]> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    return extractor(await res.json())
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: SITE,                    changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE}/productos`,     changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/hoteles`,       changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/tours`,         changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/transportes`,   changeFrequency: 'daily',   priority: 0.8 },
    { url: `${SITE}/ingresar`,      changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE}/terminos`,      changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE}/privacidad`,    changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${SITE}/contacto`,      changeFrequency: 'monthly', priority: 0.3 },
  ]

  const [productos, hoteles, tours, transportes] = await Promise.all([
    fetchIds('/productos?limite=500', j => j.items ?? j.data?.productos ?? []),
    fetchIds('/hoteles',              j => j.data ?? []),
    fetchIds('/tours',                j => j.data ?? []),
    fetchIds('/transportes',          j => j.data ?? []),
  ])

  const toEntries = (items: ItemConId[], base: string, priority: number): MetadataRoute.Sitemap =>
    items.map(item => ({
      url:             `${SITE}${base}/${item.id}`,
      lastModified:    item.updatedAt ? new Date(item.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority,
    }))

  return [
    ...estaticas,
    ...toEntries(productos,    '/producto',    0.8),
    ...toEntries(hoteles,      '/hoteles',     0.85),
    ...toEntries(tours,        '/tours',       0.85),
    ...toEntries(transportes,  '/transportes', 0.8),
  ]
}
