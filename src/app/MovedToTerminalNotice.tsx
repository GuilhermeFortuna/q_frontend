import { Panel } from '@/components/ui/Panel'

type MovedToTerminalNoticeProps = {
  /** Distinguishes the former live-monitor window from the workspace route. */
  context?: 'workspace' | 'monitor'
}

export function MovedToTerminalNotice({ context = 'workspace' }: MovedToTerminalNoticeProps) {
  const title = context === 'monitor' ? 'Live execution monitor moved' : 'Execution workspace moved'

  return (
    <main
      className="flex min-h-[60vh] items-center justify-center p-6"
      data-testid="moved-to-terminal-notice"
      data-moved-context={context}
    >
      <Panel className="max-w-lg p-8 text-center">
        <h1 className="text-silver-100 mb-3 text-xl font-medium">{title}</h1>
        <p className="text-silver-300 text-sm leading-relaxed">
          Live trading and paper operations now live in <strong>q_terminal</strong>, the native
          operations terminal. This research app keeps backtests, optimization, discovery and
          research only.
        </p>
        <p className="text-silver-400 mt-4 text-xs">
          Launch the terminal from the workspace root with{' '}
          <code className="text-silver-200">./dev up terminal</code> or{' '}
          <code className="text-silver-200">cd q_terminal &amp;&amp; make run</code>.
        </p>
      </Panel>
    </main>
  )
}
