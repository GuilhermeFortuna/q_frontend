import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { fetchStrategies } from '@/api/queries/strategies'
import { handlers } from '@/mocks/handlers'
import { mockStrategies } from '@/mocks/data'

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
})
