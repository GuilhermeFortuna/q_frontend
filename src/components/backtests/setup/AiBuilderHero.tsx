import { motion } from 'motion/react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'

const container = (reduced: boolean) => ({
  hidden: {},
  visible: {
    transition: reduced ? { duration: 0 } : { staggerChildren: 0.09, delayChildren: 0.05 },
  },
})

const rise = (reduced: boolean) => ({
  hidden: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: reduced ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
})

export function AiBuilderHero() {
  const isReduced = useReducedMotion()

  return (
    <motion.div
      variants={container(isReduced)}
      initial="hidden"
      animate="visible"
      className="relative z-10 flex max-w-xl flex-col items-center text-center select-none"
      data-testid="ai-builder-hero"
    >
      <motion.h2
        variants={rise(isReduced)}
        className="font-display text-silver-100 text-[26px] leading-tight font-[550] tracking-tight"
      >
        What are we{' '}
        <span className="from-brass-400 via-brass-500 to-cream-200 bg-gradient-to-r bg-clip-text font-[600] text-transparent">
          building
        </span>{' '}
        today?
      </motion.h2>

      <motion.p
        variants={rise(isReduced)}
        className="text-silver-400 mt-2 max-w-md text-sm leading-relaxed"
      >
        Start with whatever you have — the builder will ask for what it needs.
      </motion.p>
    </motion.div>
  )
}
