'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { CampoTexto, CampoArea } from '@/components/comerciante/Campos'
import {
  obtenerMiProducto,
  actualizarProducto,
  type ProductoComerciante,
} from '@/components/comerciante/api'
import SubidorImagenes from '@/components/comerciante/SubidorImagenes'
import { ALCANCES, etiquetaUnidad, type Alcance } from '@/components/comerciante/constantes'
import { formatearPrecio } from '@/lib/formatearPrecio'

export default function EditarProductoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const idNum = Number(params.id)

  const [producto, setProducto] = useState<ProductoComerciante | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)

  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [stock, setStock] = useState('')
  const [alcance, setAlcance] = useState<Alcance>('LOCAL')
  const [pesoKg, setPesoKg] = useState('')

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [esNuevo, setEsNuevo] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setEsNuevo(new URLSearchParams(window.location.search).get('nuevo') === '1')
    }
  }, [])

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      try {
        const p = Number.isFinite(idNum) ? await obtenerMiProducto(idNum) : null
        if (!activo) return
        if (!p) {
          setNoEncontrado(true)
          return
        }
        setProducto(p)
        setDescripcion(p.descripcion ?? '')
        setPrecio(String(Number(p.precio)))
        setStock(String(p.stock))
        setAlcance(p.alcance)
        setPesoKg(p.pesoKg !== undefined && p.pesoKg !== null ? String(Number(p.pesoKg)) : '')
      } catch (err) {
        if (activo)
          setErrorGeneral(
            err instanceof Error ? err.message : 'No pudimos cargar el producto.',
          )
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [idNum])

  function validar(): boolean {
    const e: Record<string, string> = {}
    const precioNum = Number(precio.replace(/\D/g, ''))
    if (!precio.trim()) e.precio = 'Escribe el precio.'
    else if (precioNum <= 0) e.precio = 'El precio debe ser mayor que cero.'
    if (!stock.trim()) e.stock = 'Escribe cuántos tienes.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function manejarSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setErrorGeneral(null)
    if (guardando || !producto) return
    if (!validar()) return

    setGuardando(true)
    try {
      const pesoKgNum = pesoKg.trim() ? Number(pesoKg) : null
      await actualizarProducto(producto.id, {
        descripcion: descripcion.trim(),
        precio: Number(precio.replace(/\D/g, '')),
        stock: Number(stock.replace(/\D/g, '')),
        alcance,
        pesoKg: pesoKgNum !== null && pesoKgNum > 0 ? pesoKgNum : null,
      })
      router.replace('/comerciante/dashboard')
    } catch (err) {
      setErrorGeneral(
        err instanceof Error ? err.message : 'No pudimos guardar los cambios.',
      )
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-base text-[#1A1A1A]/55">Cargando producto…</p>
      </div>
    )
  }

  if (noEncontrado) {
    return (
      <div className="mx-auto w-full max-w-xl py-10 text-center">
        <p
          className="text-2xl text-[#2D6A4F]"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          No encontramos ese producto
        </p>
        <p className="mt-2 text-base text-[#1A1A1A]/60">
          Quizás fue eliminado o no es tuyo.
        </p>
        <div className="mt-5 flex justify-center">
          <Button onClick={() => router.replace('/comerciante/dashboard')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    )
  }

  const precioVista = Number(precio.replace(/\D/g, ''))

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6">
        <h1
          className="text-3xl text-[#2D6A4F] leading-tight"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Editar producto
        </h1>
        {producto && (
          <p className="mt-2 text-base text-[#1A1A1A]/65">
            {producto.nombre} · se vende por{' '}
            {etiquetaUnidad(producto.unidad).toLowerCase()}
          </p>
        )}
      </div>

      {esNuevo && (
        <div className="mb-4 rounded-xl bg-[#52B788]/12 border border-[#52B788]/30 px-4 py-3 text-sm text-[#2D6A4F]">
          ✅ ¡Producto publicado! Agrega algunas fotos para que se vea mejor.
        </div>
      )}

      <form
        onSubmit={manejarSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 sm:p-6 shadow-sm"
        noValidate
      >
        {producto && (
          <>
            <SubidorImagenes
              productoId={producto.id}
              fotoUrlInicial={producto.fotoUrl}
              imagenesIniciales={producto.imagenes ?? []}
            />
            <div className="h-px bg-[#1A1A1A]/10" />
          </>
        )}

        <CampoArea
          label="Descríbelo"
          name="descripcion"
          rows={4}
          placeholder="Cuéntale al comprador cómo es tu producto."
          value={descripcion}
          onChange={setDescripcion}
        />

        <div>
          <CampoTexto
            label="¿Cuánto cuesta?"
            name="precio"
            inputMode="numeric"
            prefijo="$"
            placeholder="0"
            value={precio}
            onChange={(v) => setPrecio(v.replace(/\D/g, ''))}
            error={errores.precio}
          />
          {precioVista > 0 && !errores.precio && (
            <p className="mt-1 text-sm font-semibold text-[#2D6A4F]">
              {formatearPrecio(precioVista)}
            </p>
          )}
        </div>

        <CampoTexto
          label="¿Cuántos tienes disponibles?"
          name="stock"
          inputMode="numeric"
          placeholder="0"
          value={stock}
          onChange={(v) => setStock(v.replace(/\D/g, ''))}
          error={errores.stock}
        />

        <CampoTexto
          label="Peso aproximado (kg)"
          name="pesoKg"
          inputMode="decimal"
          placeholder="Ej: 0.5"
          value={pesoKg}
          onChange={(v) => setPesoKg(v.replace(/[^0-9.]/g, ''))}
          hint="Opcional. Se usa para calcular el costo de envío."
        />

        <fieldset>
          <legend className="mb-2 text-base font-semibold text-[#1A1A1A]">
            ¿Hasta dónde quieres vender?
          </legend>
          <div className="flex flex-col gap-2.5">
            {ALCANCES.map((op) => {
              const activo = alcance === op.valor
              return (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => setAlcance(op.valor)}
                  aria-pressed={activo}
                  className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                    activo
                      ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                      : 'border-[#1A1A1A]/15 bg-white'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      activo ? 'border-[#2D6A4F]' : 'border-[#1A1A1A]/30'
                    }`}
                    aria-hidden="true"
                  >
                    {activo && <span className="h-2.5 w-2.5 rounded-full bg-[#2D6A4F]" />}
                  </span>
                  <span>
                    <span className="block text-base font-semibold text-[#1A1A1A]">
                      {op.etiqueta}
                    </span>
                    <span className="block text-sm text-[#1A1A1A]/60">
                      {op.descripcion}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {errorGeneral && (
          <div
            role="alert"
            className="rounded-xl bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]"
          >
            {errorGeneral}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" size="lg" loading={guardando} className="w-full sm:flex-1">
            Guardar cambios
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.replace('/comerciante/dashboard')}
            className="w-full sm:flex-1"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
