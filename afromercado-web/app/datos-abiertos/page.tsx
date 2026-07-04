'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  listarDatasetsAbiertos,
  urlDescargaDatosAbiertos,
  type DatasetAbierto,
} from '@/lib/api/datosabiertos'

const DATASET_A_ENDPOINT: Record<string, 'municipios' | 'departamentos'> = {
  'comercios-por-municipio': 'municipios',
  'comercios-por-departamento': 'departamentos',
}

function formatearFecha(fechaIso: string): string {
  try {
    return new Date(`${fechaIso}T00:00:00`).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
    })
  } catch {
    return fechaIso
  }
}

export default function DatosAbiertosPage() {
  const [datasets, setDatasets] = useState<DatasetAbierto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarDatasetsAbiertos()
      .then(setDatasets)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los datasets.'))
      .finally(() => setCargando(false))
  }, [])

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F7F5F2]">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[#D4A017] text-xs font-semibold tracking-widest uppercase mb-2">
              Transparencia
            </p>
            <h1
              className="text-3xl md:text-4xl font-bold mb-3"
              style={{ fontFamily: 'var(--font-dm-serif)' }}
            >
              Datos Abiertos de AfroMercado
            </h1>
            <p className="text-white/75 text-lg max-w-xl mx-auto leading-relaxed">
              Publicamos cifras agregadas de comercios, pedidos y volumen de ventas por región,
              con corte mensual, para que comunidades, investigadores y entidades públicas puedan
              consultarlas libremente.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Nota metodológica */}
          <div className="bg-white rounded-2xl border border-[#E8DCC8] p-5 md:p-6 mb-8">
            <h2
              className="text-lg font-bold text-[#1A1A1A] mb-2"
              style={{ fontFamily: 'var(--font-dm-serif)' }}
            >
              Qué incluyen estos datos
            </h2>
            <ul className="text-sm text-gray-500 leading-relaxed list-disc pl-5 space-y-1">
              <li>Número de comercios activos y verificados por región.</li>
              <li>Número de pedidos confirmados.</li>
              <li>Volumen de ventas (GMV) — nunca la comisión de la plataforma, que es información interna.</li>
              <li>
                Los municipios con menos de 5 comercios se agrupan a nivel departamental para evitar
                identificar cifras de un comercio en particular.
              </li>
              <li>Cada dataset corresponde al mes calendario más reciente ya cerrado (no al mes en curso).</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">
              {error}
            </div>
          )}

          {cargando && (
            <p className="text-center text-sm text-gray-400 py-8">Cargando datasets...</p>
          )}

          <div className="grid gap-4">
            {datasets.map((ds) => {
              const endpoint = DATASET_A_ENDPOINT[ds.id]
              return (
                <div key={ds.id} className="bg-white rounded-2xl border border-[#E8DCC8] p-5 md:p-6">
                  <h3
                    className="font-bold text-[#1A1A1A] text-lg mb-1"
                    style={{ fontFamily: 'var(--font-dm-serif)' }}
                  >
                    {ds.nombre}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{ds.descripcion}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-5">
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide">Frecuencia</p>
                      <p className="font-semibold text-[#1A1A1A] capitalize">{ds.frecuencia}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide">Cobertura</p>
                      <p className="font-semibold text-[#1A1A1A]">{ds.cobertura}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide">Licencia</p>
                      <p className="font-semibold text-[#1A1A1A]">{ds.licencia}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide">Corte</p>
                      <p className="font-semibold text-[#1A1A1A] capitalize">
                        {formatearFecha(ds.ultimaActualizacion)}
                      </p>
                    </div>
                  </div>

                  {endpoint && (
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={urlDescargaDatosAbiertos(endpoint, 'json')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#2D6A4F] transition-colors"
                      >
                        Descargar JSON
                      </a>
                      <a
                        href={urlDescargaDatosAbiertos(endpoint, 'csv')}
                        className="inline-flex items-center gap-2 bg-white text-[#1B4332] text-sm font-semibold px-4 py-2 rounded-xl border border-[#1B4332] hover:bg-[#1B4332]/5 transition-colors"
                      >
                        Descargar CSV
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Licencia */}
          <div className="mt-8 bg-[#1B4332] rounded-2xl p-8 text-center text-white">
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              Licencia CC BY 4.0
            </h3>
            <p className="text-white/70 text-sm max-w-xl mx-auto">
              Puedes usar, compartir y adaptar estos datos libremente, incluso con fines comerciales,
              siempre que menciones a AfroMercado como fuente.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
