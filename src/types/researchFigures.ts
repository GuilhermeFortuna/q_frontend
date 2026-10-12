import type {
  BulkDeleteResearchFiguresRequest,
  ResearchCollectionSummary,
  ResearchFigureListResponse,
  ResearchFigureMetadata,
  ResearchFigurePlotlyContent,
  ResearchFigureProvenance,
} from '../../contracts/api'

export type ResearchFigure = ResearchFigureMetadata
export type ResearchFigureCollection = ResearchCollectionSummary
export type ResearchFigureListPage = ResearchFigureListResponse
export type ResearchFigurePlotly = ResearchFigurePlotlyContent
export type ResearchFigureProvenanceInfo = ResearchFigureProvenance
export type ResearchFigureBulkDelete = BulkDeleteResearchFiguresRequest

export type ResearchFigureKind = 'image' | 'plotly'
