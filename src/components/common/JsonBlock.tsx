import { cn } from "@/lib/utils"

interface JsonBlockProps {
  value: unknown
  title?: string
  compact?: boolean
}

export function JsonBlock({ value, title = "JSON", compact }: JsonBlockProps) {
  const text = JSON.stringify(value ?? "dato faltante", null, 2)
  const body = (
    <pre className={cn("max-h-80 overflow-auto rounded-md border border-border bg-background/60 p-3 text-xs text-muted-foreground", compact && "max-h-48")}>
      {text}
    </pre>
  )

  if (compact) {
    return (
      <details className="max-w-[18rem]">
        <summary className="cursor-pointer text-xs text-primary">ver detalle</summary>
        {body}
      </details>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {body}
    </div>
  )
}
