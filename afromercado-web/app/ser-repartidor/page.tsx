'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'
import { MUNICIPIOS_CHOCO } from '@/components/comerciante/constantes'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Solicitud {
  id: number
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  vehiculoTipo: string
  vehiculoMarca: string
  vehiculoModelo: string
  vehiculoPlaca: string
  vehiculoAnio: number
  notasAdmin: string | null
  createdAt: string
}

const TIPOS_VEHICULO = [
  { valor: 'MOTO',      etiqueta: '🏍️ Moto' },
  { valor: 'BICICLETA', etiqueta: '🚲 Bicicleta' },
  { valor: 'CARRO',     etiqueta: '🚗 Carro' },
  { valor: 'CAMIONETA', etiqueta: '🚙 Camioneta' },
  { valor: 'TRICIMOTO', etiqueta: '🛺 Tricimoto' },
]

// ─── Estado de solicitud existente ───────────────────────────────────────────

function BannerEstado({ solicitud }: { solicitud: Solicitud }) {
  if (solicitud.estado === 'APROBADA') {
    return (
      <div className="rounded-2xl border border-[#52B788]/30 bg-[#52B788]/10 px-6 py-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#2D6A4F] text-white text-2xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-[#2D6A4F]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          ¡Solicitud aprobada!
        </h2>
        <p className="mt-2 text-[#1A1A1A]/60 text-sm">
          Ya tienes acceso al panel de repartidor. Inicia sesión para empezar a tomar entregas.
        </p>
        <Link href="/repartidor" className="mt-5 inline-block">
          <Button>Ir al panel de repartidor</Button>
        </Link>
      </div>
    )
  }

  if (solicitud.estado === 'PENDIENTE') {
    return (
      <div className="rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/8 px-6 py-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#D4A017]/20 text-[#9B7300] text-2xl">
          ⏳
        </div>
        <h2 className="text-2xl font-bold text-[#9B7300]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Solicitud en revisión
        </h2>
        <p className="mt-2 text-[#1A1A1A]/60 text-sm max-w-sm mx-auto">
          Recibimos tu solicitud. El equipo de AfroMercado está revisando tu información y te avisará pronto.
        </p>
        <div className="mt-4 rounded-xl bg-white border border-[#D4A017]/20 px-4 py-3 text-sm text-left inline-block">
          <p className="text-[#1A1A1A]/50 text-xs mb-1">Vehículo registrado</p>
          <p className="font-semibold text-[#1A1A1A]">
            {solicitud.vehiculoTipo} · {solicitud.vehiculoMarca} {solicitud.vehiculoModelo} · <span className="text-[#2D6A4F]">{solicitud.vehiculoPlaca}</span>
          </p>
        </div>
      </div>
    )
  }

  // RECHAZADA
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl">
        ✕
      </div>
      <h2 className="text-2xl font-bold text-red-700" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
        Solicitud rechazada
      </h2>
      {solicitud.notasAdmin && (
        <p className="mt-2 text-sm text-red-600 max-w-sm mx-auto">
          Motivo: {solicitud.notasAdmin}
        </p>
      )}
      <p className="mt-3 text-sm text-[#1A1A1A]/50">
        Puedes corregir tu información y enviar una nueva solicitud.
      </p>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SerRepartidorPage() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()

  const [solicitudExistente, setSolicitudExistente] = useState<Solicitud | null | undefined>(undefined)
  const [cargando, setCargando] = useState(true)

  // Campos del formulario
  const [tipo, setTipo]               = useState('')
  const [marca, setMarca]             = useState('')
  const [modelo, setModelo]           = useState('')
  const [color, setColor]             = useState('')
  const [placa, setPlaca]             = useState('')
  const [anio, setAnio]               = useState('')
  const [licencia, setLicencia]       = useState('')
  const [municipioBase, setMunicipioBase] = useState('')

  const [errores, setErrores]         = useState<Record<string, string>>({})
  const [errorGen, setErrorGen]       = useState<string | null>(null)
  const [enviando, setEnviando]       = useState(false)
  const [enviado, setEnviado]         = useState(false)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/ser-repartidor')
    }
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    apiFetch<{ ok: boolean; data: Solicitud | null }>('/repartidor/mi-solicitud')
      .then((res) => setSolicitudExistente(res.data))
      .catch(() => setSolicitudExistente(null))
      .finally(() => setCargando(false))
  }, [cargandoAuth, autenticado])

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!tipo)          e.tipo     = 'Selecciona el tipo de vehículo.'
    if (!marca.trim())  e.marca    = 'Escribe la marca.'
    if (!modelo.trim()) e.modelo   = 'Escribe el modelo.'
    if (!color.trim())  e.color    = 'Escribe el color.'
    if (!placa.trim())  e.placa    = 'Escribe la placa.'
    const anioNum = parseInt(anio)
    if (!anio.trim() || anioNum < 1990 || anioNum > new Date().getFullYear() + 1)
      e.anio = 'Año inválido.'
    if (!licencia.trim()) e.licencia = 'Escribe el número de licencia.'
    if (!municipioBase) e.municipioBase = 'Indica tu municipio de operación principal.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validar()) return
    setEnviando(true)
    setErrorGen(null)
    try {
      const res = await apiFetch<{ ok: boolean; data: Solicitud }>('/repartidor/solicitar', {
        method: 'POST',
        body: {
          vehiculoTipo: tipo, vehiculoMarca: marca, vehiculoModelo: modelo,
          vehiculoColor: color, vehiculoPlaca: placa, vehiculoAnio: parseInt(anio),
          licenciaNumero: licencia, municipioBase,
        },
      })
      setSolicitudExistente(res.data)
      setEnviado(true)
    } catch (err) {
      setErrorGen(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
    } finally {
      setEnviando(false)
    }
  }

  const mostrarFormulario =
    !solicitudExistente ||
    (solicitudExistente.estado === 'RECHAZADA' && !enviado)

  if (cargandoAuth || cargando) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-[#1A1A1A]/50 text-sm">Cargando…</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-10 pb-16">
        {/* Encabezado */}
        <div className="mb-8 text-center">
          <h1
            className="text-4xl text-[#2D6A4F]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Sé repartidor
          </h1>
          <p className="mt-2 text-base text-[#1A1A1A]/60 max-w-sm mx-auto">
            Lleva productos de los emprendedores del Chocó a sus compradores. Tú pones el vehículo, nosotros la plataforma.
          </p>
        </div>

        {/* Estado si ya hay solicitud */}
        {solicitudExistente && (solicitudExistente.estado !== 'RECHAZADA' || enviado) && (
          <BannerEstado solicitud={solicitudExistente} />
        )}

        {/* Formulario */}
        {mostrarFormulario && (
          <>
            {solicitudExistente?.estado === 'RECHAZADA' && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Tu solicitud anterior fue rechazada
                {solicitudExistente.notasAdmin ? `: ${solicitudExistente.notasAdmin}` : '.'} Corrige la información y reenvía.
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-6 flex flex-col gap-5 shadow-sm"
            >
              <h2 className="text-lg font-bold text-[#1A1A1A]">Datos de tu vehículo</h2>

              {/* Tipo de vehículo */}
              <div>
                <p className="mb-2 text-sm font-semibold text-[#1A1A1A]">Tipo de vehículo</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TIPOS_VEHICULO.map((t) => (
                    <button
                      key={t.valor} type="button"
                      onClick={() => setTipo(t.valor)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                        tipo === t.valor
                          ? 'border-[#2D6A4F] bg-[#2D6A4F]/8 text-[#2D6A4F]'
                          : 'border-[#1A1A1A]/15 text-[#1A1A1A]/70 hover:border-[#2D6A4F]/40'
                      }`}
                    >
                      {t.etiqueta}
                    </button>
                  ))}
                </div>
                {errores.tipo && <p className="mt-1 text-xs text-red-600">{errores.tipo}</p>}
              </div>

              {/* Marca / Modelo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Marca</label>
                  <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ej: Honda"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.marca ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
                  />
                  {errores.marca && <p className="mt-1 text-xs text-red-600">{errores.marca}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Modelo</label>
                  <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ej: CB 125"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.modelo ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
                  />
                  {errores.modelo && <p className="mt-1 text-xs text-red-600">{errores.modelo}</p>}
                </div>
              </div>

              {/* Color / Año */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Color</label>
                  <input type="text" value={color} onChange={(e) => setColor(e.target.value)}
                    placeholder="Ej: Rojo"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.color ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
                  />
                  {errores.color && <p className="mt-1 text-xs text-red-600">{errores.color}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Año</label>
                  <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)}
                    placeholder="Ej: 2019" min={1990} max={new Date().getFullYear() + 1}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.anio ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
                  />
                  {errores.anio && <p className="mt-1 text-xs text-red-600">{errores.anio}</p>}
                </div>
              </div>

              {/* Placa */}
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Placa</label>
                <input
                  type="text" value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  placeholder="Ej: ABC123"
                  maxLength={7}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm font-mono tracking-widest focus:border-[#2D6A4F] focus:outline-none ${errores.placa ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
                />
                {errores.placa && <p className="mt-1 text-xs text-red-600">{errores.placa}</p>}
                <p className="mt-1 text-xs text-[#1A1A1A]/40">
                  El admin verificará la placa en el RUNT antes de aprobar.
                </p>
              </div>

              <div className="border-t border-[#1A1A1A]/8 pt-4">
                <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">Licencia de conducción</h2>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Número de licencia</label>
                  <input type="text" value={licencia} onChange={(e) => setLicencia(e.target.value)}
                    placeholder="Ej: 10234567"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none ${errores.licencia ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
                  />
                  {errores.licencia && <p className="mt-1 text-xs text-red-600">{errores.licencia}</p>}
                </div>
              </div>

              <div className="border-t border-[#1A1A1A]/8 pt-4">
                <h2 className="text-lg font-bold text-[#1A1A1A] mb-1">Zona de operación</h2>
                <p className="text-xs text-[#1A1A1A]/50 mb-4">
                  Indica dónde operas. El admin lo usa para asignarte entregas.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Municipio principal</label>
                  <select
                    value={municipioBase}
                    onChange={(e) => setMunicipioBase(e.target.value)}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:border-[#2D6A4F] focus:outline-none bg-white ${errores.municipioBase ? 'border-red-400' : 'border-[#1A1A1A]/15'}`}
                  >
                    <option value="">Elige tu municipio…</option>
                    {MUNICIPIOS_CHOCO.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  {errores.municipioBase && <p className="mt-1 text-xs text-red-600">{errores.municipioBase}</p>}
                </div>
              </div>

              {errorGen && (
                <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {errorGen}
                </div>
              )}

              <Button type="submit" size="lg" loading={enviando} className="w-full">
                Enviar solicitud
              </Button>

              <p className="text-xs text-[#1A1A1A]/40 text-center leading-relaxed">
                Al enviar autorizas a AfroMercado a verificar la información de tu vehículo y licencia.
                La aprobación puede tardar 1–2 días hábiles.
              </p>
            </form>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
