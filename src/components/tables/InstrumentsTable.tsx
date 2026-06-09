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
    cell: (info) => <span className="text-brass-400 font-mono">{info.getValue()}</span>,
  }),
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('exchange', { header: 'Exchange' }),
  columnHelper.accessor('assetClass', {
    header: 'Class',
    cell: (info) => (
      <span className="bg-carbon-700 text-silver-300 rounded px-2 py-0.5 text-xs uppercase">
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
    <div className="border-carbon-700 overflow-auto rounded-md border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-carbon-800/80 text-silver-400 text-xs tracking-wide uppercase">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 font-medium">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const symbol = row.original.symbol
            const isSelected = symbol === selectedSymbol
            return (
              <tr
                key={row.id}
                onClick={() => onSelectSymbol(symbol)}
                className={
                  isSelected
                    ? 'bg-brass-600/10 text-silver-100 cursor-pointer'
                    : 'border-carbon-800 text-silver-200 hover:bg-carbon-800/60 cursor-pointer border-t'
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
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
