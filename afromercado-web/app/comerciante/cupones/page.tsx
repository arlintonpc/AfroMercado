'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  listarMisCupones,
  crearCuponVendedor,
  desactivarCuponVendedor,
  type CuponVendedor,
  type ReglasCupon,
} from '@/components/comerciante/api'

// ── Helpers ───────────────────────────────────────────────────

function fechaLocal(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ISO para un <input type="datetime-local">
function isoLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type EstadoCupon = 'VIGENTE' | 'PROGRAMADO' | 'VENCIDO' | 'AGOTADO' | 'INACTIVO'

function estadoDe(c: CuponVendedor): EstadoCupon {
  const ahora = new Date()
  if (!c.activo) return 'INACTIVO'
  if (ahora < new Date(c.inicio)) return 'PROGRAMADO'
  if (ahora > new Date(c.fin)) return 'VENCIDO'
  if (c.usosMaximos !== null && c.usosActuales >= c.usosMaximos) return 'AGOTADO'
  return 'VIGENTE'
}

const ESTILO_ESTADO: Record<EstadoCupon, string> = {
  VIGENTE:    'bg-[#52B788]/15 text-[#2D6A4F]',
  PROGRAMADO: 'bg-[#D4A017]/15 text-[#9B7300]',
  VENCIDO:    'bg-gray-100 text-gray-500',
  AGOTADO:    'bg-gray-100 text-gray-500',
  INACTIVO:   'bg-gray-100 text-gray-500',
}

// ── Página ────────────────────────────────────────────────────

export default function CuponesPage() {
  const [cupones, setCupones] = useState<CuponVendedor[]>([])
  const [reglas, setReglas] = useState<ReglasCupon>({ permitido: true, maxPct: 50 })
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  // Formulario
  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState<'PORCENTAJE' | 'VALOR_FIJO'>('PORCENTAJE')
  const [valor, setValor] = useState('')
  const [minimoCompra, setMinimoCompra] = useState('')
  const [usosMaximos, setUsosMaximos] = useState('')
  const [usosMaximosPorUsuario, setUsosMaximosPorUsuario] = useState('1')
  const [inicio, setInicio] = useState(isoLocal(new Date()))
  const fechaFinInicial = new Date()
  fechaFinInicial.setDate(fechaFinInicial.getDate() + 14)
  const [fin, setFin] = useState(isoLocal(fechaFinInicial))
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [creando, setCreando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { items, reglas: r } = await listarMisCupones()
      setCupones(items)
      setReglas(r)
    } catch {
      /* silencioso */
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  function validarForm() {
    const e: Record<string, string> = {}
    const cod = codigo.trim()
    if (!cod) e.codigo = 'Escribe un código.'
    else if (cod.length < 3) e.codigo = 'El código debe tener al menos 3 caracteres.'
    else if (!/^[A-Za-z0-9]+$/.test(cod)) e.codigo = 'Solo letras y números, sin espacios.'

    const v = Number(valor)
    if (!valor || isNaN(v) || v <= 0) e.valor = 'Ingresa un valor mayor a cero.'
    else if (tipo === 'PORCENTAJE' && v > reglas.maxPct) e.valor = `El máximo permitido es ${reglas.maxPct}%.`

    if (!inicio) e.inicio = 'Indica la fecha de inicio.'
    if (!fin) e.fin = 'Indica la fecha de fin.'
    if (inicio && fin && new Date(fin) <= new Date(inicio)) e.fin = 'El fin debe ser posterior al inicio.'

    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!validarForm()) return
    setCreando(true)
    try {
      await crearCuponVendedor({
        codigo: codigo.trim().toUpperCase(),
        tipo,
        valor: Number(valor),
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        minimoCompra: minimoCompra ? Number(minimoCompra) : undefined,
        usosMaximos: usosMaximos ? Number(usosMaximos) : undefined,
        usosMaximosPorUsuario: usosMaximosPorUsuario ? Number(usosMaximosPorUsuario) : undefined,
      })
      setAviso({ tipo: 'exito', texto: '¡Cupón creado! Ya puedes compartir el código con tus clientes.' })
      setMostrarForm(false)
      setCodigo(''); setValor(''); setMinimoCompra(''); setUsosMaximos('')
      setUsosMaximosPorUsuario('1'); setTipo('PORCENTAJE')
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al crear el cupón.' })
    } finally {
      setCreando(false)
    }
  }

  async function handleDesactivar(id: number) {
    setProcesandoId(id)
    try {
      await desactivarCuponVendedor(id)
      setAviso({ tipo: 'exito', texto: 'Cupón desactivado.' })
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo desactivar.' })
    } finally {
      setProcesandoId(null)
    }
  }

  const inputCls = 'rounded-xl border border-[#1A1A1A]/20 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F]'

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Cupones
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Crea códigos de descuento para tu tienda. Solo aplican a tus productos.
          </p>
        </div>
        {reglas.permitido && (
          <Button onClick={() => setMostrarForm((v) => !v)} variant={mostrarForm ? 'secondary' : 'primary'}>
            {mostrarForm ? 'Cancelar' : '+ Nuevo cupón'}
          </Button>
        )}
      </div>

      {/* Cupones desactivados por la plataforma */}
      {!reglas.permitido && (
        <div className="rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/5 px-4 py-3 text-sm text-[#9B7300]">
          La creación de cupones por parte de los vendedores está desactivada por la plataforma en este momento.
          Puedes seguir viendo tus cupones existentes.
        </div>
      )}

      {/* Aviso */}
      {aviso && (
        <div className={[
          'rounded-xl border px-4 py-3 text-sm font-medium',
          aviso.tipo === 'exito'
            ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]'
            : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
        ].join(' ')}>
          {aviso.texto}
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && reglas.permitido && (
        <form
          onSubmit={handleCrear}
          className="rounded-2xl border border-[#2D6A4F]/25 bg-[#52B788]/5 p-5 sm:p-6 flex flex-col gap-4"
        >
          <h2 className="text-base font-bold text-[#1A1A1A]">Nuevo cupón</h2>

          {/* Código */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[#1A1A1A]/70">Código</label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="Ej: BIENVENIDA10"
              maxLength={20}
              className={`${inputCls} font-mono tracking-wide`}
            />
            {errores.codigo
              ? <p className="text-xs text-[#C0392B]">{errores.codigo}</p>
              : <p className="text-xs text-[#1A1A1A]/45">Tus clientes escribirán este código en el carrito.</p>}
          </div>

          {/* Tipo + valor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'PORCENTAJE' | 'VALOR_FIJO')}
                className={inputCls}
              >
                <option value="PORCENTAJE">Porcentaje (%)</option>
                <option value="VALOR_FIJO">Valor fijo ($)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">
                {tipo === 'PORCENTAJE' ? `Descuento (% · máx ${reglas.maxPct})` : 'Descuento ($)'}
              </label>
              <input
                type="number"
                min="1"
                max={tipo === 'PORCENTAJE' ? reglas.maxPct : undefined}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={tipo === 'PORCENTAJE' ? 'Ej: 10' : 'Ej: 5000'}
                className={inputCls}
              />
              {errores.valor && <p className="text-xs text-[#C0392B]">{errores.valor}</p>}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Inicio</label>
              <input
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className={inputCls}
              />
              {errores.inicio && <p className="text-xs text-[#C0392B]">{errores.inicio}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Fin</label>
              <input
                type="datetime-local"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className={inputCls}
              />
              {errores.fin && <p className="text-xs text-[#C0392B]">{errores.fin}</p>}
            </div>
          </div>

          {/* Condiciones opcionales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Compra mínima ($)</label>
              <input
                type="number" min="0"
                value={minimoCompra}
                onChange={(e) => setMinimoCompra(e.target.value)}
                placeholder="Sin mínimo"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Usos totales</label>
              <input
                type="number" min="1"
                value={usosMaximos}
                onChange={(e) => setUsosMaximos(e.target.value)}
                placeholder="Ilimitado"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[#1A1A1A]/70">Usos por cliente</label>
              <input
                type="number" min="1"
                value={usosMaximosPorUsuario}
                onChange={(e) => setUsosMaximosPorUsuario(e.target.value)}
                placeholder="1"
                className={inputCls}
              />
            </div>
          </div>

          <Button type="submit" loading={creando}>Crear cupón</Button>
        </form>
      )}

      {/* Lista de cupones */}
      {cargando ? (
        <div className="text-sm text-[#1A1A1A]/50 py-8 text-center">Cargando cupones…</div>
      ) : cupones.length === 0 ? (
        <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-8 text-center">
          <p className="text-[#1A1A1A]/50 text-sm">
            No tienes cupones todavía. {reglas.permitido && 'Crea uno para premiar a tus clientes.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cupones.map((c) => {
            const estado = estadoDe(c)
            const usos = c._count?.usos ?? c.usosActuales
            return (
              <div
                key={c.id}
                className={[
                  'rounded-2xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-4',
                  estado === 'VIGENTE' ? 'border-[#52B788]/30' : 'border-[#1A1A1A]/8 opacity-80',
                ].join(' ')}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-[#1A1A1A] tracking-wide">{c.codigo}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[estado]}`}>
                      {estado.charAt(0) + estado.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#1A1A1A]/55">
                    <span>
                      {c.tipo === 'PORCENTAJE'
                        ? `${Number(c.valor)}% de descuento`
                        : `${formatearPrecio(Number(c.valor))} de descuento`}
                    </span>
                    {c.minimoCompra != null && Number(c.minimoCompra) > 0 && (
                      <span>Mínimo: {formatearPrecio(Number(c.minimoCompra))}</span>
                    )}
                    <span>
                      Usos: {usos}{c.usosMaximos != null ? ` / ${c.usosMaximos}` : ''}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[#1A1A1A]/40">
                    {fechaLocal(c.inicio)} → {fechaLocal(c.fin)}
                  </div>
                </div>

                {estado !== 'INACTIVO' && estado !== 'VENCIDO' && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={procesandoId === c.id}
                    onClick={() => handleDesactivar(c.id)}
                  >
                    Desactivar
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
