import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

function DevUiGalleryUnavailable() {
  return null
}

export const LazyDevUiGallery: LazyExoticComponent<ComponentType> = import.meta.env.DEV
  ? lazy(() =>
      import('@/app/dev/DevUiGallery').then((module) => ({ default: module.DevUiGallery })),
    )
  : lazy(async () => ({ default: DevUiGalleryUnavailable }))
