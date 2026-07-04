import axios from 'axios'

import { env } from '@/lib/env'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})
