'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import { listarDirectorio, type ComercioDirectorio, type PaginacionDirectorio } from '@/lib/api/directorio'

const ETIQUETA_TIPO: Record<string, string> = {
  CONSEJO_COMUNITARIO: 'Consejo Comunitario',
  RESGUARDO_INDIGENA: 'Resguardo Indígena',
  ZONA_RESERVA_CAMPESINA: 'Zona de Reserva Campesina',
  OTRA: 'Otra organización territorial',
}

function TarjetaComercio({ c }: { c: ComercioDirectorio }) {
  const rating = Number(c.calificacion)
  const categorias = Array.from(new Set(c.productos.map(p => p.categoria?.nombre).filter(Boolean)))

  return (
    <Link href={`/directorio/${c.id}`} className="block bg-white rounded-2xl border border-[#E8DCC8] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="flex items-start gap-3">
        {c.logoUrl ? (
          <img src={c.logoUrl} alt={c.nombre} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-[#F0EBE3] flex items-center justify-center text-xl font-bold text-[#2D6A4F] flex-shrink-0">
            {c.nombre.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-[#1A1A1A] truncate">{c.nombre}</h3>
            {c.verificadoEtnico && (
              <span className="shrink-0 rounded-full bg-[#FDF6E3] border border-[#F4C842] text-[#854D0E] text-[10px] font-semibold px-2 py-0.5">
                Comunidad étnica
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {c.municipio}{c.departamento ? `, ${c.departamento}` : ''}
          </p>
          {rating > 0 && (
            <p className="text-xs text-[#D4A017] font-semibold mt-1">
              ★ {rating.toFixed(1)} <span className="text-gray-400 font-normal">({c.totalReviews})</span>
            </p>
          )}
        </div>
      </div>

      {c.organizacionTerritorialTipo && (
        <p className="text-xs text-[#2D6A4F] font-medium mt-2">
          {ETIQUETA_TIPO[c.organizacionTerritorialTipo] ?? c.organizacionTerritorialTipo}
        </p>
      )}
      {c.descripcion && (
        <p className="text-sm text-gray-500 leading-relaxed mt-2 line-clamp-2">{c.descripcion}</p>
      )}
      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {categorias.map((cat) => (
            <span key={cat} className="text-[11px] bg-[#F7F5F2] text-gray-600 rounded-full px-2 py-0.5">{cat}</span>
          ))}
        </div>
      )}
    </Link>
  )
}

export default function DirectorioPage() {
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [buscarInput, setBuscarInput] = useState('')
  const [buscar, setBuscar] = useState('')
  const [page, setPage] = useState(1)
  const [comercios, setComercios] = useState<ComercioDirectorio[]>([])
  const [paginacion, setPaginacion] = useState<PaginacionDirectorio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    listarDirectorio({
      departamento: departamento || undefined,
      municipio: municipio || undefined,
      buscar: buscar || undefined,
      page,
    })
      .then(({ data, paginacion }) => { setComercios(data); setPaginacion(paginacion) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No pudimos cargar el directorio.'))
      .finally(() => setCargando(false))
  }, [departamento, municipio, buscar, page])

  useEffect(() => { setPage(1) }, [departamento, municipio, buscar])

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F7F5F2]">
        <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[#D4A017] text-xs font-semibold tracking-widest uppercase mb-2">
              Directorio empresarial
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              Encuentra comercios verificados de tu territorio
            </h1>
            <p className="text-white/75 text-lg max-w-xl mx-auto leading-relaxed">
              Comercios, productores y prestadores de servicio ya verificados en Teravia — busca por nombre o filtra por ubicación.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              value={buscarInput}
              onChange={(e) => setBuscarInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setBuscar(buscarInput) }}
              onBlur={() => setBuscar(buscarInput)}
              placeholder="Buscar por nombre..."
              className="flex-1 rounded-xl border border-[#E8DCC8] bg-white px-4 py-2.5 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={departamento}
                onChange={(e) => { setDepartamento(e.target.value); setMunicipio('') }}
                className="flex-1 sm:flex-none rounded-xl border border-[#E8DCC8] bg-white px-4 py-2.5 text-sm"
              >
                <option value="">Todos los departamentos</option>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                disabled={!departamento}
                className="flex-1 sm:flex-none rounded-xl border border-[#E8DCC8] bg-white px-4 py-2.5 text-sm disabled:opacity-50"
              >
                <option value="">Todos los municipios</option>
                {municipiosDe(departamento).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {paginacion && !cargando && (
            <p className="text-sm text-gray-400 mb-4">{paginacion.total} comercio{paginacion.total !== 1 ? 's' : ''} encontrado{paginacion.total !== 1 ? 's' : ''}</p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">{error}</div>
          )}

          {cargando && (
            <p className="text-center text-sm text-gray-400 py-8">Buscando comercios...</p>
          )}

          {!cargando && comercios.length === 0 && !error && (
            <p className="text-center text-sm text-gray-400 py-8">No hay comercios para este filtro todavía.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {comercios.map((c) => <TarjetaComercio key={c.id} c={c} />)}
          </div>

          {paginacion && paginacion.totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl border border-[#E8DCC8] bg-white text-sm disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-500">Página {page} de {paginacion.totalPaginas}</span>
              <button
                disabled={page >= paginacion.totalPaginas}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl border border-[#E8DCC8] bg-white text-sm disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
