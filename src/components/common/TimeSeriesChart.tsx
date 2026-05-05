import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { pickValue, unwrapList } from "@/lib/normalize"
import { DataState } from "./DataState"

interface TimeSeriesChartProps {
  data: unknown
  xKey?: string
  yKey?: string
  title: string
}

const xKeys = ["time", "timestamp", "datetime", "date", "fecha", "created_at"]
const yKeys = ["clean_value", "raw_value", "value", "measurement_value", "temperature", "oxygen"]

export function TimeSeriesChart({ data, xKey, yKey, title }: TimeSeriesChartProps) {
  const rows = unwrapList(data)
  const points = rows
    .map((row) => {
      const x = pickValue(row, xKey ? [xKey] : xKeys)
      const y = pickValue(row, yKey ? [yKey] : yKeys)
      const value = Number(y)
      return Number.isFinite(value) ? { time: x ? formatDate(x) : String(rows.indexOf(row) + 1), value } : null
    })
    .filter((point): point is { time: string; value: number } => Boolean(point))

  if (!points.length) return <DataState status="empty" message="sin mediciones recientes" />

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
