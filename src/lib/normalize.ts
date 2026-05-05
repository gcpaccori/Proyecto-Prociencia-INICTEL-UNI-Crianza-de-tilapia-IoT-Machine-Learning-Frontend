export type Row = Record<string, unknown>

const listKeys = ["data", "items", "results", "records"]
const idKeys = ["id", "uuid", "farm_id", "pond_id", "sensor_id", "actuator_id", "snapshot_id", "model_code", "code"]
const nameKeys = ["name", "nombre", "label", "title", "code", "model_code"]

function isRow(value: unknown): value is Row {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function toRows(value: unknown[]) {
  return value.filter(isRow)
}

export function unwrapList(value: unknown): Row[] {
  if (Array.isArray(value)) return toRows(value)
  if (!isRow(value)) return []
  for (const key of listKeys) {
    const list = unwrapList(value[key])
    if (list.length) return list
  }
  if (isRow(value.data)) return unwrapList(value.data)
  return []
}

export function unwrapObject(value: unknown): Row {
  if (isRow(value)) {
    if (isRow(value.data)) return value.data
    return value
  }
  return {}
}

export function pickValue(row: Row, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key]
  }
  return undefined
}

export function pickText(row: Row, keys: string[]) {
  const value = pickValue(row, keys)
  return typeof value === "string" ? value : value === undefined ? "" : String(value)
}

export function pickId(row: Row) {
  return pickText(row, idKeys)
}

export function pickName(row: Row) {
  return pickText(row, nameKeys) || pickId(row) || "sin datos"
}

export function objectList(value: unknown) {
  if (Array.isArray(value)) return unwrapList(value)
  if (isRow(value)) return Object.entries(value).map(([key, item]) => ({ key, value: item }))
  return []
}

export function query(endpoint: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const suffix = search.toString()
  return suffix ? `${endpoint}?${suffix}` : endpoint
}
