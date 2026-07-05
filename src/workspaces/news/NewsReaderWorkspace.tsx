import { Newspaper, X, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { getCurrentWindow } from '@tauri-apps/api/window'
import { useNewsDetail } from '@/api/queries/news'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'

let appWindow: ReturnType<typeof getCurrentWindow> | null = null
try {
  appWindow = getCurrentWindow()
} catch {
  // Fallback for non-Tauri / standard web environments
}

const POSTER_MAP = {
  high: '/high_brightness/Quant_Background_Clean_High_Brightness.png',
  mid: '/mid_brightness/Quant_Background_Clean_Mid_Brightness.jpeg',
  low: '/mid_brightness/Quant_Background_Clean_Mid_Brightness.jpeg',
}

export function NewsReaderWorkspace({
  id,
  showInlineClose = true,
}: {
  id?: string
  showInlineClose?: boolean
}) {
  const resolvedBrightness = useResolvedBrightness()
  const posterPath = POSTER_MAP[resolvedBrightness]
  const { data: article, isPending } = useNewsDetail(id ?? '')

  const handleClose = async () => {
    try {
      if (appWindow) {
        await appWindow.close()
      } else {
        window.close()
      }
    } catch (err) {
      console.error('Failed to close window:', err)
      window.history.back()
    }
  }

  const formatPublishedAt = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return dateStr
    }
  }

  if (isPending) {
    return (
      <Panel className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="text-brass-400 h-8 w-8 animate-spin opacity-85" />
        <span className="text-silver-300 text-2xs mt-4 animate-pulse font-mono tracking-[0.08em] uppercase">
          Fetching Article Content...
        </span>
      </Panel>
    )
  }

  if (!article) {
    return (
      <Panel className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
        <Newspaper className="text-silver-500 mb-3 h-12 w-12 animate-pulse opacity-30" />
        <SectionHeader title="Article not found" className="justify-center" />
        <p className="text-silver-500 mt-2 text-xs">
          The requested article could not be located in our feed database.
        </p>
        <Button type="button" variant="ghost" className="mt-6 gap-2" onClick={handleClose}>
          <X className="h-4 w-4" /> Close Reader
        </Button>
      </Panel>
    )
  }

  return (
    <div className="animate-fade-in-up mx-auto flex max-w-2xl flex-col gap-6 py-4">
      <Panel className="flex items-center justify-between border-b-0 px-0 py-0 pb-3">
        <SectionHeader
          title={`${article.source} · ${formatPublishedAt(article.publishedAt)}`}
          className="flex-1"
        />
        {showInlineClose ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            onClick={handleClose}
            title="Close Reader"
            aria-label="Close Reader"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </Panel>

      <div className="flex flex-col gap-3">
        <h1 className="text-silver-100 font-sans text-2xl leading-tight font-medium tracking-tight md:text-3xl">
          {article.title}
        </h1>
        <p className="text-brass-400/90 border-brass-500 border-l-2 py-0.5 pl-4 font-sans text-sm leading-relaxed font-medium">
          {article.summary}
        </p>
      </div>

      {article.videoUrl ? (
        <Panel className="overflow-hidden bg-black p-0">
          <video
            src={article.videoUrl}
            controls
            preload="metadata"
            className="aspect-video w-full object-contain"
            poster={posterPath}
          />
        </Panel>
      ) : article.imageUrl ? (
        <Panel className="surface-card flex max-h-[360px] items-center justify-center overflow-hidden p-0">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="max-h-[360px] max-w-full rounded-xl object-cover"
          />
        </Panel>
      ) : null}

      <Panel className="p-5">
        <div className="text-silver-200 space-y-4 font-sans text-sm leading-relaxed whitespace-pre-wrap md:text-base">
          {article.content}
        </div>
      </Panel>
    </div>
  )
}
