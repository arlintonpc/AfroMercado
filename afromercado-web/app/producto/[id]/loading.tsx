import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F8F5F0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Galería del producto */}
        <Skeleton className="aspect-square w-full rounded-2xl" />

        {/* Info del producto */}
        <div className="flex flex-col gap-4">
          <Skeleton className="w-24 h-5 rounded-full" />
          <Skeleton className="w-3/4 h-8" />
          <Skeleton className="w-32 h-6" />
          <SkeletonText lines={4} />
          <div className="flex items-center gap-3 mt-2">
            <Skeleton className="w-32 h-11 rounded-lg" />
            <Skeleton className="w-40 h-11 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Productos relacionados */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
