'use client'

import React from 'react'
import { Skeleton } from './Skeleton'

export function SkeletonHero() {
  return (
    <div className="relative h-64 sm:h-80 lg:h-[400px] w-full bg-gray-200 animate-pulse overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-gray-300/50 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-3/4 sm:w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3"
        >
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex justify-between items-center mt-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
