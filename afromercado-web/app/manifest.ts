import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'AfroMercado',
    short_name:       'AfroMercado',
    description:      'Marketplace cultural afrocolombianos del Chocó',
    start_url:        '/',
    display:          'standalone',
    background_color: '#F8F5F0',
    theme_color:      '#2D6A4F',
    icons: [
      {
        src:     '/icon-192.svg',
        sizes:   '192x192',
        type:    'image/svg+xml',
      },
      {
        src:     '/icon-192.svg',
        sizes:   'any',
        type:    'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
