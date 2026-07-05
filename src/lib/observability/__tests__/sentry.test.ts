import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'browser-tracing' })),
  env: {
    sentryDsn: '',
    sentryEnvironment: 'local',
    sentryTracesSampleRate: 0.2,
    sentryRelease: '',
    enableMsw: false,
  },
}))

vi.mock('@sentry/react', () => ({
  init: mocks.init,
  browserTracingIntegration: mocks.browserTracingIntegration,
}))
vi.mock('@/lib/env', () => ({ env: mocks.env }))

import { initSentry, redactSentryEvent } from '@/lib/observability/sentry'

describe('frontend Sentry initialization', () => {
  beforeEach(() => {
    mocks.init.mockClear()
    mocks.browserTracingIntegration.mockClear()
    mocks.env.sentryDsn = ''
    mocks.env.enableMsw = false
  })

  it('does not initialize without a DSN', () => {
    expect(initSentry()).toBe(false)
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('does not initialize while MSW is enabled', () => {
    mocks.env.sentryDsn = 'https://public@example.invalid/1'
    mocks.env.enableMsw = true

    expect(initSentry()).toBe(false)
    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('initializes with privacy-safe defaults and tracing', () => {
    mocks.env.sentryDsn = 'https://public@example.invalid/1'

    expect(initSentry()).toBe(true)
    expect(mocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: mocks.env.sentryDsn,
        environment: 'local',
        sendDefaultPii: false,
        tracesSampleRate: 0.2,
        beforeSend: redactSentryEvent,
      }),
    )
    expect(mocks.browserTracingIntegration).toHaveBeenCalledOnce()
  })

  it('uses __GIT_SHA__ for release if defined', () => {
    mocks.env.sentryDsn = 'https://public@example.invalid/1'
    // @ts-expect-error - testing global define inject
    globalThis.__GIT_SHA__ = 'abc1234'

    expect(initSentry()).toBe(true)
    expect(mocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: 'q@abc1234',
      }),
    )

    // Clean up global define mock
    // @ts-expect-error - cleanup
    delete globalThis.__GIT_SHA__
  })

  it('falls back to sentryRelease if __GIT_SHA__ is undefined', () => {
    mocks.env.sentryDsn = 'https://public@example.invalid/1'
    mocks.env.sentryRelease = 'my-release'
    // @ts-expect-error - ensure undefined
    delete globalThis.__GIT_SHA__

    expect(initSentry()).toBe(true)
    expect(mocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: 'q@my-release',
      }),
    )
    mocks.env.sentryRelease = ''
  })

  it('falls back to q@unknown if both are undefined', () => {
    mocks.env.sentryDsn = 'https://public@example.invalid/1'
    mocks.env.sentryRelease = ''
    // @ts-expect-error - ensure undefined
    delete globalThis.__GIT_SHA__

    expect(initSentry()).toBe(true)
    expect(mocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: 'q@unknown',
      }),
    )
  })

  it('redacts free-text fields recursively while preserving safe context', () => {
    const event = {
      request: {
        data: {
          prompt: 'secret prompt',
          conversation: [{ content: 'secret turn', role: 'user' }],
          strategy_id: 'strategy-123',
        },
      },
      contexts: {
        strategy: {
          description: 'secret description',
          symbol: 'PETR4',
        },
      },
      message: 'secret event message',
    }

    expect(redactSentryEvent(event as never)).toEqual({
      request: {
        data: {
          prompt: '[redacted]',
          conversation: '[redacted]',
          strategy_id: 'strategy-123',
        },
      },
      contexts: {
        strategy: {
          description: '[redacted]',
          symbol: 'PETR4',
        },
      },
      message: '[redacted]',
    })
  })
})
