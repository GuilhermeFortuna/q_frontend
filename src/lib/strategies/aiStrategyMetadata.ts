import type {
  AiStrategyResponse,
  CompiledStrategy,
  StrategySpec,
  ValidationResult,
} from '@/types/strategyBuilder'
import type { AiStrategyMetadata } from '@/types/strategies'

export type AiRevisionSnapshot = {
  prompt: string
  summary: string
  strategy_spec: StrategySpec | null
  validation: ValidationResult | null
  captured_at: string
}

export type AiRevisionSectionDiff = {
  section: string
  previous: string
  current: string
  changed: boolean
}

export function buildAiStrategyMetadata(input: {
  strategySpec: StrategySpec
  capabilitiesVersion: string
  originalPrompt: string
  assumptions: string[]
  unsupportedRequestsAcknowledged: string[]
  compiledStrategy: CompiledStrategy | null
}): AiStrategyMetadata {
  return {
    strategy_spec: input.strategySpec,
    strategy_spec_version: input.strategySpec.schema_version,
    capabilities_version: input.capabilitiesVersion,
    original_prompt: input.originalPrompt,
    assumptions: input.assumptions,
    unsupported_requests_acknowledged: input.unsupportedRequestsAcknowledged,
    compiled_strategy_id: input.compiledStrategy?.compiled_id ?? null,
    compiled_strategy: input.compiledStrategy,
  }
}

export function requiresUnsupportedAcknowledgement(response: AiStrategyResponse | null): boolean {
  if (!response) return false
  return response.unsupported_requests.length > 0 && response.strategy_spec != null
}

export function getAiWorkflowBlocker(input: {
  response: AiStrategyResponse | null
  appliedToSetup: boolean
  unsupportedAcknowledged: boolean
  activeAiDraft: boolean
}): string | null {
  if (!input.activeAiDraft || !input.response) return null

  if (requiresUnsupportedAcknowledgement(input.response) && !input.unsupportedAcknowledged) {
    return 'Acknowledge unsupported requests before saving or running this AI draft.'
  }

  if (input.response.compiled_strategy && !input.appliedToSetup) {
    return 'Apply the compiled draft to setup before saving or running.'
  }

  if (input.response.validation && !input.response.validation.valid) {
    return 'Fix validation errors before saving or running this AI draft.'
  }

  return null
}

export function canSaveAiStrategy(input: {
  response: AiStrategyResponse | null
  previewSpec: StrategySpec | null
  appliedToSetup: boolean
  unsupportedAcknowledged: boolean
  customName: string
}): boolean {
  if (!input.response?.compiled_strategy || !input.previewSpec) return false
  if (!input.appliedToSetup) return false
  if (requiresUnsupportedAcknowledgement(input.response) && !input.unsupportedAcknowledged) {
    return false
  }
  if (input.response.validation && !input.response.validation.valid) return false
  return input.customName.trim().length > 0
}

export function createRevisionSnapshot(
  prompt: string,
  response: AiStrategyResponse,
): AiRevisionSnapshot {
  return {
    prompt,
    summary: response.summary,
    strategy_spec: response.strategy_spec,
    validation: response.validation,
    captured_at: new Date().toISOString(),
  }
}

function sectionValue(spec: StrategySpec | null | undefined, section: string): string {
  if (!spec) return '—'
  switch (section) {
    case 'name':
      return spec.name
    case 'universe':
      return spec.universe.join(', ')
    case 'timeframe':
      return spec.timeframe
    case 'indicators':
      return JSON.stringify(spec.indicators)
    case 'entry':
      return JSON.stringify(spec.entry)
    case 'exit':
      return JSON.stringify(spec.exit)
    case 'risk':
      return JSON.stringify(spec.risk)
    default:
      return '—'
  }
}

export function compareRevisionSections(
  previous: AiRevisionSnapshot | null,
  current: AiRevisionSnapshot | null,
): AiRevisionSectionDiff[] {
  const sections = ['name', 'universe', 'timeframe', 'indicators', 'entry', 'exit', 'risk']
  return sections.map((section) => {
    const prevValue = sectionValue(previous?.strategy_spec, section)
    const nextValue = sectionValue(current?.strategy_spec, section)
    return {
      section,
      previous: prevValue,
      current: nextValue,
      changed: prevValue !== nextValue,
    }
  })
}

export function duplicateStrategyName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'AI Strategy Copy'
  return `${trimmed} Copy`
}
