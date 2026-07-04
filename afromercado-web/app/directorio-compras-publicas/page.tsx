'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import { listarDirectorioComprasPublicas, type ProveedorDirectorio } from '@/lib/api/directorio'

const ETIQUETA_TIPO: Record<string, string> = {
  CONSEJO_COMUNITARIO: 'Consejo Comunitario',
  RESGUARDO_INDIGENA: 'Resguardo Indígena',
  ZONA_RESERVA_CAMPESINA: 'Zona de Reserva Campesina',
  OTRA: 'Otra organización territorial',
}

export default function DirectorioComprasPublicasPage() {
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [proveedores, setProveedores] = useState<ProveedorDirectorio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    listarDirectorioComprasPublicas({
      departamento: departamento || undefined,
      municipio: municipio || undefined,
    })
      .then(setProveedores)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No pudimos cargar el directorio.'))
      .finally(() => setCargando(false))
  }, [departamento, municipio])

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F7F5F2]">
        <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[#D4A017] text-xs font-semibold tracking-widest uppercase mb-2">
              Compra pública local
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              Directorio de proveedores certificados
            </h1>
            <p className="text-white/75 text-lg max-w-xl mx-auto leading-relaxed">
              Entidades públicas (alcaldías, gobernaciones) pueden encontrar aquí productores y
              comercios verificados de AfroMercado para sus procesos de contratación de mínima cuantía.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-[#E8DCC8] p-5 text-sm text-gray-600 leading-relaxed mb-8">
            Este directorio conecta entidades públicas con proveedores certificados. La compra y
            facturación ocurren fuera de AfroMercado, según las reglas de contratación pública vigentes
            (SECOP II). AfroMercado no participa en el proceso de contratación ni en el pago.
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={departamento}
              onChange={(e) => { setDepartamento(e.target.value); setMunicipio('') }}
              className="rounded-xl border border-[#E8DCC8] bg-white px-4 py-2 text-sm"
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
              className="rounded-xl border border-[#E8DCC8] bg-white px-4 py-2 text-sm disabled:opacity-50"
            >
              <option value="">Todos los municipios</option>
              {municipiosDe(departamento).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">
              {error}
            </div>
          )}

          {cargando && (
            <p className="text-center text-sm text-gray-400 py-8">Buscando proveedores...</p>
          )}

          {!cargando && proveedores.length === 0 && !error && (
            <p className="text-center text-sm text-gray-400 py-8">
              No hay proveedores certificados para este filtro todavía.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {proveedores.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-[#E8DCC8] p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-[#1A1A1A]">{p.nombre}</h3>
                  {p.verificadoEtnico && (
                    <span className="shrink-0 rounded-full bg-[#FDF6E3] border border-[#F4C842] text-[#854D0E] text-[10px] font-semibold px-2 py-0.5">
                      Comunidad étnica
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.municipio}{p.departamento ? `, ${p.departamento}` : ''}
                </p>
                {p.organizacionTerritorialTipo && (
                  <p className="text-xs text-[#2D6A4F] font-medium mt-1">
                    {ETIQUETA_TIPO[p.organizacionTerritorialTipo] ?? p.organizacionTerritorialTipo}
                  </p>
                )}
                {p.descripcion && (
                  <p className="text-sm text-gray-500 leading-relaxed mt-2 line-clamp-2">{p.descripcion}</p>
                )}
                {p.productos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Array.from(new Set(p.productos.map((it) => it.categoria?.nombre).filter(Boolean))).map((cat) => (
                      <span key={cat} className="text-[11px] bg-[#F7F5F2] text-gray-600 rounded-full px-2 py-0.5">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                {p.whatsappVisible && p.whatsapp && (
                  <a
                    href={`https://wa.me/57${p.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-[#1B4332] hover:underline"
                  >
                    Contactar por WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
