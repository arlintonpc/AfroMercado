export default function PaginaOffline() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F5F0] px-4 text-center">
      <p className="text-5xl mb-4">📡</p>
      <h1
        className="text-2xl text-[#1A1A1A] mb-2"
        style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
      >
        Estás sin conexión
      </h1>
      <p className="text-sm text-[#1A1A1A]/60 max-w-sm">
        No pudimos cargar esta página porque no hay internet. Si ya la habías visitado antes,
        recarga cuando vuelva la señal para ver la versión más reciente.
      </p>
    </div>
  )
}
