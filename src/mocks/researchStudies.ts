import type { ResearchStudyMetadata, ResearchStudySeriesResponse } from '../../contracts/api'

export const MOCK_STUDY_KELTNER_ID = 'study_keltner_m10'
export const MOCK_STUDY_HOURLY_ID = 'study_regime_h1'

const STEP_MINUTES: Record<string, number> = { M10: 10, H1: 60 }

function seed(): ResearchStudyMetadata[] {
  return [
    {
      studyId: MOCK_STUDY_KELTNER_ID,
      name: 'Keltner 20/2',
      symbol: 'WDO$N',
      timeframe: 'M10',
      notes: 'Band over M10 bars; width in the oscillator pane.',
      series: [
        {
          key: 'kc_upper',
          label: 'Upper',
          pane: 'price',
          color: '#6eb5ff',
          lineStyle: 'dashed',
          lineWidth: 1.5,
        },
        {
          key: 'kc_lower',
          label: 'Lower',
          pane: 'price',
          color: '#6eb5ff',
          lineStyle: 'dashed',
          lineWidth: 1.5,
        },
        {
          key: 'kc_width',
          label: 'Width',
          pane: 'oscillator',
          color: null,
          lineStyle: null,
          lineWidth: null,
        },
      ],
      start: '2026-01-05T12:00:00+00:00',
      end: '2026-01-05T18:00:00+00:00',
      pointCount: 37,
      revision: 2,
      createdAt: '2026-01-05T19:00:00+00:00',
      updatedAt: '2026-01-06T10:15:00+00:00',
      provenance: { script: 'keltner_band.py', git_revision: 'abc1234', git_dirty: false },
    },
    {
      studyId: MOCK_STUDY_HOURLY_ID,
      name: 'Regime score',
      symbol: 'WDO$N',
      timeframe: 'H1',
      notes: null,
      series: [
        {
          key: 'regime',
          label: 'Regime',
          pane: 'oscillator',
          color: null,
          lineStyle: null,
          lineWidth: null,
        },
      ],
      start: '2026-01-05T12:00:00+00:00',
      end: '2026-01-05T18:00:00+00:00',
      pointCount: 7,
      revision: 1,
      createdAt: '2026-01-05T19:30:00+00:00',
      updatedAt: '2026-01-05T19:30:00+00:00',
      provenance: null,
    },
  ]
}

let studies: ResearchStudyMetadata[] = seed()

/** Test-only reset of the in-memory studies. */
export function resetMockResearchStudies(): void {
  studies = seed()
}

export function listMockResearchStudies(symbol: string): ResearchStudyMetadata[] {
  return studies
    .filter((study) => study.symbol === symbol.trim().toUpperCase())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getMockResearchStudySeries(
  studyId: string,
  start: string,
  end: string,
): ResearchStudySeriesResponse | null {
  const study = studies.find((item) => item.studyId === studyId)
  if (!study) return null
  const stepMs = (STEP_MINUTES[study.timeframe] ?? 10) * 60_000
  const from = Date.parse(start)
  const to = Date.parse(end)
  const timestamps: string[] = []
  for (let instant = from; instant <= to; instant += stepMs) {
    timestamps.push(new Date(instant).toISOString())
  }
  return {
    timestamps,
    series: study.series.map((series, seriesIndex) => ({
      key: series.key,
      values: timestamps.map((_, index) =>
        // Every fifth point is a warm-up gap, so the drawn line breaks there.
        index % 5 === 0 ? null : 3 + Math.sin((index + seriesIndex) / 4),
      ),
    })),
  }
}

export function renameMockResearchStudy(
  studyId: string,
  name: string,
): ResearchStudyMetadata | 'conflict' | null {
  const study = studies.find((item) => item.studyId === studyId)
  if (!study) return null
  const clash = studies.some(
    (item) =>
      item.studyId !== studyId &&
      item.symbol === study.symbol &&
      item.timeframe === study.timeframe &&
      item.name === name,
  )
  if (clash) return 'conflict'
  study.name = name
  study.updatedAt = new Date().toISOString()
  return study
}

export function deleteMockResearchStudy(studyId: string): boolean {
  const before = studies.length
  studies = studies.filter((item) => item.studyId !== studyId)
  return studies.length < before
}
