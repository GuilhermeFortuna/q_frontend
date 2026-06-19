import { Newspaper, X, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { getCurrentWindow } from '@tauri-apps/api/window'
import { useNewsDetail } from '@/api/queries/news'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'

let appWindow: ReturnType<typeof getCurrentWindow> | null = null
try {
  appWindow = getCurrentWindow()
} catch {
  // Fallback for non-Tauri / standard web environments
}

const POSTER_MAP = {
  high: '/high_brightness/Quant_Background_Clean_High_Brightness.png',
  mid: '/mid_brightness/Quant_Background_Clean_Mid_Brightness.jpeg',
  low: '/mid_brightness/Quant_Background_Clean_Mid_Brightness.jpeg', // Fallback
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
      // Browser fallback if window.close() is blocked
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
      <div className="bg-carbon-950/20 border-carbon-800/80 flex min-h-[300px] flex-col items-center justify-center rounded-xl border p-6 text-center">
        <RefreshCw className="text-brass-400 h-8 w-8 animate-spin opacity-85" />
        <span className="text-silver-300 mt-4 animate-pulse font-mono text-[10px] tracking-wider uppercase">
          Fetching Article Content...
        </span>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="bg-carbon-950/20 border-carbon-800/80 flex min-h-[300px] flex-col items-center justify-center rounded-xl border p-6 text-center">
        <Newspaper className="text-silver-500 mb-3 h-12 w-12 animate-pulse opacity-30" />
        <span className="text-silver-300 font-mono text-sm tracking-wider uppercase">
          Article Not Found
        </span>
        <p className="text-silver-500 mt-2 text-xs">
          The requested article could not be located in our feed database.
        </p>
        <button
          onClick={handleClose}
          className="border-carbon-700 bg-carbon-900 hover:text-brass-400 hover:border-brass-600/30 text-silver-300 mt-6 flex items-center gap-2 rounded-lg border px-4 py-2 text-xs transition-colors"
        >
          <X className="h-4 w-4" /> Close Reader
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up mx-auto flex max-w-2xl flex-col gap-6 py-4">
      {/* Top Controls Bar */}
      <div className="border-carbon-800 flex items-center justify-between border-b pb-3">
        <div className="text-silver-400 flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase">
          <span>{article.source}</span>
          <span>·</span>
          <span>{formatPublishedAt(article.publishedAt)}</span>
        </div>
        {showInlineClose && (
          <button
            onClick={handleClose}
            className="border-carbon-800 bg-carbon-900/50 hover:bg-carbon-800 hover:text-silver-100 text-silver-400 flex items-center justify-center rounded-lg border p-1.5 transition-colors"
            title="Close Reader"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main Heading */}
      <div className="flex flex-col gap-3">
        <h1 className="text-silver-100 font-sans text-2xl leading-tight font-medium tracking-tight md:text-3xl">
          {article.title}
        </h1>
        <p className="text-brass-400/90 border-brass-500 border-l-2 py-0.5 pl-4 font-sans text-sm leading-relaxed font-medium">
          {article.summary}
        </p>
      </div>

      {/* Video or Image Player */}
      {article.videoUrl ? (
        <div className="quant-panel border-brass-600/15 overflow-hidden rounded-xl border bg-black shadow-2xl">
          <video
            src={article.videoUrl}
            controls
            preload="metadata"
            className="aspect-video w-full object-contain"
            poster={posterPath}
          />
        </div>
      ) : article.imageUrl ? (
        <div className="quant-panel border-brass-600/15 bg-carbon-900 flex max-h-[360px] items-center justify-center overflow-hidden rounded-xl border shadow-2xl">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="max-h-[360px] max-w-full rounded-xl object-cover"
          />
        </div>
      ) : null}

      {/* Content Text */}
      <div className="text-silver-200 space-y-4 font-sans text-sm leading-relaxed whitespace-pre-wrap md:text-base">
        {article.content}
      </div>
    </div>
  )
}
