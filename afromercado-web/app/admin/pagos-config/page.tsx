'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  actualizarConfiguracionPagosAdmin,
  obtenerConfiguracionPagosAdmin,
  probarConfiguracionPagosAdmin,
  type ConfiguracionPagosAdmin,
  type ProveedorPagoAdmin,
  type ResultadoPruebaPagos,
  type VariablePagoAdmin,
} from '@/components/admin/api'
import { API_URL } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/PasswordInput'

function EstadoPunto({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${activo ? 'bg-[#2D6A4F]' : 'bg-[#C0392B]'}`}
      aria-hidden="true"
    />
  )
}

function TarjetaEstado({
  titulo,
  valor,
  descripcion,
  ok,
}: {
  titulo: string
  valor: string
  descripcion: string
  ok: boolean
}) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${ok ? 'border-[#2D6A4F]/20 bg-[#2D6A4F]/8' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-2">
        <EstadoPunto activo={ok} />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1A1A1A]/45">{titulo}</p>
      </div>
      <p className="mt-2 text-xl font-bold text-[#1A1A1A]">{valor}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#1A1A1A]/58">{descripcion}</p>
    </div>
  )
}

function Toggle({
  activo,
  onChange,
}: {
  activo: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={activo ? 'Desactivar opcion' : 'Activar opcion'}
      onClick={() => onChange(!activo)}
      className="group inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F]/35 focus-visible:ring-offset-2"
    >
      <span
        className={`relative block h-7 w-12 rounded-full border transition-all duration-200 ${
          activo
            ? 'border-[#2D6A4F] bg-[#2D6A4F] shadow-sm shadow-[#2D6A4F]/20'
            : 'border-[#1A1A1A]/15 bg-[#EDE7DD]'
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${
            activo ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

function VariableRow({ item }: { item: VariablePagoAdmin }) {
  const label = item.alternativa ? `${item.nombre} / ${item.alternativa}` : item.nombre
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-[#1A1A1A]/8 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <EstadoPunto activo={item.configurada} />
          <code className="text-xs font-semibold text-[#1A1A1A]">{label}</code>
          {item.requerida && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
              Requerida
            </span>
          )}
          {item.vieneDeDefault && (
            <span className="rounded-full bg-[#1A1A1A]/6 px-2 py-0.5 text-[10px] font-bold uppercase text-[#1A1A1A]/45">
              Default
            </span>
          )}
          {item.fuente && item.fuente !== 'NONE' && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#1A1A1A]/45">
              {item.fuente}
            </span>
          )}
        </div>
        {item.problema && <p className="mt-1 text-xs text-[#C0392B]">{item.problema}</p>}
      </div>
      <span className="text-xs font-medium text-[#1A1A1A]/45">
        {item.configurada ? item.preview || 'Configurada' : 'No configurada'}
      </span>
    </li>
  )
}

type WompiForm = {
  WOMPI_PUBLIC_KEY: string
  WOMPI_INTEGRITY_SECRET: string
  WOMPI_EVENTS_SECRET: string
  WOMPI_PAYOUTS_API_URL: string
  WOMPI_PAYOUTS_API_KEY: string
  WOMPI_PAYOUTS_USER_PRINCIPAL_ID: string
  WOMPI_PAYOUTS_ACCOUNT_ID: string
  WOMPI_PAYOUTS_PAYMENT_TYPE: string
  WOMPI_PAYOUT_BANK_MAP: string
}

const WOMPI_FORM_INICIAL: WompiForm = {
  WOMPI_PUBLIC_KEY: '',
  WOMPI_INTEGRITY_SECRET: '',
  WOMPI_EVENTS_SECRET: '',
  WOMPI_PAYOUTS_API_URL: '',
  WOMPI_PAYOUTS_API_KEY: '',
  WOMPI_PAYOUTS_USER_PRINCIPAL_ID: '',
  WOMPI_PAYOUTS_ACCOUNT_ID: '',
  WOMPI_PAYOUTS_PAYMENT_TYPE: '',
  WOMPI_PAYOUT_BANK_MAP: '',
}

function CampoWompi({
  label,
  name,
  value,
  onChange,
  placeholder,
  secreto = false,
}: {
  label: string
  name: keyof WompiForm
  value: string
  onChange: (name: keyof WompiForm, value: string) => void
  placeholder: string
  secreto?: boolean
}) {
  const inputClassName = 'h-11 px-3 rounded-xl border border-[#1A1A1A]/12 bg-white text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/28 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25 focus:border-[#2D6A4F]'

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#1A1A1A]/60">{label}</span>
      {secreto ? (
        <PasswordInput
          value={value}
          onChange={(v) => onChange(name, v)}
          placeholder={placeholder}
          inputClassName={inputClassName}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
      )}
    </label>
  )
}

function GrupoVariables({ titulo, items }: { titulo: string; items: VariablePagoAdmin[] }) {
  if (!items.length) return null
  const listas = items.filter((item) => item.configurada).length
  return (
    <section className="rounded-2xl border border-[#1A1A1A]/8 bg-[#FDFBF7] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-[#1A1A1A]">{titulo}</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1A1A1A]/55">
          {listas}/{items.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => <VariableRow key={`${item.grupo}-${item.nombre}`} item={item} />)}
      </ul>
    </section>
  )
}

