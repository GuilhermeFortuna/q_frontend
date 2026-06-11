import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

import type { Instrument } from '@/types/api'

const columnHelper = createColumnHelper<Instrument>()

const columns = [
  columnHelper.accessor('symbol', {
    header: 'Symbol',
    cell: (info) => <span className="text-brass-400 font-mono font-bold">{info.getValue()}</span>,
  }),
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('exchange', { header: 'Exchange' }),
  columnHelper.accessor('assetClass', {
    header: 'Class',
    cell: (info) => (
      <span className="bg-carbon-950/60 border-carbon-800 text-silver-300 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
        {info.getValue()}
      </span>
    ),
  }),
]

type InstrumentsTableProps = {
  data: Instrument[]
  selectedSymbol: string
  onSelectSymbol: (symbol: string) => void
}

export function InstrumentsTable({ data, selectedSymbol, onSelectSymbol }: InstrumentsTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="border-brass-600/15 bg-carbon-900/40 overflow-auto rounded-xl border shadow-lg">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-carbon-950/60 border-brass-600/15 text-silver-400 border-b text-[10px] font-bold tracking-wider uppercase">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-bold">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-carbon-800/60 divide-y">
          {table.getRowModel().rows.map((row) => {
            const symbol = row.original.symbol
            const isSelected = symbol === selectedSymbol
            return (
              <tr
                key={row.id}
                onClick={() => onSelectSymbol(symbol)}
                className={
                  isSelected
                    ? 'bg-brass-600/15 text-silver-100 cursor-pointer shadow-[inset_3px_0_0_#c4a574] transition-all duration-150'
                    : 'border-carbon-800/60 text-silver-200 hover:bg-carbon-800/35 cursor-pointer border-t transition-all duration-150'
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 font-medium">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
