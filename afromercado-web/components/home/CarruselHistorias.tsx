'use client'

import { useState } from 'react'
import ModalReelViewer, { HistoriaReel } from './ModalReelViewer'

const HISTORIAS_DEMO: HistoriaReel[] = [
  {
    id: 'h1',
    creadorNombre: 'Cacao Chocó',
    creadorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    creadorRol: 'Productor Artesanal',
    municipio: 'Tadó',
    titulo: 'Cosecha de Cacao Fino de Aroma',
    descripcion: 'Proceso ancestral de secado al sol del cacao en grano en las fincas agroforestales de Tadó.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
    linkAccion: '/agro',
    textoAccion: 'Comprar Cacao Nativo',
    verificadoEtnico: true,
  },
  {
    id: 'h2',
    creadorNombre: 'Hostal Playa Blanca',
    creadorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    creadorRol: 'Alojamiento Étnico',
    municipio: 'Bahía Solano',
    titulo: 'Atardecer frente al Océano Pacífico',
    descripcion: 'Nuestras cabañas ecológicas están construidas en madera sostenible frente al mar pacífico.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    linkAccion: '/hoteles',
    textoAccion: 'Reservar Cabaña',
    verificadoEtnico: true,
  },
  {
    id: 'h3',
    creadorNombre: 'Sabores del Baudó',
    creadorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    creadorRol: 'Cocina Tradicional',
    municipio: 'Quibdó',
    titulo: 'Pescado frito con arroz con coco y patacón',
    descripcion: 'Secretos gastronómicos de la cuenca del Río Atrato sazonados con hierbas de azotea.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
    linkAccion: '/express',
    textoAccion: 'Pedir a Domicilio',
    verificadoEtnico: true,
  },
  {
    id: 'h4',
    creadorNombre: 'Ríos & Selva Tours',
    creadorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    creadorRol: 'Guía Local',
    municipio: 'Nuquí',
    titulo: 'Avistamiento de Ballenas Jorobadas',
    descripcion: 'Recorrido marítimo seguro por las ensenadas de Utría guiado por nativos del Chocó.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
    linkAccion: '/tours',
    textoAccion: 'Reservar Tour',
    verificadoEtnico: true,
  },
  {
    id: 'h5',
    creadorNombre: 'Colectivo Damagua',
    creadorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    creadorRol: 'Artesana Ancestral',
    municipio: 'Istmina',
    titulo: 'Tejidos de Palma Iraca y Werregue',
    descripcion: 'Creación a mano de jarrones y accesorios representativos del arte afrocolombiano.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80',
    linkAccion: '/cultura',
    textoAccion: 'Ver Galería Cultural',
    verificadoEtnico: true,
  }
]

export default function CarruselHistorias() {
  const [indiceModal, setIndiceModal] = useState<number | null>(null)

  return (
    <div className="w-full py-4 bg-white dark:bg-[#151D18] border-b border-gray-100 dark:border-white/5 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Historias del Territorio
            </h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Videos en vivo del Chocó y Colombia
          </span>
        </div>

        {/* Burbujas de historias */}
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
          {HISTORIAS_DEMO.map((h, i) => (
            <button
              key={h.id}
              onClick={() => setIndiceModal(i)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group focus:outline-none"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[3px] bg-gradient-to-tr from-[#D4A017] via-[#52B788] to-[#1B4332] group-hover:scale-105 transition-transform shadow-md">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-[#151D18]">
                  <img
                    src={h.posterUrl || h.creadorAvatar}
                    alt={h.creadorNombre}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              </div>
              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 max-w-[70px] truncate text-center">
                {h.creadorNombre}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Modal Reproductor */}
      {indiceModal !== null && (
        <ModalReelViewer
          historias={HISTORIAS_DEMO}
          indiceInicial={indiceModal}
          onClose={() => setIndiceModal(null)}
        />
      )}
    </div>
  )
}
