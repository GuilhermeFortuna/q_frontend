import { motion } from 'motion/react'

export function ActiveOutline() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl">
      {/* Dynamic spinning glowing gradient backplate */}
      <motion.div
        className="absolute -inset-[150%] bg-[conic-gradient(from_0deg,transparent_30%,#ffca47_50%,transparent_70%)]"
        animate={{ rotate: 360 }}
        transition={{
          duration: 4,
          ease: 'linear',
          repeat: Infinity,
        }}
      />
      {/* Dark mask overlay that exposes only a 1px glowing border */}
      <div className="absolute inset-[1px] z-10 rounded-[15px] bg-gradient-to-br from-[#1a1008] to-[#111315]" />
    </div>
  )
}
