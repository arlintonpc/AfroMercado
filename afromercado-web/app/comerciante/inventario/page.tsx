import InventarioOperativo from '@/components/comerciante/inventario/InventarioOperativo'
import Link from 'next/link'

export default function InventarioPage() {
  return <>
    <div className="mx-auto flex max-w-6xl justify-end px-4 pt-4"><Link href="/comerciante/inventario/kardex" className="text-sm font-semibold text-[#2D6A4F] hover:underline">Ver Kardex valorizado →</Link></div>
    <InventarioOperativo />
  </>
}
