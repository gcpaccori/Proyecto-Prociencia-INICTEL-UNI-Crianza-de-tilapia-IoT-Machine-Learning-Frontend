export type StatusVariant = "default" | "secondary" | "destructive" | "outline"

export function formatNumber(value: unknown): string {
  const number = Number(value)
  return Number.isFinite(number) ? new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(number) : "dato faltante"
}

export function formatDate(value: unknown): string {
  if (!value) return "dato faltante"
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? "dato faltante" : date.toLocaleString("es-PE")
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value))) return "dato faltante"
  if (typeof value === "number") return formatNumber(value)
  if (typeof value === "boolean") return value ? "si" : "no"
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value)
  if (typeof value === "object") return "ver detalle"
  return String(value)
}

export function statusVariant(value: unknown): StatusVariant {
  const status = String(value ?? "").toLowerCase()
  if (/(error|caida|critical|high|open|destructive|invalid|blocked|failed)/.test(status)) return "destructive"
  if (/(pending|approval|warning|medium|incomplete|omitido|fallback)/.test(status)) return "secondary"
  if (/(ready|ok|active|connected|conectada|valid|success|closed|low)/.test(status)) return "default"
  return "outline"
}
