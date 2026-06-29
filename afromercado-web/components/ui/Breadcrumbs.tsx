import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb" className="px-4 py-2 bg-[#FAF8F5]">
      <ol className="flex items-center flex-wrap gap-1 text-xs text-gray-400">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>›</span>}
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="hover:text-[#2D6A4F] transition-colors truncate max-w-[140px]">
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-600 font-medium truncate max-w-[180px]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
