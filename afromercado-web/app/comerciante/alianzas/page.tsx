'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { obtenerMiComercio, type Comercio } from '@/components/comerciante/api'
import { Button } from '@/components/ui/Button'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import {
  listarMisAlianzas,
  crearAlianza,
  invitarSocioAlianza,
  aceptarInvitacionAlianza,
  rechazarOSalirAlianza,
  type AlianzaComercial,
  type AlianzaSocio,
  type ModuloAlianza,
  type TipoDescuentoAlianza,
  type EstadoAlianza,
} from '@/lib/api/alianza'

const MODULOS: Array<{ valor: ModuloAlianza; etiqueta: string }> = [
  { valor: 'PEDIDO', etiqueta: 'Marketplace (productos)' },
  { valor: 'EXPRESS', etiqueta: 'Express / Sabores' },
  { valor: 'HOTEL', etiqueta: 'Hoteles' },
  { valor: 'TOUR', etiqueta: 'Tours' },
  { valor: 'TRANSPORTE', etiqueta: 'Transporte' },
]

const TIPOS_DESCUENTO: Array<{ valor: TipoDescuentoAlianza; etiqueta: string }> = [
  { valor: 'PORCENTAJE', etiqueta: 'Porcentaje (%)' },
  { valor: 'VALOR_FIJO', etiqueta: 'Valor fijo ($)' },
]

const ESTILO_ESTADO: Record<EstadoAlianza, string> = {
  PENDIENTE_APROBACION: 'bg-[#D4A017]/15 text-[#9B7300]',
  PUBLICADA: 'bg-[#52B788]/15 text-[#2D6A4F]',
  RECHAZADA: 'bg-[#C0392B]/10 text-[#C0392B]',
  DESPUBLICADA: 'bg-[#1A1A1A]/10 text-[#1A1A1A]/55',
}

