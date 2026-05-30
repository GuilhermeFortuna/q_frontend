import { create } from 'zustand'

import {
  createPreferencesSlice,
  type PreferencesSlice,
} from '@/store/slices/preferencesSlice'
import { createWorkspaceSlice, type WorkspaceSlice } from '@/store/slices/workspaceSlice'

export type AppStore = WorkspaceSlice & PreferencesSlice

export const useAppStore = create<AppStore>()((...args) => ({
  ...createWorkspaceSlice(...args),
  ...createPreferencesSlice(...args),
}))
