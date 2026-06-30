interface Props {
  size?: 'sm' | 'md' | 'lg'
  mostrarTooltip?: boolean
}

export default function BadgeProductorCertificado({ size = 'md', mostrarTooltip = true }: Props) {
  const pad  = { sm: 'px-2 py-0.5 gap-1 text-[10px]', md: 'px-2.5 py-1 gap-1.5 text-xs', lg: 'px-3 py-1.5 gap-2 text-sm' }
  const icon = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' }

  return (
    <div className="relative group inline-flex">
      <span className={`inline-flex items-center ${pad[size]} bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full font-semibold`}>
        <svg className={`${icon[size]} text-[#059669] flex-shrink-0`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
        </svg>
        Productor Certificado
      </span>

      {mostrarTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
          <p className="font-bold text-[#1A1A1A] text-xs mb-2">¿Qué significa?</p>
          <ul className="space-y-1.5">
            {[
              '✅ Productor local verificado del Chocó',
              '✅ Productos auténticos y de origen',
              '✅ Información de contacto validada',
              '✅ Historial de ventas sin incidentes',
            ].map(c => (
              <li key={c} className="text-[11px] text-gray-600 leading-snug">{c}</li>
            ))}
          </ul>
          <div className="mt-3 pt-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Certificado por el equipo AfroMercado</p>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-100 rotate-45 -mt-1.5" />
        </div>
      )}
    </div>
  )
}
