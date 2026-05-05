import type { KeyboardEvent } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatValue } from "@/lib/format"
import type { Row } from "@/lib/normalize"
import { pickValue } from "@/lib/normalize"
import { cn } from "@/lib/utils"
import { DataState } from "./DataState"
import { JsonBlock } from "./JsonBlock"
import { StatusBadge } from "./StatusBadge"

interface AutoTableProps {
  title: string
  data: Row[]
  columns: string[]
  isLoading?: boolean
  error?: unknown
  emptyMessage?: string
  onRowClick?: (row: Row) => void
}

function isStatusColumn(column: string) {
  return /(status|estado|severity|priority|level|quality|validation|readiness|execution|command)/i.test(column)
}

function renderCell(row: Row, column: string) {
  const value = pickValue(row, [column])
  if (value && typeof value === "object") return <JsonBlock value={value} compact />
  if (isStatusColumn(column)) return <StatusBadge value={value ?? "dato faltante"} />
  return <span className="text-xs">{formatValue(value)}</span>
}

export function AutoTable({ title, data, columns, isLoading, error, emptyMessage, onRowClick }: AutoTableProps) {
  const visibleColumns = columns.length ? columns : Object.keys(data[0] ?? {}).slice(0, 6)
  const message = error instanceof Error ? error.message : error ? String(error) : ""

  if (isLoading) {
    return (
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) return <DataState status="error" message={message} />
  if (!data.length) return <DataState status="empty" message={emptyMessage ?? "sin datos"} />

  const keyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (event.key === "Enter" || event.key === " ") onRowClick?.(row)
  }

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((column) => (
                  <TableHead key={column} className="h-9 text-xs">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow
                  key={String(pickValue(row, ["id", "uuid", "code", "model_code", "snapshot_id", "command_id"]) ?? index)}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => keyDown(event, row)}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {visibleColumns.map((column) => (
                    <TableCell key={column} className="max-w-72 align-top">
                      {renderCell(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
