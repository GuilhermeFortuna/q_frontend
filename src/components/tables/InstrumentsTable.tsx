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
    cell: (info) => <span className="font-mono text-brass-400">{info.getValue()}</span>,
  }),
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('exchange', { header: 'Exchange' }),
  columnHelper.accessor('assetClass', {
    header: 'Class',
    cell: (info) => (
      <span className="rounded bg-carbon-700 px-2 py-0.5 text-xs uppercase text-silver-300">
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

export function InstrumentsTable({
  data,
  selectedSymbol,
  onSelectSymbol,
}: InstrumentsTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-auto rounded-md border border-carbon-700">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-carbon-800/80 text-xs tracking-wide text-silver-400 uppercase">
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
                    ? 'cursor-pointer bg-brass-600/10 text-silver-100'
                    : 'cursor-pointer border-t border-carbon-800 text-silver-200 hover:bg-carbon-800/60'
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
