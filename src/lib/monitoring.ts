import * as Sentry from '@sentry/react'

let initialized = false

/**
 * Client-side error tracking. No-op unless NEXT_PUBLIC_SENTRY_DSN is set,
 * so local dev and preview builds stay silent. The DSN also works with any
 * Sentry-compatible backend (e.g. self-hosted GlitchTip).
 */
export function initMonitoring() {
  if (initialized) return
  initialized = true

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Keep noise down: drop browser extension script errors.
      if (event.exception?.values?.some((v) => v.value?.includes('extension://'))) {
        return null
      }
      return event
    },
  })
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  Sentry.captureException(err, { extra: context })
}
