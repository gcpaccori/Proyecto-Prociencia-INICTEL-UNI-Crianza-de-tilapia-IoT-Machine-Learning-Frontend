export type ResourceId = "farms" | "ponds" | "sensors" | "actuators"

export interface ResourceField {
  name: string
  label: string
  type?: "text" | "number"
  required?: boolean
  defaultValue?: string
}

export interface ResourceConfig {
  id: ResourceId
  label: string
  endpoint: string
  detailEndpoint: string
  createEndpoint: string
  columns: string[]
  createFields: ResourceField[]
}

export const resources: ResourceConfig[] = [
  {
    id: "farms",
    label: "Granjas",
    endpoint: "/farms",
    detailEndpoint: "/farms/{id}",
    createEndpoint: "/farms",
    columns: ["id", "code", "name", "location_name", "created_at"],
    createFields: [
      { name: "code", label: "Codigo", required: true },
      { name: "name", label: "Nombre", required: true },
      { name: "location_name", label: "Ubicacion" },
      { name: "latitude", label: "Latitud", type: "number" },
      { name: "longitude", label: "Longitud", type: "number" },
    ],
  },
  {
    id: "ponds",
    label: "Estanques",
    endpoint: "/ponds",
    detailEndpoint: "/ponds/{id}",
    createEndpoint: "/ponds",
    columns: ["id", "farm_id", "code", "name", "pond_type", "created_at"],
    createFields: [
      { name: "farm_id", label: "Granja ID", required: true },
      { name: "code", label: "Codigo", required: true },
      { name: "name", label: "Nombre", required: true },
      { name: "pond_type", label: "Tipo" },
      { name: "water_volume_l", label: "Volumen L", type: "number" },
      { name: "surface_area_m2", label: "Area m2", type: "number" },
    ],
  },
  {
    id: "sensors",
    label: "Sensores",
    endpoint: "/sensors",
    detailEndpoint: "/sensors/{id}",
    createEndpoint: "/sensors",
    columns: ["id", "farm_id", "pond_id", "sensor_code", "variable_code", "status"],
    createFields: [
      { name: "farm_id", label: "Granja ID", required: true },
      { name: "pond_id", label: "Estanque ID" },
      { name: "sensor_code", label: "Codigo sensor", required: true },
      { name: "variable_code", label: "Variable", required: true },
      { name: "sensor_type", label: "Tipo" },
      { name: "status", label: "Estado", defaultValue: "active" },
    ],
  },
  {
    id: "actuators",
    label: "Actuadores",
    endpoint: "/actuators",
    detailEndpoint: "/actuators/{id}",
    createEndpoint: "/actuators",
    columns: ["id", "farm_id", "pond_id", "actuator_code", "actuator_type", "status"],
    createFields: [
      { name: "farm_id", label: "Granja ID", required: true },
      { name: "pond_id", label: "Estanque ID" },
      { name: "actuator_code", label: "Codigo actuador", required: true },
      { name: "actuator_type", label: "Tipo", required: true },
      { name: "status", label: "Estado", defaultValue: "active" },
    ],
  },
]
