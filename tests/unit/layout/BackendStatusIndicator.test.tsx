import { render, screen } from '@testing-library/react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as backendConnectionModule from '@/api/queries/backendConnection'
import { BackendStatusIndicator } from '@/components/layout/BackendStatusIndicator'
import type { SystemHealthResponse } from '../../../contracts/api'

const sampleHealth: SystemHealthResponse = {
  active_provider: 'mt5',
  backendVersion: '0.1.0',
  dataLakeStatus: 'healthy',
  lastSyncAt: '2026-09-14T10:00:00Z',
  market_data_inventory_count: 5,
  market_data_root: '/data',
  mt5_available: true,
  status: 'ok',
  storageStatus: {
    postgres: { status: 'ok', error: null },
    redis: { status: 'ok', error: null },
  },
}

describe('BackendStatusIndicator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offline renders the API address and the text systemctl --user start q-backend.target', () => {
    vi.spyOn(backendConnectionModule, 'useBackendConnection').mockReturnValue({
      state: 'offline',
      apiBaseUrl: 'http://127.0.0.1:8000',
      nextRetryMs: 2000,
      since: Date.now() - 5000,
    })

    render(<BackendStatusIndicator />)

    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeInTheDocument()
    expect(screen.getByText('http://127.0.0.1:8000')).toBeInTheDocument()
    expect(screen.getByText('systemctl --user start q-backend.target')).toBeInTheDocument()
  })

  it('degraded renders Redis when Redis is failing', () => {
    vi.spyOn(backendConnectionModule, 'useBackendConnection').mockReturnValue({
      state: 'degraded',
      health: {
        ...sampleHealth,
        storageStatus: {
          postgres: { status: 'ok', error: null },
          redis: { status: 'error', error: 'Connection refused' },
        },
      },
      failing: ['redis'],
    })

    render(<BackendStatusIndicator />)

    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeInTheDocument()
    expect(screen.getByText(/Redis/)).toBeInTheDocument()
  })

  it('connected renders a compact status with role="status"', () => {
    vi.spyOn(backendConnectionModule, 'useBackendConnection').mockReturnValue({
      state: 'connected',
      health: sampleHealth,
    })

    render(<BackendStatusIndicator />)

    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeInTheDocument()
    expect(statusEl).toHaveTextContent(/connected/i)
  })

  it('mocked renders Mock data', () => {
    vi.spyOn(backendConnectionModule, 'useBackendConnection').mockReturnValue({
      state: 'mocked',
    })

    render(<BackendStatusIndicator />)

    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeInTheDocument()
    expect(statusEl).toHaveTextContent('Mock data')
  })
})

describe('contract types integrity', () => {
  function walkSource(dir: string): string[] {
    const entries = readdirSync(dir)
    const files: string[] = []
    for (const entry of entries) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        files.push(...walkSource(full))
      } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
        files.push(full)
      }
    }
    return files
  }

  it('fails if a type declaring storageStatus exists under src/', () => {
    const srcRoot = resolve(process.cwd(), 'src')
    const files = walkSource(srcRoot)
    const violations: { file: string; line: number }[] = []

    // Matches `interface ... { ... storageStatus ... }` or `type ... = { ... storageStatus ... }`
    const typeDeclRegex = /(?:interface|type)\s+\w+[\s\S]*?\{[\s\S]*?\bstorageStatus\s*\??\s*:/g

    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      const matches = content.match(typeDeclRegex)
      if (matches) {
        violations.push({
          file: relative(process.cwd(), file),
          line: 1,
        })
      }
    }

    expect(violations).toEqual([])
  })
})
