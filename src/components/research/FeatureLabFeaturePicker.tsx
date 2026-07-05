import { chipClass } from '@/components/ui/chipStyles'
import { LabeledField } from '@/components/ui/LabeledField'
import { cn } from '@/lib/utils'
import type { FeatureListItem } from '@/types/features'

import { groupFeaturesByCategory } from '@/components/research/featureLabUtils'

type FeatureLabFeaturePickerProps = {
  features: FeatureListItem[]
  selectedFeatures: Set<string>
  onChange: (next: Set<string>) => void
  recommendedFeatureNames: string[]
}

export function FeatureLabFeaturePicker({
  features,
  selectedFeatures,
  onChange,
  recommendedFeatureNames,
}: FeatureLabFeaturePickerProps) {
  const grouped = groupFeaturesByCategory(features)

  const toggleFeature = (name: string) => {
    const next = new Set(selectedFeatures)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    onChange(next)
  }

  const selectCategory = (category: string) => {
    const names = grouped.get(category)?.map((feature) => feature.name) ?? []
    const next = new Set(selectedFeatures)
    for (const name of names) {
      next.add(name)
    }
    onChange(next)
  }

  const selectRecommended = () => {
    onChange(new Set(recommendedFeatureNames))
  }

  return (
    <div className="space-y-3" data-testid="feature-lab-feature-picker">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={chipClass(false)}
          onClick={selectRecommended}
          data-testid="feature-lab-recommended-only"
        >
          Recommended only
        </button>
      </div>

      {[...grouped.entries()].map(([category, categoryFeatures]) => (
        <div key={category} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
              {category}
            </p>
            <button
              type="button"
              className="text-brass-400 text-xs font-medium hover:underline"
              onClick={() => selectCategory(category)}
              data-testid={`feature-lab-select-category-${category}`}
            >
              Select all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categoryFeatures.map((feature) => {
              const selected = selectedFeatures.has(feature.name)
              return (
                <button
                  key={feature.name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleFeature(feature.name)}
                  className={cn(chipClass(selected), 'font-mono')}
                  data-testid={`feature-lab-feature-${feature.name}`}
                >
                  {feature.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <LabeledField label="Selected features">
        <p className="text-silver-300 text-sm" data-testid="feature-lab-selected-count">
          {selectedFeatures.size === 0 ? 'None selected' : [...selectedFeatures].sort().join(', ')}
        </p>
      </LabeledField>
    </div>
  )
}
