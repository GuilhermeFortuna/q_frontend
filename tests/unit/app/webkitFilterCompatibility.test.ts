import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const initializationScript = readFileSync(
  resolve(process.cwd(), 'src-tauri/src/webkit_filter_compat.js'),
  'utf8',
)

afterEach(() => {
  delete document.documentElement.dataset.webkitFilterCompat
})

describe('native WebKit filter compatibility initialization', () => {
  it('marks the document before the application renders', () => {
    window.eval(initializationScript)

    expect(document.documentElement.dataset.webkitFilterCompat).toBe('true')
  })

  it('waits for the HTML root when injected before the parser creates it', async () => {
    const root = document.documentElement
    root.remove()
    try {
      window.eval(initializationScript)
      document.appendChild(root)
      await Promise.resolve()

      expect(root.dataset.webkitFilterCompat).toBe('true')
    } finally {
      if (!root.isConnected) document.appendChild(root)
    }
  })
})
