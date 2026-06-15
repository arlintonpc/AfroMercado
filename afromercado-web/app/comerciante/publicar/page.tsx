'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import {
  crearProducto,
  listarCategorias,
  obtenerMiComercio,
  type CategoriaComerciante,
} from '@/components/comerciante/api'
import { UNIDADES, ALCANCES, type Alcance } from '@/components/comerciante/constantes'
import { formatearPrecio } from '@/lib/formatearPrecio'

export default function PublicarProductoPage() {
  const router = useRouter()

  const [verificando, setVerificando] = useState(true)

  const [categorias, setCategorias] = useState<CategoriaComerciante[]>([])

  // Campos del formulario
  const [nombre, setNombre] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [unidad, setUnidad] = useState('')
  const [stock, setStock] = useState('')
  const [diasMin, setDiasMin] = useState('')
  const [diasMax, setDiasMax] = useState('')
  const [alcance, setAlcance] = useState<Alcance | ''>('')

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Verificar que tiene comercio; si no, redirigir a registro-comercio.
  useEffect(() => {
    let activo = true
    obtenerMiComercio()
      .then((c) => {
        if (!activo) return
        if (!c) router.replace('/comerciante/registro-comercio')
        else setVerificando(false)
      })
      .catch(() => {
        if (activo) setVerificando(false)
      })
    return () => {
      activo = false
    }
  }, [router])

  // Cargar categorías (solo informativo; "Del Campo" es la activa).
  useEffect(() => {
    let activo = true
    listarCategorias()
      .then((cats) => {
        if (activo) setCategorias(cats.filter((c) => c.activa))
      })
      .catch(() => {
        /* silencioso */
      })
    return () => {
      activo = false
    }
  }, [])

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!nombre.trim()) e.nombre = 'Escribe el nombre del producto.'
    if (!categoriaId) e.categoriaId = 'Elige una categoría.'

    const precioNum = Number(precio.replace(/\D/g, ''))
    if (!precio.trim()) e.precio = '¿Cuánto cuesta? Escribe el precio.'
    else if (!precioNum || precioNum <= 0)
      e.precio = 'El precio debe ser mayor que cero.'

    if (!unidad) e.unidad = '¿Cómo lo vendes? Elige una opción.'

    const stockNum = Number(stock.replace(/\D/g, ''))
    if (!stock.trim()) e.stock = 'Escribe cuántos tienes.'
    else if (stockNum < 1) e.stock = 'Debes tener al menos 1 para vender.'

    const minNum = Number(diasMin.replace(/\D/g, ''))
    const maxNum = Number(diasMax.replace(/\D/g, ''))
    if (!diasMin.trim()) e.diasMin = 'Escribe los días mínimos.'
    if (!diasMax.trim()) e.diasMax = 'Escribe los días máximos.'
    else if (diasMin.trim() && maxNum < minNum)
      e.diasMax = 'El máximo no puede ser menor que el mínimo.'

    if (!alcance) e.alcance = '¿Hasta dónde quieres vender? Elige una opción.'

    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function manejarSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setErrorGeneral(null)
    if (enviando) return
    if (!validar()) return

    setEnviando(true)
    try {
      const nuevo = await crearProducto({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        precio: Number(precio.replace(/\D/g, '')),
        unidad,
        stock: Number(stock.replace(/\D/g, '')),
        diasAlistamientoMin: Number(diasMin.replace(/\D/g, '')),
        diasAlistamientoMax: Number(diasMax.replace(/\D/g, '')),
        alcance: alcance as Alcance,
        fotoUrl: '',
      })
      // Tras publicar, vamos a editar para que el comerciante agregue fotos.
      router.replace(`/comerciante/productos/${nuevo.id}/editar?nuevo=1`)
    } catch (err) {
      setErrorGeneral(
        err instanceof Error
          ? err.message
          : 'No pudimos publicar tu producto. Intenta de nuevo.',
      )
      setEnviando(false)
    }
  }

  if (verificando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-base text-[#1A1A1A]/55">Un momento…</p>
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
          Publicar producto
        </h1>
        <p className="mt-2 text-base text-[#1A1A1A]/65 leading-relaxed">
          Llena los datos de lo que quieres vender. Es fácil.
        </p>
      </div>

      <form
        onSubmit={manejarSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 sm:p-6 shadow-sm"
        noValidate
      >
        <CampoTexto
          label="¿Qué vas a vender?"
          name="nombre"
          placeholder="Ej: Borojó fresco"
          value={nombre}
          onChange={setNombre}
          error={errores.nombre}
        />

        <CampoSelect
          label="¿Qué tipo de producto es?"
          name="categoria"
          placeholder="Elige una categoría"
          value={categoriaId}
          onChange={setCategoriaId}
          opciones={categorias.map((c) => ({
            valor: String(c.id),
            etiqueta: c.nombre,
          }))}
          error={errores.categoriaId}
        />

        <CampoArea
          label="Descríbelo"
          name="descripcion"
          rows={4}
          placeholder="Ej: Borojó maduro, dulce y fresco, recién cosechado."
          value={descripcion}
          onChange={setDescripcion}
          hint="Opcional. Cuéntale al comprador cómo es tu producto."
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

        <CampoSelect
          label="¿Cómo lo vendes?"
          name="unidad"
          placeholder="Elige una opción"
          value={unidad}
          onChange={setUnidad}
          opciones={UNIDADES.map((u) => ({ valor: u.valor, etiqueta: u.etiqueta }))}
          error={errores.unidad}
          hint="Por ejemplo: por kilo, por unidad, por manojo…"
        />

        <CampoTexto
          label="¿Cuántos tienes disponibles?"
          name="stock"
          inputMode="numeric"
          placeholder="0"
          value={stock}
          onChange={(v) => setStock(v.replace(/\D/g, ''))}
          error={errores.stock}
        />

        <div>
          <p className="mb-1.5 text-base font-semibold text-[#1A1A1A]">
            ¿En cuántos días lo tienes listo?
          </p>
          <p className="mb-2 text-sm text-[#1A1A1A]/55">
            Ej: el borojó necesita madurar unos días.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <CampoTexto
              label="Mínimo (días)"
              name="diasMin"
              inputMode="numeric"
              placeholder="1"
              value={diasMin}
              onChange={(v) => setDiasMin(v.replace(/\D/g, ''))}
              error={errores.diasMin}
            />
            <CampoTexto
              label="Máximo (días)"
              name="diasMax"
              inputMode="numeric"
              placeholder="3"
              value={diasMax}
              onChange={(v) => setDiasMax(v.replace(/\D/g, ''))}
              error={errores.diasMax}
            />
          </div>
        </div>

        {/* Alcance: botones grandes */}
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
          {errores.alcance && (
            <p role="alert" className="mt-1.5 text-sm text-[#C0392B]">
              {errores.alcance}
            </p>
          )}
        </fieldset>

        {/* Ayuda para la foto */}
        <div className="rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/10 px-4 py-3">
          <p className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h3l2-2h6l2 2h3v12H4V7z"
                stroke="#D4A017"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.2" stroke="#D4A017" strokeWidth="1.8" />
            </svg>
            Consejo para una buena foto
          </p>
          <p className="mt-1.5 text-sm text-[#1A1A1A]/70 leading-relaxed">
            Toma la foto con buena luz, de día, y muestra el producto de cerca.
            Apenas publiques, podrás subir tus fotos.
          </p>
        </div>

        {errorGeneral && (
          <div
            role="alert"
            className="rounded-xl bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]"
          >
            {errorGeneral}
          </div>
        )}

        <Button type="submit" size="lg" loading={enviando} className="w-full">
          Publicar producto
        </Button>
      </form>
    </div>
  )
}
