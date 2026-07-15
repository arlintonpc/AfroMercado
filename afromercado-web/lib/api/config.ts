import { apiFetch } from './client'

/**
 * Reglas no sensibles del marketplace, expuestas sin autenticación.
 * Vienen del Centro de Reglas del backend (Config o valor por defecto).
 * Los valores llegan como string ("0", "true", …) y se interpretan aquí.
 */
export interface ReglasPublicas {
  /** Monto a partir del cual la plataforma regala el envío (0 = desactivado). */
  envioGratisUmbralPlataforma: number
  /** Si los vendedores pueden ofrecer envío gratis por monto mínimo de su tienda. */
  envioGratisVendedorPermitido: boolean
  /** 'por_comercio' = un envío por cada tienda; 'consolidado' = un solo envío. */
  envioPoliticaMulticomercio: 'por_comercio' | 'consolidado'
  /** Si un cupón puede sumarse al descuento de un producto en oferta. */
  cuponCombinableConOferta: boolean
  /** Si el botón de WhatsApp está visible en la tienda. */
  whatsappBotonActivo: boolean
  /** URL del logo de la plataforma (vacío = se usa el texto "Teravia"). */
  logoUrl: string
  /** Datos legales (Términos / Habeas Data). Vacío = aún sin definir. */
  legalRazonSocial: string
  legalNit: string
  legalDireccion: string
  legalEmail: string
  legalTelefono: string
}

export async function obtenerReglasPublicas(): Promise<ReglasPublicas> {
  const r = await apiFetch<{ ok: boolean; data: Record<string, string> }>(
    '/config/publicas',
    { auth: false },
  )
  const d = r.data ?? {}
  return {
    envioGratisUmbralPlataforma: Number(d['envio_gratis_umbral_plataforma'] ?? 0) || 0,
    envioGratisVendedorPermitido: d['envio_gratis_vendedor_permitido'] === 'true',
    envioPoliticaMulticomercio: d['envio_politica_multicomercio'] === 'consolidado' ? 'consolidado' : 'por_comercio',
    cuponCombinableConOferta: d['cupon_combinable_con_oferta'] === 'true',
    whatsappBotonActivo: d['whatsapp_boton_activo'] === 'true',
    logoUrl: d['logo_url'] ?? '',
    legalRazonSocial: d['legal_razon_social'] ?? '',
    legalNit: d['legal_nit'] ?? '',
    legalDireccion: d['legal_direccion'] ?? '',
    legalEmail: d['legal_email'] ?? '',
    legalTelefono: d['legal_telefono'] ?? '',
  }
}
