import { AlertCircle, CheckCircle2, Clock, Database, Loader2, ShieldAlert } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

export type DataStatus = "loading" | "empty" | "error" | "incomplete" | "blocked" | "success"

interface DataStateProps {
  status: DataStatus
  message?: string
}

const copy: Record<DataStatus, { title: string; message: string }> = {
  loading: { title: "cargando", message: "consultando API" },
  empty: { title: "sin datos", message: "sin registros disponibles" },
  error: { title: "error de API", message: "no se pudo completar la consulta" },
  incomplete: { title: "datos incompletos", message: "dato faltante" },
  blocked: { title: "bloqueado", message: "selecciona el contexto requerido" },
  success: { title: "listo", message: "datos actualizados" },
}

const icons = {
  loading: Loader2,
  empty: Database,
  error: AlertCircle,
  incomplete: ShieldAlert,
  blocked: Clock,
  success: CheckCircle2,
}

export function DataState({ status, message }: DataStateProps) {
  const Icon = icons[status]
  if (status === "loading") {
    return (
      <div className="space-y-2 rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4 animate-spin" />
          {copy.loading.title}
        </div>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  return (
    <Alert variant={status === "error" ? "destructive" : "default"} className="bg-card">
      <Icon className="h-4 w-4" />
      <AlertTitle>{copy[status].title}</AlertTitle>
      <AlertDescription>{message ?? copy[status].message}</AlertDescription>
    </Alert>
  )
}
