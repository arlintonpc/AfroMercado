'use client'

import { useEffect, useState } from 'react'
import { obtenerReglasPublicas, type ReglasPublicas } from '@/lib/api/config'

// Una sola carga compartida entre todos los <DatoLegal> de la página.
let cache: Promise<ReglasPublicas> | null = null
function cargar() {
  if (!cache) cache = obtenerReglasPublicas()
  return cache
}

type Campo = 'razonSocial' | 'nit' | 'direccion' | 'email' | 'telefono'

/**
 * Muestra un dato legal configurable (lo edita el admin en /admin/reglas).
 * Si aún no está definido, muestra "(por definir)".
 */
export function DatoLegal({ campo }: { campo: Campo }) {
  const [valor, setValor] = useState<string>('…')

  useEffect(() => {
    let activo = true
    cargar()
      .then((r) => {
        if (!activo) return
        const mapa: Record<Campo, string> = {
          razonSocial: r.legalRazonSocial,
          nit: r.legalNit,
          direccion: r.legalDireccion,
          email: r.legalEmail,
          telefono: r.legalTelefono,
        }
        setValor((mapa[campo] || '').trim() || '(por definir)')
      })
      .catch(() => { if (activo) setValor('(por definir)') })
    return () => { activo = false }
  }, [campo])

  return <>{valor}</>
}

export default DatoLegal
