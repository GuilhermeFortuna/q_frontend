import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'
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
    <Table className="min-w-[480px]">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow
            key={headerGroup.id}
            className="bg-carbon-950/60 border-brass-600/15 border-b hover:bg-transparent"
          >
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const symbol = row.original.symbol
          const isSelected = symbol === selectedSymbol
          return (
            <TableRow
              key={row.id}
              onClick={() => onSelectSymbol(symbol)}
              isSelected={isSelected}
              className="cursor-pointer"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
