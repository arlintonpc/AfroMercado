'use client'

import { useEffect, useState, useCallback } from 'react'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import {
  misEventosCultura,
  crearEventoCultura,
  actualizarEventoCultura,
  crearEntradaCultura,
  eliminarEntradaCultura,
  type EventoCultural,
} from '@/lib/api/cultura'

const CATEGORIAS = ['Fiesta patronal', 'Música', 'Danza', 'Gastronomía', 'Feria', 'Carnaval', 'Encuentro cultural']

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Gestión de boletería de un evento ───────────────────────── */
function GestionEntradas({ evento, onCambio }: { evento: EventoCultural; onCambio: () => void }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [cupo, setCupo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function agregar(ev: React.FormEvent) {
    ev.preventDefault()
    if (guardando) return
    setError(null)
    if (!nombre.trim() || precio === '') {
      setError('Escribe el nombre y el precio de la entrada.')
      return
    }
    setGuardando(true)
    try {
      await crearEntradaCultura(evento.id, {
        nombre: nombre.trim(),
        precio: Number(precio),
        cupo: cupo === '' ? null : Number(cupo),
      })
      setNombre(''); setPrecio(''); setCupo('')
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear la entrada.')
    } finally {
      setGuardando(false)
    }
  }

  async function quitar(id: number) {
    await eliminarEntradaCultura(id)
    onCambio()
  }

  return (
    <div className="mt-3 rounded-xl bg-[#F7F5F2] p-3">
      <p className="text-sm font-semibold text-[#1B4332]">Boletería</p>
      {(evento.entradas ?? []).length === 0 ? (
        <p className="mt-1 text-xs text-[#1A1A1A]/55">Sin entradas. El evento es solo informativo hasta que agregues una.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {(evento.entradas ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
              <span className="text-[#1A1A1A]/80">
                {e.nombre} · {Number(e.precio) === 0 ? 'Gratis' : `$${Number(e.precio).toLocaleString('es-CO')}`}
                {e.cupo != null && <span className="text-[#1A1A1A]/45"> · cupo {e.cupo} (vendidas {e.vendidas})</span>}
              </span>
              <button onClick={() => quitar(e.id)} className="text-xs text-[#C0392B] hover:underline" aria-label={`Eliminar ${e.nombre}`}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={agregar} className="mt-2 flex flex-wrap items-end gap-2">
        <input
          type="text" placeholder="Nombre de la entrada" value={nombre} onChange={(e) => setNombre(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
        />
        <input
          type="number" min={0} placeholder="Precio" value={precio} onChange={(e) => setPrecio(e.target.value)}
          className="w-28 rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
        />
        <input
          type="number" min={1} placeholder="Cupo (opc.)" value={cupo} onChange={(e) => setCupo(e.target.value)}
          className="w-28 rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={guardando} className="rounded-full bg-[#2D6A4F] px-4 py-2 text-sm text-white disabled:opacity-60">
          {guardando ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
      {error && <p role="alert" className="mt-1 text-xs text-[#C0392B]">{error}</p>}
    </div>
  )
}

export default function ComercianteCulturaPage() {
  const [eventos, setEventos] = useState<EventoCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [departamento, setDepartamento] = useState('Chocó')
  const [municipio, setMunicipio] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [lugar, setLugar] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setEventos(await misEventosCultura())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar tus eventos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function crear(ev: React.FormEvent) {
    ev.preventDefault()
    if (creando) return
    setErrorForm(null)
    if (!titulo.trim() || !departamento || !municipio || !fechaInicio) {
      setErrorForm('Completa título, departamento, municipio y fecha de inicio.')
      return
    }
    setCreando(true)
    try {
      await crearEventoCultura({
        titulo: titulo.trim(),
        departamento,
        municipio,
        fechaInicio,
        categoria: categoria || undefined,
        fechaFin: fechaFin || undefined,
        lugar: lugar || undefined,
        descripcion: descripcion || undefined,
      })
      setTitulo(''); setCategoria(''); setFechaInicio(''); setFechaFin(''); setLugar(''); setDescripcion('')
      await cargar()
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'No pudimos crear el evento.')
    } finally {
      setCreando(false)
    }
  }

  async function togglePublicar(evento: EventoCultural) {
    const nuevo = evento.estado === 'PUBLICADO' ? 'BORRADOR' : 'PUBLICADO'
    await actualizarEventoCultura(evento.id, { estado: nuevo })
    await cargar()
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-5">
        <h1 className="font-serif text-3xl text-[#2D6A4F]">🎭 Cultura</h1>
        <p className="mt-1 text-[#1A1A1A]/65">Publica las fiestas y eventos de tu comunidad, y vende entradas.</p>
      </header>

      <form onSubmit={crear} className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
        <p className="font-semibold text-[#1B4332]">Nuevo evento</p>
        <CampoTexto label="Nombre del evento" name="titulo" placeholder="Ej: Fiestas de San Pacho" value={titulo} onChange={setTitulo} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoSelect
            label="Departamento" name="departamento" placeholder="Elige"
            value={departamento}
            onChange={(v) => { setDepartamento(v); setMunicipio('') }}
            opciones={DEPARTAMENTOS.map((d) => ({ valor: d, etiqueta: d }))}
          />
          <CampoSelect
            label="Municipio" name="municipio" placeholder={departamento ? 'Elige' : 'Primero el departamento'}
            value={municipio} onChange={setMunicipio}
            opciones={municipiosDe(departamento).map((m) => ({ valor: m, etiqueta: m }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto label="Fecha de inicio" name="fechaInicio" type="date" value={fechaInicio} onChange={setFechaInicio} />
          <CampoTexto label="Fecha de fin (opcional)" name="fechaFin" type="date" value={fechaFin} onChange={setFechaFin} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoSelect
            label="Categoría" name="categoria" placeholder="Opcional"
            value={categoria} onChange={setCategoria}
            opciones={CATEGORIAS.map((c) => ({ valor: c, etiqueta: c }))}
          />
          <CampoTexto label="Lugar (opcional)" name="lugar" placeholder="Ej: Plaza central" value={lugar} onChange={setLugar} />
        </div>
        <CampoArea label="Descripción" name="descripcion" rows={3} placeholder="Cuenta de qué se trata la fiesta." value={descripcion} onChange={setDescripcion} hint="Opcional." />
        {errorForm && <p role="alert" className="text-sm text-[#C0392B]">{errorForm}</p>}
        <button type="submit" disabled={creando} className="w-full rounded-full bg-[#1B4332] py-2.5 text-sm text-white disabled:opacity-60">
          {creando ? 'Creando…' : 'Crear evento'}
        </button>
      </form>

      <h2 className="mb-3 font-serif text-xl text-[#1B4332]">Tus eventos</h2>

      {cargando ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#1A1A1A]/5" />)}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/5 p-5 text-center text-[#C0392B]">
          {error}
        </div>
      ) : eventos.length === 0 ? (
        <p className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-8 text-center text-[#1A1A1A]/60">
          Aún no has creado eventos. ¡Crea el primero arriba!
        </p>
      ) : (
        <div className="space-y-4">
          {eventos.map((ev) => (
            <div key={ev.id} className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg text-[#1B4332]">{ev.titulo}</h3>
                  <p className="text-sm text-[#1A1A1A]/60">
                    {fmtFecha(ev.fechaInicio)} · {ev.municipio}, {ev.departamento}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    ev.estado === 'PUBLICADO' ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#1A1A1A]/8 text-[#1A1A1A]/60'
                  }`}>
                    {ev.estado === 'PUBLICADO' ? 'Publicado' : ev.estado === 'BORRADOR' ? 'Borrador' : ev.estado}
                  </span>
                  <button
                    onClick={() => togglePublicar(ev)}
                    className="rounded-full border border-[#2D6A4F] px-3 py-1 text-xs text-[#2D6A4F] hover:bg-[#2D6A4F]/10"
                  >
                    {ev.estado === 'PUBLICADO' ? 'Despublicar' : 'Publicar'}
                  </button>
                </div>
              </div>
              <GestionEntradas evento={ev} onCambio={cargar} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
