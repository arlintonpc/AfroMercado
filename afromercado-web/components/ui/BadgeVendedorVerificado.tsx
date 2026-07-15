interface Props {
  verificado: boolean
  size?: 'sm' | 'md' | 'lg'
  mostrarTooltip?: boolean
}

/**
 * Insignia para comercios verificados de la sección "Tienda Local".
 *
 * A diferencia de BadgeProductorCertificado (que certifica origen/autenticidad
 * ancestral), este badge solo confirma que el comercio pasó la verificación
 * de identidad de AfroMercado — no implica producto artesanal ni territorial.
 * Usa un tono azul (ya presente en la app para transportes/otros módulos)
 * para no confundirse visualmente con el verde de "Productor Certificado".
 */
export default function BadgeVendedorVerificado({ verificado, size = 'md', mostrarTooltip = true }: Props) {
  if (!verificado) return null

  const pad  = { sm: 'px-2 py-0.5 gap-1 text-[10px]', md: 'px-2.5 py-1 gap-1.5 text-xs', lg: 'px-3 py-1.5 gap-2 text-sm' }
  const icon = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' }

  return (
    <div className="relative group inline-flex">
      <span className={`inline-flex items-center ${pad[size]} bg-[#EAF2FB] text-[#023E8A] border border-[#BBD8F5] rounded-full font-semibold`}>
        <svg className={`${icon[size]} text-[#0077B6] flex-shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l7 3v6c0 5-3.2 8.5-7 10-3.8-1.5-7-5-7-10V5l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        Vendedor verificado
      </span>

      {mostrarTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-white border border-gray-100 rounded-xl shadow-xl p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
          <p className="font-bold text-[#1A1A1A] text-xs mb-2">¿Qué significa?</p>
          <ul className="space-y-1.5">
            <li className="text-[11px] text-gray-600 leading-snug">✅ Identidad y contacto verificados por Teravia</li>
            <li className="text-[11px] text-gray-600 leading-snug">✅ Cuenta de cobro validada</li>
            <li className="text-[11px] text-gray-600 leading-snug">✅ Historial de ventas sin incidentes</li>
          </ul>
          <div className="mt-3 pt-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Verificado por el equipo Teravia</p>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-100 rotate-45 -mt-1.5" />
        </div>
      )}
    </div>
  )
}