const ETIQUETA_ESTADO: Record<EstadoAlianza, string> = {
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  PUBLICADA: 'Publicada',
  RECHAZADA: 'Rechazada',
  DESPUBLICADA: 'Despublicada',
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function etiquetaModulo(modulo: string) {
  return MODULOS.find((m) => m.valor === modulo)?.etiqueta ?? modulo
}

function textoDescuento(socio: AlianzaSocio) {
  const valor = Number(socio.valorDescuento)
  return socio.tipoDescuento === 'PORCENTAJE' ? `${valor}% de descuento` : `$${valor.toLocaleString('es-CO')} de descuento`
}

// ── Formulario: crear alianza ────────────────────────────────────────────

function FormularioCrearAlianza({
  onCreada,
  onCancelar,
}: {
  onCreada: () => Promise<void>
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [modulo, setModulo] = useState<ModuloAlianza | ''>('')
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuentoAlianza>('PORCENTAJE')
  const [valorDescuento, setValorDescuento] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return
    setError(null)

    if (!nombre.trim()) { setError('El nombre de la alianza es obligatorio.'); return }
    if (!inicio || !fin) { setError('Indica la fecha de inicio y de fin.'); return }
    if (new Date(fin) <= new Date(inicio)) { setError('La fecha de fin debe ser posterior a la de inicio.'); return }
    if (!modulo) { setError('Elige en qué módulo participas tú.'); return }
    const valor = Number(valorDescuento)
    if (!valorDescuento || Number.isNaN(valor) || valor <= 0) { setError('Ingresa un valor de descuento mayor a cero.'); return }

    setGuardando(true)
    try {
      await crearAlianza({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        departamento: departamento || null,
        municipio: municipio || null,
        inicio,
        fin,
        modulo,
        tipoDescuento,
        valorDescuento: valor,
      })
      await onCreada()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la alianza.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 sm:p-6">
      <p className="text-base font-bold text-[#1B4332]">Nueva alianza</p>
      <p className="text-sm text-[#1A1A1A]/60">
        Únete con otros comercios bajo un mismo código de descuento compartido. Te agregas automáticamente
        como el primer socio con tu propio módulo y descuento.
      </p>

      <CampoTexto label="Nombre de la alianza" name="nombre" placeholder="Ej: Ruta del Pacífico" value={nombre} onChange={setNombre} />
      <CampoArea label="Descripción (opcional)" name="descripcion" rows={3} placeholder="Cuenta de qué se trata la alianza." value={descripcion} onChange={setDescripcion} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          label="Departamento (opcional)" name="departamento" placeholder="Toda Colombia"
          value={departamento}
          onChange={(v) => { setDepartamento(v); setMunicipio('') }}
          opciones={DEPARTAMENTOS.map((d) => ({ valor: d, etiqueta: d }))}
        />
        <CampoSelect
          label="Municipio (opcional)" name="municipio" placeholder={departamento ? 'Todo el departamento' : 'Primero el departamento'}
          value={municipio} onChange={setMunicipio}
          opciones={municipiosDe(departamento).map((m) => ({ valor: m, etiqueta: m }))}
          disabled={!departamento}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoTexto label="Fecha de inicio" name="inicio" type="date" value={inicio} onChange={setInicio} />
        <CampoTexto label="Fecha de fin" name="fin" type="date" value={fin} onChange={setFin} />
      </div>

      <div className="rounded-xl bg-[#F7F5F2] p-4">
        <p className="mb-3 text-sm font-semibold text-[#1B4332]">Tu participación (como primer socio)</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CampoSelect
            label="Tu módulo" name="modulo" placeholder="Elige"
            value={modulo} onChange={(v) => setModulo(v as ModuloAlianza)}
            opciones={MODULOS}
          />
          <CampoSelect
            label="Tipo de descuento" name="tipoDescuento"
            value={tipoDescuento} onChange={(v) => setTipoDescuento(v as TipoDescuentoAlianza)}
            opciones={TIPOS_DESCUENTO}
          />
          <CampoTexto
            label={tipoDescuento === 'PORCENTAJE' ? 'Valor (%)' : 'Valor ($)'}
            name="valorDescuento" type="number" placeholder={tipoDescuento === 'PORCENTAJE' ? 'Ej: 10' : 'Ej: 5000'}
            value={valorDescuento} onChange={setValorDescuento}
          />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-[#C0392B]">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={guardando}>Crear alianza</Button>
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
      </div>
    </form>
  )
}

// ── Formulario: invitar socio ────────────────────────────────────────────

function FormularioInvitarSocio({
  alianzaId,
  onInvitado,
  onCancelar,
}: {
  alianzaId: number
  onInvitado: () => Promise<void>
  onCancelar: () => void
}) {
  const [comercioId, setComercioId] = useState('')
  const [modulo, setModulo] = useState<ModuloAlianza | ''>('')
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuentoAlianza>('PORCENTAJE')
  const [valorDescuento, setValorDescuento] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return
    setError(null)

    const idComercio = Number(comercioId)
    if (!comercioId || !Number.isFinite(idComercio) || idComercio <= 0) {
      setError('Ingresa un ID de comercio válido.')
      return
    }
    if (!modulo) { setError('Elige el módulo en el que participará el socio invitado.'); return }
    const valor = Number(valorDescuento)
    if (!valorDescuento || Number.isNaN(valor) || valor <= 0) { setError('Ingresa un valor de descuento mayor a cero.'); return }

    setGuardando(true)
    try {
      await invitarSocioAlianza(alianzaId, { comercioId: idComercio, modulo, tipoDescuento, valorDescuento: valor })
      await onInvitado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo invitar al comercio.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mt-3 flex flex-col gap-3 rounded-xl bg-[#F7F5F2] p-4">
      <p className="text-sm font-semibold text-[#1B4332]">Invitar un comercio socio</p>
      <p className="text-xs text-[#1A1A1A]/55">
        Pídele al comercio que quieres invitar el número de ID de su tienda (lo puede ver en su propio panel).
      </p>
      <CampoTexto label="ID del comercio" name="comercioId" type="number" placeholder="Ej: 42" value={comercioId} onChange={setComercioId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CampoSelect
          label="Módulo del socio" name="moduloSocio" placeholder="Elige"
          value={modulo} onChange={(v) => setModulo(v as ModuloAlianza)}
          opciones={MODULOS}
        />
        <CampoSelect
          label="Tipo de descuento" name="tipoDescuentoSocio"
          value={tipoDescuento} onChange={(v) => setTipoDescuento(v as TipoDescuentoAlianza)}
          opciones={TIPOS_DESCUENTO}
        />
        <CampoTexto
          label={tipoDescuento === 'PORCENTAJE' ? 'Valor (%)' : 'Valor ($)'}
          name="valorDescuentoSocio" type="number" placeholder={tipoDescuento === 'PORCENTAJE' ? 'Ej: 10' : 'Ej: 5000'}
          value={valorDescuento} onChange={setValorDescuento}
        />
      </div>
      {error && <p role="alert" className="text-sm text-[#C0392B]">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" loading={guardando}>Enviar invitación</Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
      </div>
    </form>
  )
}

// ── Tarjeta de una alianza ────────────────────────────────────────────────

function TarjetaAlianza({
  alianza,
  miComercioId,
  onCambio,
}: {
  alianza: AlianzaComercial
  miComercioId: number
  onCambio: () => Promise<void>
}) {
  const [invitando, setInvitando] = useState(false)
  const [procesando, setProcesando] = useState(false)

  const esCreador = alianza.creadoPorComercioId === miComercioId
  const miFila = alianza.socios.find((s) => s.comercioId === miComercioId)
  const puedoInvitar = esCreador || Boolean(miFila?.aceptado)
  const puedoInvitarPorEstado = ['PENDIENTE_APROBACION', 'PUBLICADA'].includes(alianza.estado)

  async function retirarme() {
    if (!miFila) return
    const confirmacion = miFila.aceptado
      ? `¿Retirarte de la alianza "${alianza.nombre}"? Ya no compartirás el código con los demás socios.`
      : `¿Rechazar la invitación a "${alianza.nombre}"?`
    if (!window.confirm(confirmacion)) return
    setProcesando(true)
    try {
      await rechazarOSalirAlianza(alianza.id)
      await onCambio()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo completar la acción.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <article className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-[#1A1A1A]">{alianza.nombre}</h3>
          {alianza.descripcion && <p className="mt-1 text-sm text-[#1A1A1A]/60">{alianza.descripcion}</p>}
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${ESTILO_ESTADO[alianza.estado]}`}>
          {ETIQUETA_ESTADO[alianza.estado]}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-[#1A1A1A]/55 sm:grid-cols-3">
        <span>Código: <span className="font-mono font-bold text-[#1A1A1A]">{alianza.codigoCompartido}</span></span>
        <span>Vigencia: {fechaCorta(alianza.inicio)} - {fechaCorta(alianza.fin)}</span>
        <span>{alianza.departamento ?? 'Todo el país'}{alianza.municipio ? ` · ${alianza.municipio}` : ''}</span>
      </div>

      {alianza.estado === 'RECHAZADA' && alianza.motivoRechazo && (
        <p className="mt-3 rounded-xl bg-[#C0392B]/8 px-3 py-2 text-xs text-[#C0392B]">
          Motivo del rechazo: {alianza.motivoRechazo}
        </p>
      )}

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1A1A1A]/40">Socios</p>
        <ul className="mt-2 flex flex-col gap-2">
          {alianza.socios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F5F2] px-3 py-2 text-sm">
              <span className="text-[#1A1A1A]/85">
                {s.comercio.nombre}
                {s.comercioId === miComercioId && <span className="ml-1 font-bold text-[#2D6A4F]">(tú)</span>}
                <span className="text-[#1A1A1A]/50"> · {etiquetaModulo(s.modulo)} · {textoDescuento(s)}</span>
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                s.aceptado ? 'bg-[#52B788]/15 text-[#2D6A4F]' : 'bg-[#D4A017]/15 text-[#9B7300]'
              }`}>
                {s.aceptado ? 'Aceptó' : 'Invitación pendiente'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {puedoInvitar && puedoInvitarPorEstado && !invitando && (
          <Button variant="secondary" size="sm" onClick={() => setInvitando(true)}>
            + Invitar socio
          </Button>
        )}
        {miFila && (
          <Button variant="danger" size="sm" loading={procesando} onClick={retirarme}>
            {miFila.aceptado ? 'Retirarme' : 'Rechazar invitación'}
          </Button>
        )}
      </div>

      {invitando && (
        <FormularioInvitarSocio
          alianzaId={alianza.id}
          onInvitado={async () => { setInvitando(false); await onCambio() }}
          onCancelar={() => setInvitando(false)}
        />
      )}
    </article>
  )
}

// ── Aviso de invitaciones pendientes ─────────────────────────────────────

function AvisoInvitacionesPendientes({
  alianzas,
  miComercioId,
  onCambio,
}: {
  alianzas: AlianzaComercial[]
  miComercioId: number
  onCambio: () => Promise<void>
}) {
  const [procesandoId, setProcesandoId] = useState<number | null>(null)

  const pendientes = alianzas
    .map((a) => ({ alianza: a, socio: a.socios.find((s) => s.comercioId === miComercioId && !s.aceptado) }))
    .filter((x): x is { alianza: AlianzaComercial; socio: AlianzaSocio } => Boolean(x.socio))

  if (pendientes.length === 0) return null

  async function aceptar(alianzaId: number) {
    setProcesandoId(alianzaId)
    try {
      await aceptarInvitacionAlianza(alianzaId)
      await onCambio()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo aceptar la invitación.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function rechazar(alianzaId: number, nombre: string) {
    if (!window.confirm(`¿Rechazar la invitación a "${nombre}"?`)) return
    setProcesandoId(alianzaId)
    try {
      await rechazarOSalirAlianza(alianzaId)
      await onCambio()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo rechazar la invitación.')
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#D4A017]/35 bg-[#D4A017]/10 p-5">
      <p className="text-sm font-black text-[#9B7300]">
        Tienes {pendientes.length} invitación{pendientes.length > 1 ? 'es' : ''} de alianza sin responder
      </p>
      {pendientes.map(({ alianza, socio }) => (
        <div key={alianza.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
          <div className="text-sm text-[#1A1A1A]">
            <span className="font-bold">{alianza.nombre}</span>
            <span className="text-[#1A1A1A]/55"> · {etiquetaModulo(socio.modulo)} · {textoDescuento(socio)}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" loading={procesandoId === alianza.id} onClick={() => aceptar(alianza.id)}>
              Aceptar
            </Button>
            <Button size="sm" variant="danger" loading={procesandoId === alianza.id} onClick={() => rechazar(alianza.id, alianza.nombre)}>
              Rechazar
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────

export default function AlianzasComerciantePage() {
  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [alianzas, setAlianzas] = useState<AlianzaComercial[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const [comercioRes, alianzasRes] = await Promise.all([
        obtenerMiComercio(),
        listarMisAlianzas(),
      ])
      setComercio(comercioRes)
      setAlianzas(alianzasRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar tus alianzas.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const miComercioId = useMemo(() => comercio?.id ?? null, [comercio])

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-[#2D6A4F]">Alianzas</h1>
          <p className="mt-1 text-[#1A1A1A]/65">
            Únete con otros comercios de distintos módulos bajo un solo código de descuento compartido.
          </p>
        </div>
        {!mostrarForm && (
          <Button onClick={() => setMostrarForm(true)}>+ Crear alianza nueva</Button>
        )}
      </header>

      {error && (
        <div className="mb-5 rounded-xl border border-[#C0392B]/25 bg-[#C0392B]/5 px-4 py-3 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      {mostrarForm && (
        <div className="mb-6">
          <FormularioCrearAlianza
            onCreada={async () => { setMostrarForm(false); await cargar() }}
            onCancelar={() => setMostrarForm(false)}
          />
        </div>
      )}

      {cargando ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#1A1A1A]/5" />
          ))}
        </div>
      ) : miComercioId === null ? (
        <div className="rounded-2xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 p-6 text-center">
          <p className="font-bold text-[#2D6A4F]">Necesitas tener una tienda registrada para crear alianzas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <AvisoInvitacionesPendientes alianzas={alianzas} miComercioId={miComercioId} onCambio={cargar} />

          {alianzas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 p-6 text-center">
              <p className="font-bold text-[#2D6A4F]">Aún no participas en ninguna alianza.</p>
              <p className="mt-1 text-sm text-[#1A1A1A]/55">
                Crea una para invitar a otros comercios (hoteles, tours, restaurantes, transportes) a compartir un código de descuento.
              </p>
            </div>
          ) : (
            alianzas.map((alianza) => (
              <TarjetaAlianza key={alianza.id} alianza={alianza} miComercioId={miComercioId} onCambio={cargar} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
