import * as Sentry from '@sentry/react'
import type { ErrorEvent, EventHint } from '@sentry/react'

import { env } from '@/lib/env'

const REDACTED = '[redacted]'
const FREE_TEXT_FIELDS = new Set(['prompt', 'message', 'conversation', 'description', 'content'])
let sentryEnabled = false

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      FREE_TEXT_FIELDS.has(key.toLowerCase()) ? REDACTED : redactValue(nested),
    ]),
  )
}

/** Remove AI prompts and all other free-text fields before an event leaves the browser. */
export function redactSentryEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  void hint
  return redactValue(event) as ErrorEvent
}

export function initSentry(): boolean {
  sentryEnabled = false
  if (!env.sentryDsn || env.enableMsw) return false

  const release =
    typeof __GIT_SHA__ !== 'undefined' && __GIT_SHA__
      ? `q@${__GIT_SHA__}`
      : env.sentryRelease
        ? env.sentryRelease.startsWith('q@')
          ? env.sentryRelease
          : `q@${env.sentryRelease}`
        : 'q@unknown'

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment,
    release,
    sendDefaultPii: false,
    tracesSampleRate: Number.isFinite(env.sentryTracesSampleRate)
      ? env.sentryTracesSampleRate
      : 0.2,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend: redactSentryEvent,
  })
  sentryEnabled = true
  return true
}

export function isSentryEnabled(): boolean {
  return sentryEnabled
}
