'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { obtenerMiComercio, listarMisProductos, type Comercio, type ProductoComerciante } from '@/components/comerciante/api'
import {
  listarMisPublicacionesVitrina,
  actualizarMiPublicacionVitrina,
  type ModuloOrigenVitrina,
  type PublicacionCultural,
} from '@/lib/api/cultura'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const OPCIONES_MODULO: Array<{ valor: ModuloOrigenVitrina | ''; etiqueta: string }> = [
  { valor: '', etiqueta: 'Ninguno en particular' },
  { valor: 'PEDIDO', etiqueta: 'Marketplace (productos)' },
  { valor: 'EXPRESS', etiqueta: 'Express / Sabores' },
  { valor: 'HOTEL', etiqueta: 'Hoteles' },
  { valor: 'TOUR', etiqueta: 'Tours' },
  { valor: 'TRANSPORTE', etiqueta: 'Transporte' },
  { valor: 'AGRO', etiqueta: 'Agro' },
]

export default function EditarVitrinaPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id)

  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [productos, setProductos] = useState<ProductoComerciante[]>([])
  const [publicacion, setPublicacion] = useState<PublicacionCultural | null>(null)

  const [cargando, setCargando] = useState(true)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [moduloOrigen, setModuloOrigen] = useState<ModuloOrigenVitrina | ''>('')
  const [productoId, setProductoId] = useState<string>('')
  
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setErrorGlobal(null)
    try {
      const c = await obtenerMiComercio()
      setComercio(c)
      if (!c) throw new Error('Todavía no tienes una tienda registrada.')

      const [misProds, resPubs] = await Promise.all([
        listarMisProductos(),
        listarMisPublicacionesVitrina({ page: 1 }) // Buscamos en la página 1 (idealmente habría un getById, usaremos esto temporalmente y buscamos si no está)
      ])
      
      setProductos(misProds.filter(p => p.activo))
      
      // Intentamos encontrar la publicación. Si hay mucha paginación, este enfoque simple puede fallar.
      // Pero como no tenemos un endpoint obtenerMiPublicacionVitrinaById específico y obtenerVitrina es público (y puede estar inactiva),
      // iteraremos hasta encontrarla o asumimos que está en la primera. Para producción, un endpoint getByID es mejor.
      // Si el backend escaneara, fetch(`/api/cultura/publicaciones/${id}`) traería incluso si es inactiva? No, es público.
      // Usamos el listado para encontrarla.
      let pub = resPubs.items.find(p => p.id === id)
      let page = 2
      const tamanoPagina = resPubs.items.length || 20
      const totalPaginas = Math.ceil(resPubs.total / tamanoPagina)
      while (!pub && page <= totalPaginas) {
        const next = await listarMisPublicacionesVitrina({ page })
        pub = next.items.find(p => p.id === id)
        page++
      }

      if (!pub) {
        throw new Error('Publicación no encontrada.')
      }

      setPublicacion(pub)
      setTitulo(pub.titulo)
      setDescripcion(pub.descripcion || '')
      setModuloOrigen((pub.moduloOrigen as ModuloOrigenVitrina) || '')
      setProductoId(pub.producto?.id ? String(pub.producto.id) : '')

    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : 'No pudimos cargar los datos.')
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  async function guardar() {
    if (enviando) return
    if (!titulo.trim()) { setError('Escribe un título para tu publicación.'); return }

    setEnviando(true)
    setError('')
    try {
      await actualizarMiPublicacionVitrina(id, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        moduloOrigen: moduloOrigen || undefined,
        productoId: productoId ? Number(productoId) : undefined,
      })
      router.push('/comerciante/vitrina')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos actualizar tu video.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (errorGlobal || !publicacion) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div role="alert" className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/5 p-5 text-center text-[#C0392B]">
          {errorGlobal || 'Publicación no encontrada.'}
        </div>
        <div className="mt-4 text-center">
          <Link href="/comerciante/vitrina">
            <Button variant="secondary">Volver a Vitrina</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-5 flex items-center gap-4">
        <Link href="/comerciante/vitrina" className="rounded-full bg-white p-2 shadow-sm border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-[#1A1A1A]">Editar Video</h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Actualiza la información de tu publicación en la Vitrina.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 space-y-4">
        
        <div className="flex gap-4 p-4 rounded-xl bg-[#F8F5F0]">
            <div className="w-16 h-20 bg-gray-200 rounded-lg overflow-hidden shrink-0">
               {publicacion.videoPosterUrl ? (
                 // eslint-disable-next-line @next/next/no-img-element
                 <img src={publicacion.videoPosterUrl} alt="miniatura" className="w-full h-full object-cover" />
               ) : (
                 <div className="flex items-center justify-center h-full text-gray-400">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                 </div>
               )}
            </div>
            <div className="flex flex-col justify-center text-sm text-[#1A1A1A]/60">
                <p>El archivo del video no puede modificarse. Si necesitas cambiar el video en sí, elimina esta publicación y crea una nueva.</p>
            </div>
        </div>

        <CampoTexto
          label="Título"
          name="titulo"
          placeholder="Ej: Así es una noche en nuestro hotel"
          value={titulo}
          onChange={setTitulo}
        />

        <CampoArea
          label="Descripción"
          name="descripcion"
          placeholder="Cuéntales a tus clientes qué van a ver…"
          value={descripcion}
          onChange={setDescripcion}
          rows={4}
          hint="Opcional."
        />

        <CampoSelect
          label="Módulo relacionado"
          name="moduloOrigen"
          value={moduloOrigen}
          onChange={(v) => setModuloOrigen(v as ModuloOrigenVitrina | '')}
          opciones={OPCIONES_MODULO.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
          hint="Opcional — ayuda a los usuarios a saber de qué servicio se trata."
        />

        {productos.length > 0 && (
          <CampoSelect
            label="Producto asociado (opcional)"
            name="productoId"
            value={productoId}
            onChange={setProductoId}
            opciones={[
              { valor: '', etiqueta: 'Ninguno' },
              ...productos.map(p => ({ valor: String(p.id), etiqueta: `${p.nombre} - $${p.precio}` }))
            ]}
            hint="Selecciona un producto para mostrar su precio y enlace de compra directamente sobre el video."
          />
        )}

        {error && <p role="alert" className="text-sm text-[#C0392B]">{error}</p>}

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#1A1A1A]/10">
          <Link href="/comerciante/vitrina">
            <Button variant="secondary" type="button" disabled={enviando}>Cancelar</Button>
          </Link>
          <Button variant="primary" type="button" onClick={guardar} loading={enviando}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}
