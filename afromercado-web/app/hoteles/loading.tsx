import { SkeletonHero, SkeletonGrid } from '@/components/ui/SkeletonLoader'

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F8F5F0]">
      <SkeletonHero />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SkeletonGrid count={6} />
      </div>
    </div>
  )
}
