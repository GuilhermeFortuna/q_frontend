import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchStrategyBuilderCapabilities,
  strategyBuilderKeys,
  useInterpretStrategy,
  useStrategyBuilderModels,
} from '@/api/queries/strategyBuilder'
import { applyCompiledStrategyToConfig } from '@/lib/strategies/applyCompiledStrategy'
import {
  buildAiStrategyMetadata,
  canSaveAiStrategy,
  compareRevisionSections,
  createRevisionSnapshot,
  duplicateStrategyName,
  getAiWorkflowBlocker,
  requiresUnsupportedAcknowledgement,
  type AiRevisionSnapshot,
} from '@/lib/strategies/aiStrategyMetadata'
import { buildOptimizationConfigFromBacktestFields } from '@/lib/strategies/buildOptimizationFromBacktest'
import { downloadStrategySpecJson } from '@/lib/strategies/exportStrategySpec'
import { toast } from '@/components/ui'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import type { AiStrategyMetadata, CustomStrategy } from '@/types/strategies'
import type {
  AiStrategyResponse,
  AiStrategyServiceErrorResponse,
  ConversationMessage,
  StrategySpec,
  ValidationErrorDetail,
} from '@/types/strategyBuilder'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type UseAiStrategySessionOptions = {
  config: BacktestConfig
  onRunBacktest?: (request: BacktestRequest) => void
  onOptimize?: () => void
}

export type TranscriptUserEntry = {
  id: string
  kind: 'user'
  content: string
  answeringQuestion?: string
}

export type TranscriptAssistantEntry = {
  id: string
  kind: 'assistant'
  summary: string
  change_notes: string[]
  questions: string[]
  confidence: number
  revisionIndex: number
}

export type TranscriptNoticeEntry = {
  id: string
  kind: 'notice'
  content: string
}

export type TranscriptEntry = TranscriptUserEntry | TranscriptAssistantEntry | TranscriptNoticeEntry

export type AiModelSelection = { provider: string; model: string }

/** Duration to hold the visual "done" state after a successful interpret (WO217). */
export const AI_VISUAL_DONE_HOLD_MS = 900

function extractInterpretError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'AI interpretation failed.'
  }

  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const serviceError = detail as AiStrategyServiceErrorResponse
    return serviceError.detail
      ? `${serviceError.message} (${serviceError.detail})`
      : serviceError.message
  }
  return error.message
}

