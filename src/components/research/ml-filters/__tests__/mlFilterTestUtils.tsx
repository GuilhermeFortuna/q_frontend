import {
  getMockMlTrainingStatus,
  startMockMlTraining,
  getMockMlTrainingRequest,
} from '@/mocks/mlFilters'

/** Completes a mock training job synchronously and returns its dataset and model ids. */
export function trainMockModels() {
  const started = startMockMlTraining(getMockMlTrainingRequest())
  if (!('jobId' in started)) throw new Error('mock training did not start')
  let status = getMockMlTrainingStatus(started.jobId)
  for (let i = 0; i < 12 && status?.status !== 'completed'; i += 1) {
    status = getMockMlTrainingStatus(started.jobId)
  }
  return {
    datasetId: status?.dataset_id as string,
    modelIds: (status?.model_version_ids ?? []) as string[],
  }
}
