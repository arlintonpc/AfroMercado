'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  obtenerCarrito as apiObtenerCarrito,
  agregarAlCarrito as apiAgregar,
  actualizarCantidad as apiActualizar,
  eliminarDelCarrito as apiEliminar,
  vaciarCarrito as apiVaciar,
} from '@/lib/api/carrito'
import type { Carrito, CarritoItem } from '@/types/carrito'
import type { Producto } from '@/types/producto'
import { precioVigente } from '@/lib/precioProducto'

const CARRITO_KEY = 'afromercado_carrito'

interface CarritoContextValor {
  items: CarritoItem[]
  cantidadTotal: number
  subtotal: number
  cargando: boolean
  agregar: (producto: Producto, cantidad?: number) => Promise<void>
  actualizar: (productoId: string, cantidad: number) => Promise<void>
  eliminar: (productoId: string) => Promise<void>
  vaciar: () => Promise<void>
}

const CarritoContext = createContext<CarritoContextValor | undefined>(undefined)

/* ─── Helpers de localStorage ──────────────────────────────────────── */

function leerCarritoLocal(): CarritoItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CARRITO_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CarritoItem[]) : []
  } catch {
    return []
  }
}

function guardarCarritoLocal(items: CarritoItem[]) {
  try {
    window.localStorage.setItem(CARRITO_KEY, JSON.stringify(items))
  } catch {
    // noop
  }
}

function limpiarCarritoLocal() {
  try {
    window.localStorage.removeItem(CARRITO_KEY)
  } catch {
    // noop
  }
}

/* ─── Cálculos derivados ───────────────────────────────────────────── */

function calcularTotales(items: CarritoItem[]): {
  cantidadTotal: number
  subtotal: number
} {
  return items.reduce(
    (acc, it) => {
      acc.cantidadTotal += it.cantidad
      acc.subtotal += precioVigente(it.producto) * it.cantidad
      return acc
    },
    { cantidadTotal: 0, subtotal: 0 },
  )
}

/** Inserta o suma un item dentro de una lista local de items. */
function fusionarItem(
  items: CarritoItem[],
  producto: Producto,
  cantidad: number,
): CarritoItem[] {
  const idx = items.findIndex((it) => it.productoId === producto.id)
  if (idx === -1) {
    return [...items, { productoId: producto.id, cantidad, producto }]
  }
  const copia = [...items]
  copia[idx] = {
    ...copia[idx],
    cantidad: copia[idx].cantidad + cantidad,
    producto: copia[idx].producto ?? producto,
  }
  return copia
}

/* ─── Provider ─────────────────────────────────────────────────────── */

export function CarritoProvider({ children }: { children: ReactNode }) {
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [items, setItems] = useState<CarritoItem[]>([])
  const [cargando, setCargando] = useState(false)

  // Estabiliza la lista de items local para la sincronización al hacer login.
  const itemsRef = useRef<CarritoItem[]>([])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Aplica un Carrito devuelto por la API al estado local.
  const aplicarCarritoApi = useCallback((carrito: Carrito) => {
    setItems(carrito.items)
  }, [])

  /**
   * Sincroniza el carrito según el estado de autenticación:
   * - Autenticado: sube items locales pendientes al backend y carga el carrito.
   * - No autenticado: carga el carrito desde localStorage.
   * Tolera fallos del backend con fallback a localStorage.
   */
  useEffect(() => {
    if (cargandoAuth) return

    let cancelado = false

    async function sincronizar() {
      if (!autenticado) {
        // Modo invitado: carrito en localStorage.
        setItems(leerCarritoLocal())
        return
      }

      // Modo autenticado: fusionar carrito local con backend.
      setCargando(true)
      const pendientes = leerCarritoLocal()
      try {
        // Sube cada item local al backend (merge en servidor).
        for (const it of pendientes) {
          try {
            await apiAgregar(it.productoId, it.cantidad)
          } catch {
            // Si falla un item puntual seguimos con el resto.
          }
        }
        const carrito = await apiObtenerCarrito()
        if (!cancelado) {
          aplicarCarritoApi(carrito)
          limpiarCarritoLocal()
        }
      } catch {
        // Backend caído: no rompemos la app, mantenemos lo local.
        if (!cancelado) setItems(pendientes)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    sincronizar()
    return () => {
      cancelado = true
    }
  }, [autenticado, cargandoAuth, aplicarCarritoApi])

  /* ── Métodos ──────────────────────────────────────────────────── */

  const agregar = useCallback(
    async (producto: Producto, cantidad = 1) => {
      if (autenticado) {
        try {
          aplicarCarritoApi(await apiAgregar(producto.id, cantidad))
          return
        } catch {
          // fallback a local más abajo
        }
      }
      const nuevos = fusionarItem(itemsRef.current, producto, cantidad)
      setItems(nuevos)
      guardarCarritoLocal(nuevos)
    },
    [autenticado, aplicarCarritoApi],
  )

  const actualizar = useCallback(
    async (productoId: string, cantidad: number) => {
      if (cantidad <= 0) {
        // Delegamos en eliminar para cantidades no positivas.
        if (autenticado) {
          try {
            aplicarCarritoApi(await apiEliminar(productoId))
            return
          } catch {
            // fallback
          }
        }
        const nuevos = itemsRef.current.filter(
          (it) => it.productoId !== productoId,
        )
        setItems(nuevos)
        guardarCarritoLocal(nuevos)
        return
      }

      if (autenticado) {
        try {
          aplicarCarritoApi(await apiActualizar(productoId, cantidad))
          return
        } catch {
          // fallback
        }
      }
      const nuevos = itemsRef.current.map((it) =>
        it.productoId === productoId ? { ...it, cantidad } : it,
      )
      setItems(nuevos)
      guardarCarritoLocal(nuevos)
    },
    [autenticado, aplicarCarritoApi],
  )

  const eliminar = useCallback(
    async (productoId: string) => {
      if (autenticado) {
        try {
          aplicarCarritoApi(await apiEliminar(productoId))
          return
        } catch {
          // fallback
        }
      }
      const nuevos = itemsRef.current.filter(
        (it) => it.productoId !== productoId,
      )
      setItems(nuevos)
      guardarCarritoLocal(nuevos)
    },
    [autenticado, aplicarCarritoApi],
  )

  const vaciar = useCallback(async () => {
    if (autenticado) {
      try {
        aplicarCarritoApi(await apiVaciar())
        return
      } catch {
        // fallback
      }
    }
    setItems([])
    limpiarCarritoLocal()
  }, [autenticado, aplicarCarritoApi])

  const { cantidadTotal, subtotal } = calcularTotales(items)

  const valor: CarritoContextValor = {
    items,
    cantidadTotal,
    subtotal,
    cargando,
    agregar,
    actualizar,
    eliminar,
    vaciar,
  }

  return (
    <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>
  )
}

export function useCarrito(): CarritoContextValor {
  const ctx = useContext(CarritoContext)
  if (ctx === undefined) {
    throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  }
  return ctx
}
