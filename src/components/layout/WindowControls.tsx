import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { getCurrentWindow, type WebviewWindow } from '@tauri-apps/api/window'

let appWindow: WebviewWindow | null = null
try {
  appWindow = getCurrentWindow()
} catch {
  // Fallback for non-Tauri / standard web environments
}

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!appWindow) return

    const updateMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized()
        setIsMaximized(maximized)
      } catch (err) {
        console.error(err)
      }
    }

    updateMaximized()

    const handleResize = () => {
      updateMaximized()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // If not running in Tauri (e.g. running in web browser dev environment), don't render native controls
  if (!appWindow) return null

  const handleMinimize = async () => {
    if (appWindow) {
      try {
        await appWindow.minimize()
      } catch (err) {
        console.error('Failed to minimize window:', err)
      }
    }
  }

  const handleMaximize = async () => {
    if (appWindow) {
      try {
        await appWindow.toggleMaximize()
      } catch (err) {
        console.error('Failed to toggle maximize:', err)
      }
    }
  }

  const handleClose = async () => {
    if (appWindow) {
      try {
        await appWindow.close()
      } catch (err) {
        console.error('Failed to close window:', err)
      }
    }
  }

  return (
    <div className="-my-2.5 -mr-6 flex h-[60px] items-center select-none" data-tauri-no-drag>
      <button
        onClick={handleMinimize}
        title="Minimize"
        className="text-brass-400/70 hover:bg-brass-600/10 hover:text-brass-200 active:bg-brass-600/20 flex h-full w-12 cursor-pointer items-center justify-center transition-colors duration-150 focus:outline-none"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        onClick={handleMaximize}
        title={isMaximized ? 'Restore' : 'Maximize'}
        className="text-brass-400/70 hover:bg-brass-600/10 hover:text-brass-200 active:bg-brass-600/20 flex h-full w-12 cursor-pointer items-center justify-center transition-colors duration-150 focus:outline-none"
      >
        {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={handleClose}
        title="Close"
        className="text-brass-400/70 flex h-full w-12 cursor-pointer items-center justify-center transition-colors duration-150 hover:bg-red-600/85 hover:text-white focus:outline-none active:bg-red-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