function agruparVariables(variables: VariablePagoAdmin[]) {
  return {
    general: variables.filter((item) => item.grupo === 'general'),
    checkout: variables.filter((item) => item.grupo === 'checkout'),
    webhook: variables.filter((item) => item.grupo === 'webhook'),
    dispersion: variables.filter((item) => item.grupo === 'dispersion'),
  }
}

export default function PaginaConfiguracionPagos() {
  const [config, setConfig] = useState<ConfiguracionPagosAdmin | null>(null)
  const [proveedor, setProveedor] = useState<ProveedorPagoAdmin>('SANDBOX')
  const [manuales, setManuales] = useState(false)
  const [wompi, setWompi] = useState<WompiForm>(WOMPI_FORM_INICIAL)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoPruebaPagos | null>(null)

  useEffect(() => {
    obtenerConfiguracionPagosAdmin()
      .then((data) => {
        setConfig(data)
        setProveedor(data.proveedor)
        setManuales(data.pagosManualesHabilitados)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la configuracion.'))
      .finally(() => setCargando(false))
  }, [])

  const grupos = useMemo(() => agruparVariables(config?.variables || []), [config])
  const webhookUrl = `${API_URL.replace(/\/$/, '')}/pagos/webhooks/wompi`
  const wompiTieneCambios = Object.values(wompi).some((v) => v.trim().length > 0)
  const cambiosPendientes = Boolean(config && (
    proveedor !== config.proveedor ||
    manuales !== config.pagosManualesHabilitados ||
    wompiTieneCambios
  ))

  function cambiarWompi(name: keyof WompiForm, value: string) {
    setWompi((actual) => ({ ...actual, [name]: value }))
  }

  function wompiPayload() {
    const payload: Partial<WompiForm> = {}
    for (const [key, value] of Object.entries(wompi) as Array<[keyof WompiForm, string]>) {
      const limpio = value.trim()
      if (limpio) payload[key] = limpio
    }
    return payload
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    setAviso(null)
    setResultado(null)
    try {
      const data = await actualizarConfiguracionPagosAdmin({
        proveedor,
        pagosManualesHabilitados: manuales,
        ...(wompiTieneCambios ? { wompi: wompiPayload() } : {}),
      })
      setConfig(data)
      setProveedor(data.proveedor)
      setManuales(data.pagosManualesHabilitados)
      setWompi(WOMPI_FORM_INICIAL)
      setAviso('Configuracion guardada. Los nuevos pagos usaran esta seleccion.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la configuracion.')
    } finally {
      setGuardando(false)
    }
  }

  async function probar() {
    setProbando(true)
    setError(null)
    setResultado(null)
    try {
      setResultado(await probarConfiguracionPagosAdmin())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo probar la configuracion.')
    } finally {
      setProbando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-xs text-[#1A1A1A]/40 transition-colors hover:text-[#2D6A4F]">
          Panel admin
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1
              className="text-3xl text-[#1A1A1A]"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              Configuracion de pagos
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#1A1A1A]/55">
              Controla la pasarela activa, revisa credenciales y valida si Teravia esta listo para cobrar y dispersar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={probar} loading={probando} disabled={cargando}>
              Probar configuracion
            </Button>
            <Button onClick={guardar} loading={guardando} disabled={cargando || !cambiosPendientes}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/8 px-5 py-4 text-sm text-[#C0392B]">
          {error}
        </div>
      )}
      {aviso && (
        <div className="rounded-2xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/8 px-5 py-4 text-sm font-medium text-[#2D6A4F]">
          {aviso}
        </div>
      )}

      {cargando ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-[#1A1A1A]/8 bg-white" />
          ))}
        </div>
      ) : config && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <TarjetaEstado
              titulo="Proveedor activo"
              valor={config.proveedor}
              descripcion={`Fuente: ${config.proveedorFuente}. SANDBOX prueba; WOMPI cobra dinero real.`}
              ok={config.proveedor === 'WOMPI' ? config.listoParaCobroReal : true}
            />
            <TarjetaEstado
              titulo="Cobro real"
              valor={config.listoParaCobroReal ? 'Listo' : 'Pendiente'}
              descripcion={config.listoParaCobroReal ? 'Variables requeridas presentes.' : 'Revisa credenciales y advertencias.'}
              ok={config.listoParaCobroReal}
            />
            <TarjetaEstado
              titulo="Pagos manuales"
              valor={config.pagosManualesHabilitados ? 'Habilitados' : 'Deshabilitados'}
              descripcion={`Fuente: ${config.pagosManualesFuente}. Recomendado: deshabilitados en produccion.`}
              ok={!config.pagosManualesHabilitados}
            />
          </div>

          <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1A1A1A]/40">
                Control operativo
              </p>
              <h2 className="mt-2 text-xl font-bold text-[#1A1A1A]">Seleccion de pasarela</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {config.proveedoresDisponibles.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setProveedor(item)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                      proveedor === item
                        ? 'border-[#2D6A4F] bg-[#2D6A4F]/8'
                        : 'border-[#1A1A1A]/10 bg-[#FDFBF7] hover:border-[#2D6A4F]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1A1A1A]">{item}</span>
                      <span className={`h-4 w-4 rounded-full border ${proveedor === item ? 'border-[#2D6A4F] bg-[#2D6A4F]' : 'border-[#1A1A1A]/20'}`} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/55">
                      {item === 'SANDBOX'
                        ? 'Modo seguro para pruebas internas. No mueve dinero real.'
                        : 'Modo productivo. Requiere Wompi y Pagos a Terceros activos.'}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-[#1A1A1A]/8 bg-[#FDFBF7] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">Pagos manuales</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#1A1A1A]/55">
                      Si esta apagado, el comprador solo puede pagar por pasarela.
                    </p>
                  </div>
                  <Toggle activo={manuales} onChange={setManuales} />
                </div>
              </div>
            </div>

            <aside className="rounded-3xl border border-[#1A1A1A]/8 bg-[#1A1A1A] p-5 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Webhook Wompi</p>
              <h2 className="mt-2 text-xl font-bold">URL para registrar</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Esta URL debe ir en el dashboard de Wompi. El pedido solo se confirma por webhook firmado.
              </p>
              <code className="mt-4 block rounded-2xl bg-white/10 p-3 text-xs leading-relaxed text-white/85 break-all">
                {webhookUrl}
              </code>
              <p className="mt-4 text-xs leading-relaxed text-white/45">
                No pegues llaves secretas en capturas o chats. La pantalla solo muestra previews enmascarados.
              </p>
            </aside>
          </section>

          <section className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1A1A1A]/40">
                  Formulario Wompi
                </p>
                <h2 className="mt-2 text-xl font-bold text-[#1A1A1A]">Credenciales de produccion</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#1A1A1A]/55">
                  Pega solo los campos que quieras crear o cambiar. Los campos vacios no modifican la configuracion guardada.
                </p>
              </div>
              <span className="rounded-full bg-[#F8F5F0] px-3 py-1 text-xs font-semibold text-[#1A1A1A]/50">
                Secretos enmascarados
              </span>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-[#1A1A1A]/8 bg-[#FDFBF7] p-4">
                <h3 className="font-semibold text-[#1A1A1A]">Checkout</h3>
                <div className="mt-3 flex flex-col gap-3">
                  <CampoWompi
                    label="Llave publica"
                    name="WOMPI_PUBLIC_KEY"
                    value={wompi.WOMPI_PUBLIC_KEY}
                    onChange={cambiarWompi}
                    placeholder="pub_prod_..."
                  />
                  <CampoWompi
                    label="Secreto de integridad"
                    name="WOMPI_INTEGRITY_SECRET"
                    value={wompi.WOMPI_INTEGRITY_SECRET}
                    onChange={cambiarWompi}
                    placeholder="prod_integrity_..."
                    secreto
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#1A1A1A]/8 bg-[#FDFBF7] p-4">
                <h3 className="font-semibold text-[#1A1A1A]">Webhook</h3>
                <div className="mt-3 flex flex-col gap-3">
                  <CampoWompi
                    label="Secreto de eventos"
                    name="WOMPI_EVENTS_SECRET"
                    value={wompi.WOMPI_EVENTS_SECRET}
                    onChange={cambiarWompi}
                    placeholder="prod_events_..."
                    secreto
                  />
                  <p className="rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-[#1A1A1A]/50">
                    Registra la URL del bloque negro en el dashboard de Wompi.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#1A1A1A]/8 bg-[#FDFBF7] p-4">
                <h3 className="font-semibold text-[#1A1A1A]">Pagos a terceros</h3>
                <div className="mt-3 flex flex-col gap-3">
                  <CampoWompi
                    label="API URL"
                    name="WOMPI_PAYOUTS_API_URL"
                    value={wompi.WOMPI_PAYOUTS_API_URL}
                    onChange={cambiarWompi}
                    placeholder="https://api.payouts.wompi.co/v1"
                  />
                  <CampoWompi
                    label="API Key"
                    name="WOMPI_PAYOUTS_API_KEY"
                    value={wompi.WOMPI_PAYOUTS_API_KEY}
                    onChange={cambiarWompi}
                    placeholder="API key"
                    secreto
                  />
                  <CampoWompi
                    label="User principal ID"
                    name="WOMPI_PAYOUTS_USER_PRINCIPAL_ID"
                    value={wompi.WOMPI_PAYOUTS_USER_PRINCIPAL_ID}
                    onChange={cambiarWompi}
                    placeholder="ID usuario principal"
                    secreto
                  />
                  <CampoWompi
                    label="Account ID origen"
                    name="WOMPI_PAYOUTS_ACCOUNT_ID"
                    value={wompi.WOMPI_PAYOUTS_ACCOUNT_ID}
                    onChange={cambiarWompi}
                    placeholder="Cuenta origen de dispersion"
                    secreto
                  />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-[#1A1A1A]/60">Tipo de pago</span>
                    <select
                      value={wompi.WOMPI_PAYOUTS_PAYMENT_TYPE}
                      onChange={(e) => cambiarWompi('WOMPI_PAYOUTS_PAYMENT_TYPE', e.target.value)}
                      className="h-11 rounded-xl border border-[#1A1A1A]/12 bg-white px-3 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
                    >
                      <option value="">No cambiar</option>
                      <option value="PROVIDERS">PROVIDERS</option>
                      <option value="PAYROLL">PAYROLL</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#1A1A1A]/8 bg-[#FDFBF7] p-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#1A1A1A]/60">Mapa de bancos opcional</span>
                <textarea
                  value={wompi.WOMPI_PAYOUT_BANK_MAP}
                  onChange={(e) => cambiarWompi('WOMPI_PAYOUT_BANK_MAP', e.target.value)}
                  rows={3}
                  placeholder='{"BANCOLOMBIA":"bank-id-wompi","NEQUI":"bank-id-wompi"}'
                  className="rounded-xl border border-[#1A1A1A]/12 bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/28 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
                />
              </label>
              <p className="mt-2 text-xs leading-relaxed text-[#1A1A1A]/45">
                Solo llenalo si Wompi te entrega IDs de banco distintos a los codigos documentados.
              </p>
            </div>
          </section>

          {resultado && (
            <section className={`rounded-2xl border px-5 py-4 ${resultado.ok ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center gap-2">
                <EstadoPunto activo={resultado.ok} />
                <h2 className="font-bold text-[#1A1A1A]">{resultado.mensaje}</h2>
              </div>
              {resultado.detalles.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 text-sm text-[#1A1A1A]/62">
                  {resultado.detalles.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          )}

          {config.advertencias.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <h2 className="font-bold text-amber-900">Advertencias antes de produccion</h2>
              <ul className="mt-3 flex flex-col gap-1 text-sm text-amber-800">
                {config.advertencias.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            <GrupoVariables titulo="General" items={grupos.general} />
            <GrupoVariables titulo="Checkout" items={grupos.checkout} />
            <GrupoVariables titulo="Webhook" items={grupos.webhook} />
            <GrupoVariables titulo="Dispersion" items={grupos.dispersion} />
          </section>
        </>
      )}
    </div>
  )
}
