'use client'

import { useState } from 'react'
import { formatearPrecio } from '@/lib/formatearPrecio'
import type { MenuComercioExpress } from '@/lib/api/express'

type Grupo = NonNullable<MenuComercioExpress['productos'][0]['gruposComplemento']>[0]
type ItemComp = Grupo['items'][0]

// cantidad por itemId
type Seleccion = Record<number, number>

interface Props {
  producto: MenuComercioExpress['productos'][0]
  onConfirmar: (complementos: Array<{ nombre: string; precio: number }>, precioTotal: number) => void
  onCerrar: () => void
}

export default function ModalComplementos({ producto, onConfirmar, onCerrar }: Props) {
  const grupos = producto.gruposComplemento ?? []
  const [seleccion, setSeleccion] = useState<Seleccion>({})

  const precioBase = Number(producto.precio)

  // Total de extras: suma (precio * cantidad) de cada ítem seleccionado
  const precioExtras = Object.entries(seleccion).reduce((s, [idStr, cant]) => {
    for (const g of grupos) {
      const item = g.items.find(i => i.id === Number(idStr))
      if (item) return s + Number(item.precio) * cant
    }
    return s
  }, 0)

  const precioTotal = precioBase + precioExtras

  function totalEnGrupo(grupoId: number) {
    const grupo = grupos.find(g => g.id === grupoId)
    if (!grupo) return 0
    return grupo.items.reduce((s, i) => s + (seleccion[i.id] ?? 0), 0)
  }

  function sumar(grupo: Grupo, item: ItemComp) {
    const total = totalEnGrupo(grupo.id)
    if (total >= grupo.maximo) return
    setSeleccion(prev => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))
  }

  function restar(item: ItemComp) {
    setSeleccion(prev => {
      const actual = prev[item.id] ?? 0
      if (actual <= 0) return prev
      if (actual === 1) {
        const next = { ...prev }
        delete next[item.id]
        return next
      }
      return { ...prev, [item.id]: actual - 1 }
    })
  }

  function puedeConfirmar() {
    return grupos.every(g => totalEnGrupo(g.id) >= g.minimo)
  }

  function confirmar() {
    const complementos: Array<{ nombre: string; precio: number }> = []
    for (const g of grupos) {
      for (const item of g.items) {
        const cant = seleccion[item.id] ?? 0
        for (let i = 0; i < cant; i++) {
          complementos.push({ nombre: item.nombre, precio: Number(item.precio) })
        }
      }
    }
    onConfirmar(complementos, precioTotal)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b flex-shrink-0">
          {producto.fotoUrl && (
            <img src={producto.fotoUrl} alt={producto.nombre}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-lg leading-tight truncate">{producto.nombre}</h2>
            <p className="text-sm text-[#2D6A4F] font-semibold">{formatearPrecio(precioBase)}</p>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-xl font-bold flex-shrink-0"
          >×</button>
        </div>

        {/* Grupos */}
        <div className="overflow-y-auto flex-1">
          {grupos.map(grupo => {
            const totalGrupo = totalEnGrupo(grupo.id)
            const grupoLleno = totalGrupo >= grupo.maximo
            return (
              <div key={grupo.id} className="border-b last:border-0">
                {/* Cabecera grupo */}
                <div className="px-5 py-3 bg-gray-50 sticky top-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-800 text-sm">{grupo.nombre}</p>
                    {grupo.requerido && totalGrupo < grupo.minimo && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">Requerido</span>
                    )}
                    {totalGrupo > 0 && (
                      <span className="text-xs bg-[#2D6A4F]/10 text-[#2D6A4F] px-2 py-0.5 rounded-full font-semibold">
                        {totalGrupo} seleccionado{totalGrupo > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {grupo.requerido ? 'Requerido' : 'Opcional'}
                    {grupo.maximo === 1 ? ' · Elige 1' : ` · Máx ${grupo.maximo}`}
                  </p>
                </div>

                {/* Ítems */}
                {grupo.items.map(item => {
                  const cant = seleccion[item.id] ?? 0
                  const puedeAgregar = !grupoLleno || cant > 0
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 transition ${!puedeAgregar && cant === 0 ? 'opacity-40' : ''}`}
                    >
                      {/* Miniatura */}
                      {item.imagenUrl ? (
                        <img
                          src={item.imagenUrl}
                          alt={item.nombre}
                          className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-sm"
                        />
                      ) : item.icono ? (
                        <span className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0 border border-gray-100">
                          {item.icono}
                        </span>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex-shrink-0 border border-gray-100" />
                      )}

                      {/* Nombre + precio */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-tight">{item.nombre}</p>
                        {item.precio > 0 && (
                          <p className="text-xs text-[#2D6A4F] font-semibold mt-0.5">+{formatearPrecio(item.precio)}</p>
                        )}
                      </div>

                      {/* Selector cantidad */}
                      {cant === 0 ? (
                        <button
                          onClick={() => sumar(grupo, item)}
                          disabled={grupoLleno}
                          className="w-9 h-9 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1B4332] transition flex-shrink-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => restar(item)}
                            className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition font-bold text-lg leading-none"
                          >−</button>
                          <span className="w-5 text-center font-bold text-gray-900 text-sm">{cant}</span>
                          <button
                            onClick={() => sumar(grupo, item)}
                            disabled={grupoLleno}
                            className="w-8 h-8 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1B4332] transition font-bold text-lg leading-none"
                          >+</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-white flex-shrink-0">
          {precioExtras > 0 && (
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Extras</span>
              <span>+{formatearPrecio(precioExtras)}</span>
            </div>
          )}
          <button
            onClick={confirmar}
            disabled={!puedeConfirmar()}
            className="w-full bg-[#1B4332] text-white rounded-2xl py-4 font-bold text-base flex items-center justify-between px-5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2D6A4F] transition"
          >
            <span>Agregar al pedido</span>
            <span>{formatearPrecio(precioTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
