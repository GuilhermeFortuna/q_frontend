import { cn } from '@/lib/utils'

interface DockIconProps {
  className?: string
}

export function LauncherIcon({ className }: DockIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6 overflow-visible', className)}
    >
      <defs>
        <linearGradient
          id="gold-grad-launcher"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f5d08f" />
          <stop offset="50%" stopColor="#cfab6c" />
          <stop offset="100%" stopColor="#8c6a38" />
        </linearGradient>
        <linearGradient
          id="brass-grad-launcher"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#a88b52" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#69512b" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <style>{`
        .launch-ring {
          transform-origin: 12px 12px;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .group:hover .launch-ring {
          transform: rotate(180deg);
        }
        .launch-core {
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .group:hover .launch-core {
          transform: scale(1.1) translate(-0.5px, -0.5px);
        }
      `}</style>

      {/* Background glowing circle */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="url(#brass-grad-launcher)"
        stroke="url(#gold-grad-launcher)"
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />

      {/* Outer rotating dash ring */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="url(#gold-grad-launcher)"
        strokeWidth="1.25"
        strokeDasharray="4 3"
        strokeLinecap="round"
        className="launch-ring"
      />

      {/* Central Portal/Launcher Symbol */}
      <path
        d="M12 6L7 11H10V17H14V11H17L12 6Z"
        fill="url(#gold-grad-launcher)"
        className="launch-core"
        stroke="url(#gold-grad-launcher)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MarketIcon({ className }: DockIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6 overflow-visible', className)}
    >
      <defs>
        <linearGradient
          id="gold-grad-market"
          x1="0"
          y1="24"
          x2="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#8c6a38" />
          <stop offset="60%" stopColor="#cfab6c" />
          <stop offset="100%" stopColor="#f5d08f" />
        </linearGradient>
      </defs>
      <style>{`
        .market-bar-1, .market-bar-2, .market-bar-3 {
          transform-origin: bottom;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .group:hover .market-bar-1 {
          transform: scaleY(1.3);
        }
        .group:hover .market-bar-2 {
          transform: scaleY(1.2);
          transition-delay: 0.05s;
        }
        .group:hover .market-bar-3 {
          transform: scaleY(1.35);
          transition-delay: 0.1s;
        }
      `}</style>

      {/* Grid lines in background */}
      <line
        x1="3"
        y1="19"
        x2="21"
        y2="19"
        stroke="#a88b52"
        strokeWidth="0.75"
        strokeOpacity="0.25"
      />
      <line
        x1="3"
        y1="13"
        x2="21"
        y2="13"
        stroke="#a88b52"
        strokeWidth="0.75"
        strokeOpacity="0.15"
        strokeDasharray="2 2"
      />
      <line
        x1="3"
        y1="7"
        x2="21"
        y2="7"
        stroke="#a88b52"
        strokeWidth="0.75"
        strokeOpacity="0.1"
        strokeDasharray="2 2"
      />

      {/* Bar 1 */}
      <rect
        x="5"
        y="14"
        width="3.5"
        height="5"
        rx="1"
        fill="url(#gold-grad-market)"
        className="market-bar-1"
        style={{ transformOrigin: '5px 19px' }}
      />
      {/* Bar 2 */}
      <rect
        x="10.25"
        y="9"
        width="3.5"
        height="10"
        rx="1"
        fill="url(#gold-grad-market)"
        className="market-bar-2"
        style={{ transformOrigin: '10.25px 19px' }}
      />
      {/* Bar 3 */}
      <rect
        x="15.5"
        y="4"
        width="3.5"
        height="15"
        rx="1"
        fill="url(#gold-grad-market)"
        className="market-bar-3"
        style={{ transformOrigin: '15.5px 19px' }}
      />

      {/* Trend Arrow */}
      <path
        d="M14 8L18.5 3.5M18.5 3.5H15M18.5 3.5V7"
        stroke="#f5d08f"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="market-bar-3"
        style={{ transformOrigin: '15.5px 19px' }}
      />
    </svg>
  )
}

export function StorageIcon({ className }: DockIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6 overflow-visible', className)}
    >
      <defs>
        <linearGradient
          id="gold-grad-storage"
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f5d08f" />
          <stop offset="50%" stopColor="#cfab6c" />
          <stop offset="100%" stopColor="#8c6a38" />
        </linearGradient>
      </defs>
      <style>{`
        .db-node {
          transition: fill 0.3s ease, filter 0.3s ease;
        }
        .group:hover .db-node-1 {
          fill: #ffe3b3;
          filter: drop-shadow(0 0 2px #ffe3b3);
        }
        .group:hover .db-node-2 {
          fill: #ffe3b3;
          filter: drop-shadow(0 0 2px #ffe3b3);
          transition-delay: 0.1s;
        }
        .group:hover .db-node-3 {
          fill: #ffe3b3;
          filter: drop-shadow(0 0 2px #ffe3b3);
          transition-delay: 0.2s;
        }
      `}</style>

      {/* Top cylinder */}
      <path
        d="M4 6C4 4.34 7.58 3 12 3C16.42 3 20 4.34 20 6M4 6V10C4 11.66 7.58 13 12 13C16.42 13 20 11.66 20 10V6M4 6C4 7.66 7.58 9 12 9C16.42 9 20 7.66 20 6"
        stroke="url(#gold-grad-storage)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* Indicator node top */}
      <circle cx="8" cy="6.5" r="0.75" fill="#cfab6c" className="db-node db-node-1" />

      {/* Middle cylinder */}
      <path
        d="M4 11C4 12.66 7.58 14 12 14C16.42 14 20 12.66 20 11M4 11V15C4 16.66 7.58 18 12 18C16.42 18 20 16.66 20 15V11"
        stroke="url(#gold-grad-storage)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* Indicator node middle */}
      <circle cx="8" cy="11.5" r="0.75" fill="#cfab6c" className="db-node db-node-2" />

      {/* Bottom cylinder */}
      <path
        d="M4 16C4 17.66 7.58 19 12 19C16.42 19 20 17.66 20 16M4 16V20C4 21.66 7.58 23 12 23C16.42 23 20 21.66 20 20V16"
        stroke="url(#gold-grad-storage)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* Indicator node bottom */}
      <circle cx="8" cy="16.5" r="0.75" fill="#cfab6c" className="db-node db-node-3" />
    </svg>
  )
}

export function BacktestsIcon({ className }: DockIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6 overflow-visible', className)}
    >
      <defs>
        <linearGradient
          id="gold-grad-backtest"
          x1="0"
          y1="4"
          x2="24"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f5d08f" />
          <stop offset="100%" stopColor="#8c6a38" />
        </linearGradient>
        <linearGradient
          id="gold-fade-backtest"
          x1="0"
          y1="4"
          x2="0"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#cfab6c" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#cfab6c" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <style>{`
        @keyframes waveFlow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -16; }
        }
        .backtest-grid {
          stroke: #a88b52;
          stroke-opacity: 0.12;
        }
        .backtest-path {
          stroke-dasharray: 80;
          stroke-dashoffset: 80;
          transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .group:hover .backtest-path {
          stroke-dashoffset: 0;
        }
        .backtest-flow {
          stroke-dasharray: 6 3;
          animation: waveFlow 1.5s linear infinite;
          animation-play-state: paused;
        }
        .group:hover .backtest-flow {
          animation-play-state: running;
        }
      `}</style>

      {/* Grid lines */}
      <line x1="3" y1="4" x2="3" y2="20" className="backtest-grid" />
      <line x1="9" y1="4" x2="9" y2="20" className="backtest-grid" />
      <line x1="15" y1="4" x2="15" y2="20" className="backtest-grid" />
      <line x1="21" y1="4" x2="21" y2="20" className="backtest-grid" />
      <line x1="3" y1="12" x2="21" y2="12" className="backtest-grid" />

      {/* Wave shape fill */}
      <path
        d="M3 16C6.5 16 7.5 7 11 7C14.5 7 15.5 17 19 17C20.5 17 21 15.5 21 15.5V20H3V16Z"
        fill="url(#gold-fade-backtest)"
      />

      {/* Active running pulse trace (only visible on hover/flow) */}
      <path
        d="M3 16C6.5 16 7.5 7 11 7C14.5 7 15.5 17 19 17"
        stroke="url(#gold-grad-backtest)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="backtest-flow"
      />

      {/* Solid background line */}
      <path
        d="M3 16C6.5 16 7.5 7 11 7C14.5 7 15.5 17 19 17"
        stroke="url(#gold-grad-backtest)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="backtest-path"
      />
    </svg>
  )
}

export function ValidateIcon({ className }: DockIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6 overflow-visible', className)}
    >
      <defs>
        <linearGradient
          id="gold-grad-validate"
          x1="12"
          y1="2"
          x2="12"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f5d08f" />
          <stop offset="100%" stopColor="#8c6a38" />
        </linearGradient>
      </defs>
      <style>{`
        .validate-checkmark {
          stroke-dasharray: 18;
          stroke-dashoffset: 18;
          transition: stroke-dashoffset 0.5s ease-in-out;
        }
        .group:hover .validate-checkmark {
          stroke-dashoffset: 0;
        }
        .validate-shield {
          transform-origin: 12px 12px;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .group:hover .validate-shield {
          transform: scale(1.05);
        }
      `}</style>

      {/* Double border premium shield */}
      <path
        d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
        stroke="url(#gold-grad-validate)"
        strokeWidth="1.25"
        strokeLinejoin="round"
        className="validate-shield"
      />
      <path
        d="M12 20C12 20 18.5 16.5 18.5 11.5V5.5L12 2.8L5.5 5.5V11.5C5.5 16.5 12 20 12 20Z"
        stroke="url(#gold-grad-validate)"
        strokeWidth="0.5"
        strokeOpacity="0.4"
        className="validate-shield"
      />

      {/* Core validating checkmark */}
      <path
        d="M8.5 11.5L11 14L16 9"
        stroke="#f5d08f"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="validate-checkmark"
      />
    </svg>
  )
}

export function DiscoverIcon({ className }: DockIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6 overflow-visible', className)}
    >
      <defs>
        <linearGradient
          id="gold-grad-discover"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f5d08f" />
          <stop offset="100%" stopColor="#8c6a38" />
        </linearGradient>
      </defs>
      <style>{`
        .compass-pointer {
          transform-origin: 12px 12px;
          transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1.25);
        }
        .group:hover .compass-pointer {
          transform: rotate(45deg);
        }
      `}</style>

      {/* Compass face */}
      <circle cx="12" cy="12" r="9" stroke="url(#gold-grad-discover)" strokeWidth="1.25" />
      <circle
        cx="12"
        cy="12"
        r="9.75"
        stroke="url(#gold-grad-discover)"
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />

      {/* Compass directions ticks */}
      <line x1="12" y1="3" x2="12" y2="4.5" stroke="#f5d08f" strokeWidth="1" />
      <line x1="12" y1="19.5" x2="12" y2="21" stroke="#f5d08f" strokeWidth="1" />
      <line x1="3" y1="12" x2="4.5" y2="12" stroke="#f5d08f" strokeWidth="1" />
      <line x1="19.5" y1="12" x2="21" y2="12" stroke="#f5d08f" strokeWidth="1" />

      {/* Dial needle */}
      <path
        d="M12 5L14 12L12 19L10 12L12 5Z"
        fill="url(#gold-grad-discover)"
        stroke="url(#gold-grad-discover)"
        strokeWidth="0.5"
        strokeLinejoin="round"
        className="compass-pointer"
      />
      {/* Pivot point */}
      <circle cx="12" cy="12" r="1.5" fill="#f5d08f" stroke="#8c6a38" strokeWidth="0.5" />
    </svg>
  )
}

export function SystemIcon({ className }: DockIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6 overflow-visible', className)}
    >
      <defs>
        <linearGradient
          id="gold-grad-system"
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f5d08f" />
          <stop offset="100%" stopColor="#8c6a38" />
        </linearGradient>
      </defs>
      <style>{`
        .system-gear-large {
          transform-origin: 10px 10px;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .system-gear-small {
          transform-origin: 17px 16px;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .group:hover .system-gear-large {
          transform: rotate(90deg);
        }
        .group:hover .system-gear-small {
          transform: rotate(-135deg);
        }
      `}</style>

      {/* Larger gear at center/top-left */}
      <path
        d="M10 7.5C8.62 7.5 7.5 8.62 7.5 10C7.5 11.38 8.62 12.5 10 12.5C11.38 12.5 12.5 11.38 12.5 10C12.5 8.62 11.38 7.5 10 7.5ZM10 14C7.79 14 6 12.21 6 10C6 7.79 7.79 6 10 6C12.21 6 14 7.79 14 10C14 12.21 12.21 14 10 14Z"
        fill="url(#gold-grad-system)"
        fillRule="evenodd"
        clipRule="evenodd"
        className="system-gear-large"
      />
      {/* Teeth details large gear */}
      <path
        d="M10 4V6M10 14V16M4 10H6M14 10H16M5.76 5.76L7.17 7.17M12.83 12.83L14.24 14.24M5.76 14.24L7.17 12.83M12.83 7.17L14.24 5.76"
        stroke="url(#gold-grad-system)"
        strokeWidth="1.25"
        strokeLinecap="round"
        className="system-gear-large"
      />

      {/* Smaller interlocking gear at bottom-right */}
      <circle
        cx="17"
        cy="16"
        r="2"
        stroke="url(#gold-grad-system)"
        strokeWidth="1"
        className="system-gear-small"
      />
      {/* Teeth details small gear */}
      <path
        d="M17 13V14M17 18V19M14 16H15M19 16H20M14.88 13.88L15.58 14.58M18.42 17.42L19.12 18.12M14.88 18.12L15.58 17.42M18.42 14.58L19.12 13.88"
        stroke="url(#gold-grad-system)"
        strokeWidth="1"
        strokeLinecap="round"
        className="system-gear-small"
      />
    </svg>
  )
}
