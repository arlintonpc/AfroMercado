'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { miSolicitudRepartidor, actualizarPerfilRepartidor, type PerfilRepartidor } from '@/lib/api/repartidor'

const TIPOS_VEHICULO = [
  'Moto', 'Bicicleta', 'Carro', 'Camioneta',
  'Lancha', 'Bote', 'Canoa', 'Chalupa', 'A pie',
]

const MUNICIPIOS_CHOCO = [
  'Quibdo', 'Istmina', 'Condoto', 'Tado', 'Certegui',
  'Novita', 'Sipi', 'Jurado', 'Bahia Solano', 'Nuqui',
  'Acandi', 'Unguia', 'Carmen del Darien', 'Riosucio',
  'Bojaya', 'Medio Atrato', 'Atrato', 'Carmen de Atrato',
  'Rio Quito', 'Lloro', 'Bagado', 'El Canton del San Pablo',
  'El Carmen de Atrato', 'San Jose del Palmar', 'Bajo Baudo',
  'Medio Baudo', 'Alto Baudo',
]

export default function PerfilRepartidorPage() {
  const router = useRouter()
  const { usuario, cargando: cargandoAuth } = useAuth()

  const [form, setForm] = useState<PerfilRepartidor>({
    vehiculoTipo: '',
    vehiculoMarca: '',
    vehiculoModelo: '',
    vehiculoColor: '',
    vehiculoPlaca: '',
    vehiculoAnio: new Date().getFullYear(),
    municipioBase: '',
    municipiosExtra: [],
  })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cargandoAuth) return
    if (!usuario) { router.replace('/ingresar'); return }
    if (usuario.rol !== 'REPARTIDOR') { router.replace('/'); return }

    miSolicitudRepartidor().then(sol => {
      if (sol) {
        setForm({
          vehiculoTipo: sol.vehiculoTipo ?? '',
          vehiculoMarca: sol.vehiculoMarca ?? '',
          vehiculoModelo: sol.vehiculoModelo ?? '',
          vehiculoColor: sol.vehiculoColor ?? '',
          vehiculoPlaca: sol.vehiculoPlaca ?? '',
          vehiculoAnio: sol.vehiculoAnio ?? new Date().getFullYear(),
          municipioBase: sol.municipioBase ?? '',
          municipiosExtra: sol.municipiosExtra ?? [],
        })
      }
      setCargando(false)
    }).catch(() => setCargando(false))
  }, [usuario, cargandoAuth, router])

  function set(k: keyof PerfilRepartidor, v: unknown) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function toggleMunicipio(m: string) {
    setForm(prev => {
      const extras = prev.municipiosExtra ?? []
      return {
        ...prev,
        municipiosExtra: extras.includes(m) ? extras.filter(x => x !== m) : [...extras, m],
      }
    })
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await actualizarPerfilRepartidor(form)
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (cargandoAuth || cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F0]">
        <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#1A1A1A]/50 hover:text-[#1A1A1A]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h1 className="text-2xl text-[#2D6A4F] leading-tight" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Mi perfil
          </h1>
          <p className="text-sm text-[#1A1A1A]/55">Edita los datos de tu vehiculo y zona de operacion</p>
        </div>
      </div>

      {exito && (
        <div className="rounded-xl border border-[#52B788]/30 bg-[#52B788]/10 px-4 py-3 text-sm font-medium text-[#2D6A4F]">
          Perfil actualizado correctamente
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleGuardar} className="flex flex-col gap-5">
        {/* Vehiculo */}
        <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide">Vehiculo</p>

          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Tipo de vehiculo</label>
            <select
              value={form.vehiculoTipo}
              onChange={e => set('vehiculoTipo', e.target.value)}
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
            >
              <option value="">Seleccionar...</option>
              {TIPOS_VEHICULO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Marca', key: 'vehiculoMarca' as const, placeholder: 'Ej: Yamaha' },
              { label: 'Modelo', key: 'vehiculoModelo' as const, placeholder: 'Ej: FZ 150' },
              { label: 'Color', key: 'vehiculoColor' as const, placeholder: 'Ej: Rojo' },
              { label: 'Placa', key: 'vehiculoPlaca' as const, placeholder: 'Ej: ABC123' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">{label}</label>
                <input
                  value={(form[key] as string) ?? ''}
                  onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Ano del vehiculo</label>
            <input
              type="number"
              min={1990}
              max={new Date().getFullYear() + 1}
              value={form.vehiculoAnio ?? ''}
              onChange={e => set('vehiculoAnio', Number(e.target.value))}
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
            />
          </div>
        </div>

        {/* Zona de operacion */}
        <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold text-[#1A1A1A]/50 uppercase tracking-wide">Zona de operacion</p>

          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Municipio principal</label>
            <select
              value={form.municipioBase}
              onChange={e => set('municipioBase', e.target.value)}
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
            >
              <option value="">Seleccionar...</option>
              {MUNICIPIOS_CHOCO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-2">Municipios adicionales (opcional)</label>
            <div className="flex flex-wrap gap-2">
              {MUNICIPIOS_CHOCO.filter(m => m !== form.municipioBase).map(m => {
                const sel = (form.municipiosExtra ?? []).includes(m)
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => toggleMunicipio(m)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                      sel
                        ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                        : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/15 hover:border-[#2D6A4F]/30'
                    }`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-xl bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold py-3 text-sm transition-colors disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
