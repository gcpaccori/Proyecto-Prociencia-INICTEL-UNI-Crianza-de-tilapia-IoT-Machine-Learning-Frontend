export type ViewId =
  | "operation"
  | "management"
  | "ingest"
  | "digitalTwin"
  | "models"
  | "alerts"
  | "actuation"

export const navigationItems: { id: ViewId; label: string }[] = [
  { id: "operation", label: "Operacion" },
  { id: "management", label: "Gestion Acuicola" },
  { id: "ingest", label: "Ingesta" },
  { id: "digitalTwin", label: "Gemelo Digital" },
  { id: "models", label: "Modelos" },
  { id: "alerts", label: "Alertas" },
  { id: "actuation", label: "Actuacion" },
]
