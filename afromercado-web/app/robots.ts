import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/comerciante/', '/repartidor/', '/api/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
