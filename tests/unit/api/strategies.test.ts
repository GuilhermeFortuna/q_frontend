import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { fetchExitRuleCatalog, fetchStrategies } from '@/api/queries/strategies'
import { handlers } from '@/mocks/handlers'
import { mockExitRuleCatalog, mockStrategies } from '@/mocks/data'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('strategies API', () => {
  it('fetchStrategies returns the registry schema', async () => {
    const result = await fetchStrategies()
    expect(result).toEqual(mockStrategies)
    expect(result.strategies.some((s) => s.name === 'MACrossover')).toBe(true)
  })

  it('fetchExitRuleCatalog returns rule metadata and presets', async () => {
    const result = await fetchExitRuleCatalog()
    expect(result).toEqual(mockExitRuleCatalog)
    expect(result.exit_rules.length).toBeGreaterThan(0)
    expect(result.exit_presets.length).toBeGreaterThan(0)
  })
})
