import { apiFetch } from './client'

export interface ResultadoCupon {
  cupon: { id: number; codigo: string; tipo: string; valor: number }
  descuento: number
  totalConDescuento: number
}

export async function validarCupon(codigo: string, subtotal: number): Promise<ResultadoCupon> {
  const res = await apiFetch<{ ok: boolean; data: ResultadoCupon }>('/cupones/validar', {
    method: 'POST',
    body: { codigo, subtotal },
  })
  return res.data
}
