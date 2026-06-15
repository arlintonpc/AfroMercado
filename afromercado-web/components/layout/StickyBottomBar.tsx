interface StickyBottomBarProps {
  children: React.ReactNode
}

export default function StickyBottomBar({ children }: StickyBottomBarProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#F8F5F0] shadow-[0_-2px_8px_rgba(0,0,0,0.08)] h-16 flex items-center px-4">
      {children}
    </div>
  )
}
