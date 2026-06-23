import { useEffect, useState } from 'react'

import { getFeature3DCount, subscribeFeature3D } from '@/lib/cinematic/feature3DRegistry'

export function useFeature3DActive(): boolean {
  const [active, setActive] = useState(() => getFeature3DCount() > 0)

  useEffect(() => subscribeFeature3D(() => setActive(getFeature3DCount() > 0)), [])

  return active
}
