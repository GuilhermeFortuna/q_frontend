import type { IndicatorCatalogEntry } from '../../../contracts/api'
import { indicatorDocumentation, parameterHelp } from '@/lib/market/indicatorDocumentation'

export function IndicatorGuide({ entry }: { entry: IndicatorCatalogEntry }) {
  const guide = indicatorDocumentation[entry.id]
  if (!guide)
    return (
      <p className="text-silver-300 text-sm leading-relaxed">
        Documentation is not yet available for this indicator. Its parameters and outputs are
        provided by the indicator catalog.
      </p>
    )
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <section>
        <h4 className="text-silver-100 mb-2 font-semibold">What it measures</h4>
        <p className="text-silver-200">{guide.measures}</p>
      </section>
      <section>
        <h4 className="text-silver-100 mb-2 font-semibold">How to read it</h4>
        <p className="text-silver-200">{guide.interpretation}</p>
      </section>
      <section>
        <h4 className="text-silver-100 mb-2 font-semibold">Calculation</h4>
        <p className="surface-well text-cream-200 rounded-lg px-4 py-3 font-mono text-xs leading-6 break-words">
          {guide.calculation}
        </p>
        {guide.example && (
          <p className="text-silver-300 border-brass-500/40 mt-3 border-l-2 pl-3">
            {guide.example}
          </p>
        )}
      </section>
      {entry.parameters.length > 0 && (
        <section>
          <h4 className="text-silver-100 mb-2 font-semibold">Parameters</h4>
          <dl className="space-y-3">
            {entry.parameters.map((spec) => {
              const help = parameterHelp(spec.name)
              return (
                <div key={spec.name} className="grid gap-1 sm:grid-cols-[150px_1fr] sm:gap-4">
                  <dt className="text-silver-100 font-medium">{help.label}</dt>
                  <dd className="text-silver-300">
                    {help.description}{' '}
                    <span className="text-silver-200">
                      Default: {String(spec.default ?? 'None')}.
                    </span>
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      )}
      <section className="border-carbon-700/60 border-t pt-4">
        <h4 className="text-silver-100 mb-2 font-semibold">Limitations</h4>
        <p className="text-silver-300">{guide.limitations}</p>
      </section>
    </div>
  )
}
