import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'AfroMercado — Marketplace de Colombia',
    short_name:       'AfroMercado',
    description:      'Productos, tours, hoteles, transporte y cultura de comunidades afro, indígenas y campesinas de todo el país',
    start_url:        '/',
    display:          'standalone',
    background_color: '#FAF8F5',
    theme_color:      '#1B4332',
    orientation:      'portrait-primary',
    categories:       ['shopping', 'travel', 'food'],
    lang:             'es',
    icons: [
      {
        src:     '/icon-192.svg',
        sizes:   '192x192',
        type:    'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src:     '/icon-512.svg',
        sizes:   '512x512',
        type:    'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name:        'Catálogo',
        url:         '/',
        description: 'Ver todos los productos',
      },
      {
        name:        'Hoteles',
        url:         '/hoteles',
        description: 'Buscar hospedaje',
      },
      {
        name:        'Tours',
        url:         '/tours',
        description: 'Explorar tours',
      },
    ],
    screenshots: [],
  }
}
