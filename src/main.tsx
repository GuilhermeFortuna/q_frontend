import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
import { env } from '@/lib/env'
import '@/styles/globals.css'

async function enableMocking() {
  if (!env.enableMsw) {
    return
  }

  const { worker } = await import('@/mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}

void enableMocking().then(() => {
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('Root element #root not found')
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
