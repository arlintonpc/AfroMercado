'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { municipiosDe } from '@/lib/data/colombia'

interface FeatureFlag {
  clave: string
  nombre: string
  categoria: 'VERTICAL' | 'PLATAFORMA' | 'MUNICIPIO'
  descripcion: string
  activa: boolean
  municipiosDisponibles?: string[]
}

const FLAGS_INICIALES: FeatureFlag[] = [
  {
    clave: 'flag_modulo_express',
    nombre: 'Express & Gastronomía (Sabores del Chocó)',
    categoria: 'VERTICAL',
    descripcion: 'Habilita pedidos de comida, restaurantes locales y delivery express con repartidores.',
    activa: true,
  },
  {
    clave: 'flag_modulo_hoteles',
    nombre: 'Hoteles & Alojamientos Ecológicos',
    categoria: 'VERTICAL',
    descripcion: 'Habilita reservas de habitaciones, cabañas en la selva y posadas nativas.',
    activa: true,
  },
  {
    clave: 'flag_modulo_tours',
    nombre: 'Tours, Avistamiento & Eco-Turismo',
    categoria: 'VERTICAL',
    descripcion: 'Habilita la reserva de experiencias guiadas, avistamiento de ballenas e itinerarios.',
    activa: true,
  },
  {
    clave: 'flag_modulo_transportes',
    nombre: 'Transporte Marítimo & Terrestre',
    categoria: 'VERTICAL',
    descripcion: 'Habilita reserva de pasajes de lanchas comunitarias y rutas intermunicipales.',
    activa: true,
  },
  {
    clave: 'flag_modulo_inmuebles',
    nombre: 'Bienes Raíces & Fincas Territoriales',
    categoria: 'VERTICAL',
    descripcion: 'Habilita la vitrina de alquiler y venta de propiedades territoriales.',
    activa: true,
  },
  {
    clave: 'flag_modulo_empleo',
    nombre: 'Bolsa de Empleo & Oportunidades',
    categoria: 'VERTICAL',
    descripcion: 'Habilita la publicación de ofertas laborales comunitarias y perfiles profesionales.',
    activa: true,
  },
  {
    clave: 'flag_modulo_vitrina_reels',
    nombre: 'Vitrina de Video estilo Reels / Watch',
    categoria: 'PLATAFORMA',
    descripcion: 'Habilita la reproducción vertical inmersiva de videos con tarjetas de compra en 1 clic.',
    activa: true,
  },
  {
    clave: 'flag_plataforma_wompi_real',
    nombre: 'Pasarela Wompi en Modo Producción',
    categoria: 'PLATAFORMA',
    descripcion: 'Activa cobros con dinero real vía Wompi (Nequi, Bancolombia, PSE, Tarjeta).',
    activa: true,
  },
]

export default function FeatureFlagsAdminPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(FLAGS_INICIALES)
  const [municipioSeleccionado, setMunicipioSeleccionado] = useState<string>('TODOS')
  const [cargando, setCargando] = useState(true)
  const [guardandoClave, setGuardandoClave] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  useEffect(() => {
    async function cargarConfiguraciones() {
      try {
        const res = await apiFetch<{ ok: boolean; data: { clave: string; valor: string }[] }>('/config')
        if (res.ok && Array.isArray(res.data)) {
          const mapaConfig = new Map(res.data.map((c) => [c.clave, c.valor === 'true' || c.valor === '1']))
          setFlags((prev) =>
            prev.map((flag) => ({
              ...flag,
              activa: mapaConfig.has(flag.clave) ? !!mapaConfig.get(flag.clave) : flag.activa,
            }))
          )
        }
      } catch (err) {
        console.error('Error cargando feature flags:', err)
      } finally {
        setCargando(false)
      }
    }
    cargarConfiguraciones()
  }, [])

  async function toggleFlag(baseClave: string, valorActual: boolean) {
    const claveFinal =
      municipioSeleccionado === 'TODOS'
        ? baseClave
        : `${baseClave}_${municipioSeleccionado.toLowerCase().replace(/\s+/g, '_')}`

    const nuevoValor = !valorActual
    setGuardandoClave(baseClave)

    // Optimistic UI Update
    setFlags((prev) => prev.map((f) => (f.clave === baseClave ? { ...f, activa: nuevoValor } : f)))

    try {
      await apiFetch(`/config/${claveFinal}`, {
        method: 'PUT',
        body: JSON.stringify({ valor: String(nuevoValor) }),
      })
      setMensajeExito(
        `Configuración '${claveFinal}' actualizada correctamente${
          municipioSeleccionado !== 'TODOS' ? ` para ${municipioSeleccionado}` : ''
        }.`
      )
      setTimeout(() => setMensajeExito(null), 3000)
    } catch (err) {
      console.error(`Error guardando flag ${claveFinal}:`, err)
      // Rollback on failure
      setFlags((prev) => prev.map((f) => (f.clave === baseClave ? { ...f, activa: valorActual } : f)))
    } finally {
      setGuardandoClave(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#1A1A1A] p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2D6A4F] uppercase tracking-wider">
            <Link href="/admin/config" className="hover:underline">
              Configuración General
            </Link>
            <span>/</span>
            <span>Feature Flags</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1B4332] mt-1">
            Conmutador de Módulos & Feature Flags
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Activa o desactiva funcionalidades y verticales de negocio en tiempo real sin modificar código.
          </p>
        </div>

        {/* Municipio Selector */}
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-bold text-gray-500 uppercase">Región:</span>
          <select
            value={municipioSeleccionado}
            onChange={(e) => setMunicipioSeleccionado(e.target.value)}
            className="text-xs font-bold text-[#1B4332] bg-transparent outline-none cursor-pointer"
          >
            <option value="TODOS">Todo el Departamento (Chocó)</option>
            {municipiosDe('Chocó').map((m: string) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mensajeExito && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-3 rounded-xl flex items-center justify-between animate-fade-in">
          <span>✓ {mensajeExito}</span>
        </div>
      )}

      {/* Grid of Feature Flags */}
      {cargando ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {flags.map((flag) => {
            const guardando = guardandoClave === flag.clave

            return (
              <div
                key={flag.clave}
                className={`bg-white rounded-2xl p-5 border transition-all shadow-sm hover:shadow-md flex flex-col justify-between gap-4 ${
                  flag.activa ? 'border-[#2D6A4F]/30 bg-gradient-to-br from-white to-emerald-50/20' : 'border-gray-200'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                        flag.categoria === 'VERTICAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {flag.categoria}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">{flag.clave}</span>
                  </div>

                  <h3 className="font-bold text-base text-[#1B4332]">{flag.nombre}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{flag.descripcion}</p>
                </div>

                {/* Toggle Bar */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className={`text-xs font-bold ${flag.activa ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {flag.activa ? '● Activo en producción' : '○ Desactivado'}
                  </span>

                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => toggleFlag(flag.clave, flag.activa)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      flag.activa ? 'bg-[#2D6A4F]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        flag.activa ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
