export const fadeRise = (reduced = false) => ({
  hidden: { opacity: 0, y: reduced ? 0 : 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: reduced ? 0 : 0.18, // --motion-base (180ms)
      ease: [0.16, 1, 0.3, 1], // --ease-out
    },
  },
})

export const overlayEnter = (reduced = false) => ({
  hidden: { opacity: 0, scale: reduced ? 1 : 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: reduced ? 0 : 0.28, // --motion-slow (280ms)
      ease: [0.16, 1, 0.3, 1], // --ease-out
    },
  },
})

export const overlayExit = (reduced = false) => ({
  hidden: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    scale: reduced ? 1 : 0.98,
    transition: {
      duration: reduced ? 0 : 0.12, // --motion-fast (120ms)
      ease: [0.4, 0, 1, 1], // --ease-exit
    },
  },
})

export const staggerChildren = (staggerDelay = 0.02, reduced = false) => ({
  visible: {
    transition: {
      staggerChildren: reduced ? 0 : staggerDelay,
    },
  },
})
