export const waterVariables = [
  { code: "water_temperature_c", label: "Temperatura", unit: "degC" },
  { code: "ph", label: "pH", unit: "pH" },
  { code: "dissolved_oxygen_mg_l", label: "Oxigeno disuelto", unit: "mg/L" },
  { code: "nitrate_ion", label: "Ion nitrato", unit: "mg/L" },
] as const

export const defaultWaterVariable = "water_temperature_c"

export function variableMeta(code: string) {
  return waterVariables.find((item) => item.code === code) ?? { code, label: code, unit: "" }
}
