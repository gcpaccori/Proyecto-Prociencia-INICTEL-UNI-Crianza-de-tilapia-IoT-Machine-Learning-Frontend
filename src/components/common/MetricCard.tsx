import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatValue } from "@/lib/format"
import { StatusBadge } from "./StatusBadge"

interface MetricCardProps {
  title: string
  value: unknown
  unit?: string
  description?: string
  status?: unknown
}

export function MetricCard({ title, value, unit, description, status }: MetricCardProps) {
  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        {status ? <StatusBadge value={status} /> : null}
      </CardHeader>
      <CardContent>
        <div className="font-mono text-2xl font-semibold tracking-normal">
          {formatValue(value)}
          {unit ? <span className="ml-1 text-xs text-muted-foreground">{unit}</span> : null}
        </div>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  )
}
