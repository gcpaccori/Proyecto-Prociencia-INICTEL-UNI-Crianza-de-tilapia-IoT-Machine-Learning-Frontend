import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { statusVariant } from "@/lib/format"

interface StatusBadgeProps {
  value: unknown
  className?: string
}

const labels: Record<string, string> = {
  ok: "API conectada",
  connected: "API conectada",
  down: "API caida",
  open: "alerta abierta",
  pending: "pendiente",
  pending_dispatch: "comando pendiente",
  approval_required: "aprobacion requerida",
  not_executable: "modelo no ejecutable",
  incomplete: "dato incompleto",
}

export function StatusBadge({ value, className }: StatusBadgeProps) {
  const raw = String(value ?? "dato faltante")
  const key = raw.toLowerCase().replaceAll(" ", "_")
  return (
    <Badge variant={statusVariant(raw)} className={cn("whitespace-nowrap font-mono text-[11px]", className)}>
      {labels[key] ?? raw}
    </Badge>
  )
}
