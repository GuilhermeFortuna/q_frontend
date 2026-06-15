import { z } from 'zod'

import type { GeneticSearchConfig, LockboxConfig } from '@/types/strategySearch'

export const geneticSearchConfigSchema = z.object({
  population_size: z.number().int().min(10).max(200),
  generations: z.number().int().min(2).max(50),
  elite_count: z.number().int().min(1),
  crossover_rate: z.number().min(0).max(1),
  mutation_rate: z.number().min(0).max(1),
  tournament_size: z.number().int().min(2),
  init_seed: z.number().int().nullable().optional(),
  max_nodes: z.number().int().min(4),
  max_depth: z.number().int().min(3),
  complexity_lambda: z.number().min(0),
  complexity_mu: z.number().min(0),
})

export const lockboxConfigSchema = z
  .object({
    enabled: z.boolean(),
    lockbox_pct: z.number().min(0).max(1).nullable().optional(),
    lockbox_days: z.number().int().min(1).nullable().optional(),
    min_trades: z.number().int().min(0),
    max_drawdown_pct: z.number().min(0).max(1).nullable().optional(),
  })
  .refine((value) => !(value.enabled && value.lockbox_pct != null && value.lockbox_days != null), {
    message: 'Use lockbox_pct or lockbox_days, not both',
  })

export function validateGeneticConfig(config: GeneticSearchConfig): string | null {
  const parsed = geneticSearchConfigSchema.safeParse(config)
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Invalid genetic configuration'
  }
  if (config.elite_count >= config.population_size) {
    return 'Elite count must be less than population size'
  }
  return null
}

export function validateLockboxConfig(config: LockboxConfig): string | null {
  const parsed = lockboxConfigSchema.safeParse(config)
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Invalid lock-box configuration'
  }
  return null
}
