export function QuantMeshBackground() {
  return (
    <div
      aria-hidden
      className="quant-mesh-bg pointer-events-none fixed inset-0 -z-10"
    >
      <div className="absolute inset-0 opacity-30">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="quant-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-carbon-700"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#quant-grid)" />
        </svg>
      </div>
    </div>
  )
}
