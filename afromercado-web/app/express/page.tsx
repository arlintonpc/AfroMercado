'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { listarComerciosExpress, type ComercioExpress } from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'

const MUNICIPIOS_CHOCO = [
  'Todos','Quibdó','Istmina','Tadó','Condoto','Bagadó','Nuquí','Bahía Solano',
]

export default function ExpressPage() {
  const [comercios, setComercios] = useState<ComercioExpress[]>([])
  const [municipio, setMunicipio] = useState('Todos')
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      try {
        const data = await listarComerciosExpress(municipio === 'Todos' ? undefined : municipio)
        setComercios(data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
    const interval = setInterval(cargar, 30_000)
    return () => clearInterval(interval)
  }, [municipio])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-[#2D6A4F] transition-colors p-1 -ml-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">🍽️ Express</h1>
          <p className="text-sm text-gray-500">Pide comida y recíbela en minutos</p>
        </div>
      </div>

      {/* Filtro municipio */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {MUNICIPIOS_CHOCO.map(m => (
          <button
            key={m}
            onClick={() => setMunicipio(m)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              municipio === m
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {cargando && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!cargando && comercios.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🍳</div>
          <p className="font-medium">Ningún comercio Express abierto ahora</p>
          <p className="text-sm mt-1">Vuelve más tarde o prueba otro municipio</p>
        </div>
      )}

      <div className="space-y-3">
        {comercios.map(cfg => (
          <Link
            key={cfg.id}
            href={`/express/${cfg.comercio.id}`}
            className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-4 hover:border-green-300 hover:shadow-sm transition-all"
          >
            {cfg.comercio.logoUrl ? (
              <Image
                src={cfg.comercio.logoUrl}
                alt={cfg.comercio.nombre}
                width={56} height={56}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">
                🍽️
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-gray-900 truncate">{cfg.comercio.nombre}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  cfg.abierto ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {cfg.abierto ? 'ABIERTO' : 'CERRADO'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                📍 {cfg.comercio.municipio}
                {cfg.comercio.calificacion > 0 && ` · ⭐ ${Number(cfg.comercio.calificacion).toFixed(1)}`}
              </p>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span>⏱ ~{cfg.tiempoPrepMinutos} min</span>
                {cfg.modalidades.includes('DOMICILIO') && (
                  <span>🛵 Envío {formatearPrecio(Number(cfg.costoEnvioBase))}</span>
                )}
                {cfg.modalidades.includes('RECOGER') && <span>🏃 Recoger</span>}
              </div>
            </div>

            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Link mis pedidos */}
      <Link
        href="/express/mis-pedidos"
        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span>📦 Mis pedidos Express</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}