export function useAiStrategySession({
  config,
  onRunBacktest,
  onOptimize,
}: UseAiStrategySessionOptions) {
  const queryClient = useQueryClient()
  const interpretMutation = useInterpretStrategy()
  const modelsQuery = useStrategyBuilderModels()
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)
  const persistedModelSelection = useAppStore((s) => s.backtestSession.aiModelSelection)
  const setPendingOptimizationConfig = useAppStore((s) => s.setPendingOptimizationConfig)
  const transcriptIdRef = useRef(0)
  const doneHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearDoneHold = useCallback(() => {
    if (doneHoldTimerRef.current !== null) {
      clearTimeout(doneHoldTimerRef.current)
      doneHoldTimerRef.current = null
    }
    setDoneHoldActive(false)
  }, [])

  useEffect(() => () => clearDoneHold(), [clearDoneHold])

  const [message, setMessage] = useState('')
  const [selectedModel, setSelectedModelState] = useState<AiModelSelection | null>(
    persistedModelSelection,
  )
  const [conversation, setConversation] = useState<ConversationMessage[]>([])
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [draftSpec, setDraftSpec] = useState<StrategySpec | null>(null)
  const [response, setResponse] = useState<AiStrategyResponse | null>(null)
  const [serviceError, setServiceError] = useState<string | null>(null)
  const [interpretFailed, setInterpretFailed] = useState(false)
  const [doneHoldActive, setDoneHoldActive] = useState(false)
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [unsupportedAcknowledged, setUnsupportedAcknowledged] = useState(false)
  const [appliedToSetup, setAppliedToSetup] = useState(false)
  const [activeAiDraft, setActiveAiDraft] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [revisions, setRevisions] = useState<AiRevisionSnapshot[]>([])
  const [capabilitiesVersion, setCapabilitiesVersion] = useState('q_capabilities.v1')
  const [answeringQuestion, setAnsweringQuestion] = useState<string | null>(null)

  const nextTranscriptId = useCallback(() => {
    transcriptIdRef.current += 1
    return `transcript-${transcriptIdRef.current}`
  }, [])

  const availableModels = useMemo(
    () =>
      (modelsQuery.data?.models ?? []).map((model) => ({
        ...model,
        provider: model.provider ?? modelsQuery.data?.provider ?? '',
      })),
    [modelsQuery.data],
  )
  const modelProviders = useMemo(() => {
    if (modelsQuery.data?.providers) return modelsQuery.data.providers
    if (!modelsQuery.data?.provider || availableModels.length === 0) return []
    return [{ id: modelsQuery.data.provider, label: modelsQuery.data.provider }]
  }, [availableModels.length, modelsQuery.data])
  const hasProviderContract = modelsQuery.data?.providers !== undefined
  const provider = modelsQuery.data?.provider ?? ''
  const modelsLoading = modelsQuery.isLoading
  const modelsError = modelsQuery.isError
    ? modelsQuery.error instanceof Error
      ? modelsQuery.error.message
      : 'Unable to load local models.'
    : null

  const setSelectedModel = useCallback(
    (selection: AiModelSelection | null) => {
      setSelectedModelState(selection)
      patchBacktestSession({ aiModelSelection: selection })
    },
    [patchBacktestSession],
  )

  useEffect(() => {
    if (!modelsQuery.data) return
    const candidate = selectedModel ?? persistedModelSelection
    const candidateExists =
      candidate &&
      availableModels.some(
        (model) => model.provider === candidate.provider && model.id === candidate.model,
      )
    if (candidateExists) return

    const defaultSelection = availableModels.find(
      (model) =>
        model.provider === modelsQuery.data.provider && model.id === modelsQuery.data.default_model,
    )
    const fallback = defaultSelection ?? availableModels[0]
    setSelectedModel(fallback ? { provider: fallback.provider, model: fallback.id } : null)
  }, [availableModels, modelsQuery.data, persistedModelSelection, selectedModel, setSelectedModel])

  const previewSpec = draftSpec ?? response?.strategy_spec ?? null
  const validationErrors = response?.validation?.errors ?? []
  const unsupportedRequests = response?.unsupported_requests ?? []
  const assumptions = response?.assumptions ?? []

  const workflowBlocker = useMemo(
    () =>
      getAiWorkflowBlocker({
        response,
        appliedToSetup,
        unsupportedAcknowledged,
        activeAiDraft,
      }),
    [activeAiDraft, appliedToSetup, response, unsupportedAcknowledged],
  )

  const canSave = useMemo(
    () =>
      canSaveAiStrategy({
        response,
        previewSpec,
        appliedToSetup,
        unsupportedAcknowledged,
        customName: config.authoring.customName,
      }),
    [appliedToSetup, config.authoring.customName, previewSpec, response, unsupportedAcknowledged],
  )

  const revisionDiff = useMemo(
    () =>
      compareRevisionSections(
        revisions.length > 1 ? revisions[revisions.length - 2] : null,
        revisions.at(-1) ?? null,
      ),
    [revisions],
  )

  const resetDraft = useCallback(() => {
    clearDoneHold()
    setMessage('')
    setConversation([])
    setTranscript([])
    transcriptIdRef.current = 0
    setDraftSpec(null)
    setResponse(null)
    setServiceError(null)
    setInterpretFailed(false)
    setOriginalPrompt('')
    setUnsupportedAcknowledged(false)
    setAppliedToSetup(false)
    setActiveAiDraft(false)
    setSaveError(null)
    setRevisions([])
    setAnsweringQuestion(null)
  }, [clearDoneHold])

  const startDoneHold = useCallback(() => {
    clearDoneHold()
    setDoneHoldActive(true)
    doneHoldTimerRef.current = setTimeout(() => {
      doneHoldTimerRef.current = null
      setDoneHoldActive(false)
    }, AI_VISUAL_DONE_HOLD_MS)
  }, [clearDoneHold])

  const setMessageWithVisualReset = useCallback(
    (next: string | ((current: string) => string)) => {
      setMessage((current) => {
        const resolved = typeof next === 'function' ? next(current) : next
        if (resolved !== current) {
          setServiceError(null)
          setInterpretFailed(false)
          clearDoneHold()
        }
        return resolved
      })
    },
    [clearDoneHold],
  )

  const ensureCapabilitiesVersion = useCallback(async () => {
    const capabilities = await queryClient.fetchQuery({
      queryKey: strategyBuilderKeys.capabilities(),
      queryFn: fetchStrategyBuilderCapabilities,
      staleTime: Infinity,
    })
    setCapabilitiesVersion(capabilities.schema_version)
    return capabilities.schema_version
  }, [queryClient])

  const hydrateFromMetadata = useCallback(
    (metadata?: AiStrategyMetadata | null) => {
      resetDraft()
      if (!metadata) return

      const hydratedResponse: AiStrategyResponse = {
        summary: metadata.strategy_spec.name,
        assumptions: metadata.assumptions,
        questions: [],
        unsupported_requests: metadata.unsupported_requests_acknowledged,
        change_notes: [],
        strategy_spec: metadata.strategy_spec,
        validation: { valid: true, errors: [] },
        compiled_strategy: metadata.compiled_strategy,
        confidence: 1,
      }

      setDraftSpec(metadata.strategy_spec)
      setOriginalPrompt(metadata.original_prompt)
      setUnsupportedAcknowledged(metadata.unsupported_requests_acknowledged.length > 0)
      setAppliedToSetup(true)
      setActiveAiDraft(true)
      setResponse(hydratedResponse)
      setRevisions([createRevisionSnapshot(metadata.original_prompt, hydratedResponse)])
      transcriptIdRef.current = 2
      setTranscript([
        {
          id: 'transcript-1',
          kind: 'user',
          content: metadata.original_prompt,
        },
        {
          id: 'transcript-2',
          kind: 'assistant',
          summary: hydratedResponse.summary,
          change_notes: [],
          questions: [],
          confidence: hydratedResponse.confidence,
          revisionIndex: 0,
        },
      ])
      if (metadata.ai_provider && metadata.ai_model) {
        const savedSelection = {
          provider: metadata.ai_provider,
          model: metadata.ai_model,
        }
        if (
          availableModels.some(
            (model) =>
              model.provider === savedSelection.provider && model.id === savedSelection.model,
          )
        ) {
          setSelectedModel(savedSelection)
        }
      }
    },
    [availableModels, resetDraft, setSelectedModel],
  )

  const submitInterpret = useCallback(
    async (
      nextMessage: string,
      validationErrorsToRepair: ValidationErrorDetail[] = [],
      fromQuestion?: string,
    ) => {
      const trimmed = nextMessage.trim()
      if (!trimmed) return

      clearDoneHold()
      setServiceError(null)
      setInterpretFailed(false)
      setSaveError(null)
      const userTurn: ConversationMessage = { role: 'user', content: trimmed }
      const nextConversation = [...conversation, userTurn]
      const activeQuestion = fromQuestion || answeringQuestion || undefined
      setConversation(nextConversation)
      setTranscript((current) => [
        ...current,
        {
          id: nextTranscriptId(),
          kind: 'user',
          content: trimmed,
          answeringQuestion: activeQuestion,
        },
      ])
      setAnsweringQuestion(null)
      if (!originalPrompt) {
        setOriginalPrompt(trimmed)
      }

      try {
        const nextCapabilitiesVersion = await ensureCapabilitiesVersion()
        const result = await interpretMutation.mutateAsync({
          message: trimmed,
          model: selectedModel?.model,
          ...(hasProviderContract && selectedModel?.provider
            ? { provider: selectedModel.provider }
            : {}),
          conversation: nextConversation,
          current_spec: draftSpec ?? response?.strategy_spec ?? null,
          capabilities_version: nextCapabilitiesVersion,
          validation_errors: validationErrorsToRepair,
        })

        const revisionIndex = revisions.length
        setResponse(result)
        setDraftSpec(result.strategy_spec)
        setUnsupportedAcknowledged(false)
        setAppliedToSetup(false)
        setActiveAiDraft(true)
        setConversation((current) => [...current, { role: 'assistant', content: result.summary }])
        setRevisions((current) => [...current, createRevisionSnapshot(trimmed, result)])
        setTranscript((current) => [
          ...current,
          {
            id: nextTranscriptId(),
            kind: 'assistant',
            summary: result.summary,
            change_notes: result.change_notes ?? [],
            questions: result.questions,
            confidence: result.confidence,
            revisionIndex,
          },
        ])
        setMessage('')
        startDoneHold()
      } catch (error) {
        clearDoneHold()
        const errorMessage = extractInterpretError(error)
        setServiceError(errorMessage)
        setInterpretFailed(true)
        setTranscript((current) => [
          ...current,
          { id: nextTranscriptId(), kind: 'notice', content: errorMessage },
        ])
      }
    },
    [
      answeringQuestion,
      clearDoneHold,
      conversation,
      draftSpec,
      ensureCapabilitiesVersion,
      interpretMutation,
      nextTranscriptId,
      originalPrompt,
      response?.strategy_spec,
      revisions.length,
      hasProviderContract,
      selectedModel,
      startDoneHold,
    ],
  )

  const handleApplyToSetup = useCallback(() => {
    if (!response?.compiled_strategy || !previewSpec) return
    applyCompiledStrategyToConfig(response.compiled_strategy, config, {
      draftName: previewSpec.name,
      draftDescription: response.summary,
    })
    setAppliedToSetup(true)
  }, [config, previewSpec, response])

  const handleSaveAiStrategy = useCallback(() => {
    setSaveError(null)
    if (!canSave || !previewSpec || !response?.compiled_strategy) {
      setSaveError(workflowBlocker ?? 'AI strategy is not ready to save.')
      return
    }

    const trimmedName = config.authoring.customName.trim()
    const metadata = buildAiStrategyMetadata({
      strategySpec: previewSpec,
      capabilitiesVersion,
      originalPrompt: originalPrompt || message.trim(),
      assumptions: response.assumptions,
      unsupportedRequestsAcknowledged: requiresUnsupportedAcknowledgement(response)
        ? unsupportedRequests
        : [],
      compiledStrategy: response.compiled_strategy,
      modelSelection: selectedModel,
    })

    const payload: CustomStrategy = {
      name: trimmedName,
      base_strategy: config.fields.strategy,
      description: config.authoring.description.trim() || response.summary,
      parameters: config.fields.strategyParams,
      ai_metadata: metadata,
    }

    config.authoring.saveCustomPayload(payload)
  }, [
    canSave,
    capabilitiesVersion,
    config.authoring,
    config.fields.strategy,
    config.fields.strategyParams,
    message,
    originalPrompt,
    previewSpec,
    response,
    selectedModel,
    unsupportedRequests,
    workflowBlocker,
  ])

  const handleDuplicate = useCallback(() => {
    if (!previewSpec || !response) return
    const nextName = duplicateStrategyName(previewSpec.name)
    config.authoring.newDraft()
    config.authoring.setCustomName(nextName)
    config.authoring.setDescription(response.summary)
    setAppliedToSetup(false)
    setUnsupportedAcknowledged(false)
    toast.success(`Duplicated as "${nextName}"`)
  }, [config.authoring, previewSpec, response])

  const handleExport = useCallback(() => {
    if (!previewSpec) return
    downloadStrategySpecJson(previewSpec)
  }, [previewSpec])

  const handleRunBacktest = useCallback(() => {
    if (workflowBlocker) {
      setSaveError(workflowBlocker)
      return
    }
    if (!onRunBacktest) return
    onRunBacktest(config.buildRequest())
  }, [config, onRunBacktest, workflowBlocker])

  const handleOptimize = useCallback(() => {
    if (workflowBlocker) {
      setSaveError(workflowBlocker)
      return
    }

    const optimizationConfig = buildOptimizationConfigFromBacktestFields(
      config.fields,
      config.selectedStrategy,
    )
    if (!optimizationConfig) {
      setSaveError('Unable to build an optimization config from the current setup.')
      return
    }

    setPendingOptimizationConfig(optimizationConfig)
    patchBacktestSession({ workflowMode: 'optimize' })
    onOptimize?.()
  }, [
    config.fields,
    config.selectedStrategy,
    onOptimize,
    patchBacktestSession,
    setPendingOptimizationConfig,
    workflowBlocker,
  ])

  const updateDraft = useCallback(
    (next: StrategySpec) => {
      setDraftSpec((current) => {
        if (current && JSON.stringify(current) !== JSON.stringify(next)) {
          setTranscript((entries) => [
            ...entries,
            {
              id: nextTranscriptId(),
              kind: 'notice',
              content: 'You edited the draft manually',
            },
          ])
        }
        return next
      })
      setAppliedToSetup(false)
    },
    [nextTranscriptId],
  )

  /** Incremental assistant output is not yet supported by the interpret API. */
  const hasIncrementalOutput = false

  return {
    message,
    setMessage: setMessageWithVisualReset,
    conversation,
    transcript,
    draftSpec,
    previewSpec,
    response,
    serviceError,
    interpretFailed,
    doneHoldActive,
    clearDoneHold,
    hasIncrementalOutput,
    saveError,
    validationErrors,
    unsupportedRequests,
    assumptions,
    unsupportedAcknowledged,
    setUnsupportedAcknowledged,
    appliedToSetup,
    activeAiDraft,
    workflowBlocker,
    canSave,
    revisionDiff,
    revisions,
    interpretMutation,
    selectedModel,
    setSelectedModel,
    availableModels,
    modelProviders,
    hasProviderContract,
    provider,
    modelsLoading,
    modelsError,
    submitInterpret,
    handleApplyToSetup,
    handleSaveAiStrategy,
    handleDuplicate,
    handleExport,
    handleRunBacktest,
    handleOptimize,
    resetDraft,
    hydrateFromMetadata,
    updateDraft,
    answeringQuestion,
    setAnsweringQuestion,
  }
}

export type AiStrategySession = ReturnType<typeof useAiStrategySession>
