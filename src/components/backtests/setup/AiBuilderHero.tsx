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

/** Brass four-point spark — the AI Builder's hero mark. */
function QuantSpark() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden focusable="false">
      <defs>
        <linearGradient id="quant-spark-grad" x1="4" y1="28" x2="28" y2="4">
          <stop offset="0%" stopColor="var(--color-brass-600)" />
          <stop offset="55%" stopColor="var(--color-brass-400)" />
          <stop offset="100%" stopColor="var(--color-cream-200)" />
        </linearGradient>
      </defs>
      <path
        d="M16 1.5 L19.4 12.6 L30.5 16 L19.4 19.4 L16 30.5 L12.6 19.4 L1.5 16 L12.6 12.6 Z"
        fill="url(#quant-spark-grad)"
      />
    </svg>
  )
}

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
      <motion.div
        variants={rise(isReduced)}
        className="mb-5 drop-shadow-[0_0_14px_rgba(240,180,41,0.4)]"
      >
        <QuantSpark />
      </motion.div>

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
