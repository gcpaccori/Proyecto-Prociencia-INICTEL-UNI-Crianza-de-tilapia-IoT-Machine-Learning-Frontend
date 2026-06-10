import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Database,
  Droplet,
  FileJson,
  Fish,
  FlaskConical,
  Gauge,
  Home,
  LineChart as LineChartIcon,
  Power,
  RefreshCcw,
  Rocket,
  Settings,
  Table2,
  Wand2,
  Waves,
  type LucideIcon,
} from "lucide-react"
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { ViewContext } from "@/App"
import { apiGet, apiPost } from "@/lib/api"
import { pickId, pickName, query, unwrapList, unwrapObject, type Row } from "@/lib/normalize"

type MlopsScreen = "summary" | "data" | "cleaning" | "features" | "training" | "artifacts" | "models" | "digitalTwin" | "traceability"
type StatusKind = "success" | "warning" | "info" | "danger" | "purple" | "neutral"

const defaultPond = "LEGACY-POND-1"
const defaultModel = "ML_SUPERVISED_LINEAR_REG"
const preferredVisualModel = "ML_NONLINEAR_SVM"
const defaultVariables = ["water_temperature_c", "ph", "dissolved_oxygen_mg_l", "nitrate_ion"]
const twinModelColors = ["#1976ff", "#16a34a", "#f59e0b", "#8b5cf6", "#ef4444", "#0891b2", "#db2777", "#64748b", "#0f766e", "#c2410c"]

const modelUiCatalog: Record<string, { name: string; family: string; purpose: string; output: string }> = {
  ML_SUPERVISED_LINEAR_REG: {
    name: "Regresion lineal de calidad de agua",
    family: "Supervisado tabular",
    purpose: "Estima una variable objetivo desde telemetria limpia.",
    output: "valor continuo",
  },
  ML_SUPERVISED_LOGISTIC_REG: {
    name: "Clasificacion logistica operativa",
    family: "Supervisado tabular",
    purpose: "Clasifica estados discretos derivados del target entrenado.",
    output: "clase 0/1",
  },
  ML_NONLINEAR_DECISION_TREE: {
    name: "Arbol de decision no lineal",
    family: "Supervisado no lineal",
    purpose: "Explica reglas simples de prediccion sobre variables del estanque.",
    output: "valor continuo",
  },
  ML_NONLINEAR_RANDOM_FOREST: {
    name: "Random Forest no lineal",
    family: "Ensamble supervisado",
    purpose: "Reduce variacion usando multiples arboles entrenados.",
    output: "valor continuo",
  },
  ML_NONLINEAR_SVM: {
    name: "SVR / maquina de soporte vectorial",
    family: "Supervisado no lineal",
    purpose: "Modela relaciones suaves entre sensores y variable objetivo.",
    output: "valor continuo",
  },
  ML_NONSUPERVISED_KNN: {
    name: "KNN de respuesta local",
    family: "Vecinos cercanos",
    purpose: "Predice por similitud con registros historicos preparados.",
    output: "valor continuo",
  },
  ML_UNSUPERVISED_KMEANS: {
    name: "K-Means de perfiles de agua",
    family: "No supervisado",
    purpose: "Agrupa estados operativos similares del estanque.",
    output: "cluster",
  },
  ML_UNSUPERVISED_PCA: {
    name: "PCA de reduccion dimensional",
    family: "No supervisado",
    purpose: "Resume la variabilidad de sensores en componentes principales.",
    output: "componente principal",
  },
  ML_NONSUPERVISED_SOM: {
    name: "SOM / mapa autoorganizado",
    family: "No supervisado",
    purpose: "Reservado para mapas topologicos de perfiles de monitoreo.",
    output: "nodo / mapa",
  },
  PEARSON_LSTM_ATTENTION_WQ: {
    name: "Pearson LSTM con atencion",
    family: "Secuencial",
    purpose: "Forecast temporal con seleccion Pearson y mecanismo de atencion.",
    output: "pronostico",
  },
  LSTM_TRADITIONAL_WQ: {
    name: "LSTM tradicional de calidad de agua",
    family: "Secuencial",
    purpose: "Forecast temporal de variables fisicoquimicas.",
    output: "pronostico",
  },
  PEARSON_LSTM_BASE: {
    name: "Pearson LSTM base",
    family: "Secuencial",
    purpose: "Forecast con seleccion de variables por correlacion.",
    output: "pronostico",
  },
  BPNN_MEA_FEED_INTAKE: {
    name: "BPNN-MEA de consumo de alimento",
    family: "Red neuronal",
    purpose: "Estima consumo de alimento integrando agua y biomasa.",
    output: "consumo estimado",
  },
}

function modelTitle(modelCode: unknown) {
  const code = text(modelCode, "")
  return modelUiCatalog[code]?.name ?? code.replaceAll("_", " ").toLowerCase()
}

function modelFamily(modelCode: unknown, fallback?: unknown) {
  const code = text(modelCode, "")
  return modelUiCatalog[code]?.family ?? text(fallback, "Modelo")
}

function modelPurpose(modelCode: unknown) {
  const code = text(modelCode, "")
  return modelUiCatalog[code]?.purpose ?? "Modelo disponible en el backend."
}

function row(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {}
}

function rows(value: unknown): Row[] {
  return unwrapList(value)
}

function text(value: unknown, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback
  return String(value)
}

function numberValue(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function formatNumber(value: unknown, digits = 2) {
  const numeric = numberValue(value, Number.NaN)
  if (!Number.isFinite(numeric)) return text(value)
  return numeric.toLocaleString("en-US", { maximumFractionDigits: digits })
}

function formatDate(value: unknown) {
  if (!value) return "-"
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return text(value)
  return date.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function statusKind(value: unknown): StatusKind {
  const status = text(value, "").toLowerCase()
  if (status.includes("fail") || status.includes("error") || status.includes("blocked")) return "danger"
  if (status.includes("warn") || status.includes("queued") || status.includes("pending") || status.includes("candidate")) return "warning"
  if (status.includes("running") || status.includes("test") || status.includes("online")) return "info"
  if (status.includes("active") || status.includes("complete") || status.includes("ready") || status.includes("ok")) return "success"
  if (status.includes("dry") || status.includes("artifact")) return "purple"
  return "neutral"
}

function Badge({ children, kind = "neutral" }: { children: ReactNode; kind?: StatusKind }) {
  return <span className={`at-badge at-badge-${kind}`}>{children}</span>
}

function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return <div className="inline-state inline-error">{error instanceof Error ? error.message : "No se pudo consultar esta ruta"}</div>
}

function JsonButton({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="icon-mini" title={label} onClick={() => setOpen(true)}>
        <FileJson size={15} />
      </button>
      {open ? (
        <div className="json-panel" role="dialog" aria-modal="true" aria-label={label}>
          <div className="json-panel-card">
            <div className="card-head">
              <h2>{label}</h2>
              <button type="button" className="icon-mini" onClick={() => setOpen(false)}>
                x
              </button>
            </div>
            <pre>{JSON.stringify(value ?? {}, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </>
  )
}

function useGlobalDashboard(selectedFarmId: string, selectedPondId: string) {
  return useQuery({
    queryKey: ["mlops-dashboard", selectedFarmId, selectedPondId],
    queryFn: () =>
      apiGet<unknown>(
        query("/frontend/dashboard", {
          farm_id: selectedFarmId || undefined,
          pond_id: selectedPondId || defaultPond,
          range_label: "Ultimas 24 horas",
        }),
      ),
    refetchInterval: 30_000,
  })
}

export function MlopsApp({ selectedFarmId, selectedPondId, onFarmChange, onPondChange }: ViewContext) {
  const [screen, setScreen] = useState<MlopsScreen>("summary")
  const dashboardQuery = useGlobalDashboard(selectedFarmId, selectedPondId)
  const farmsQuery = useQuery({ queryKey: ["farms"], queryFn: () => apiGet<unknown>("/farms") })
  const pondsQuery = useQuery({ queryKey: ["ponds"], queryFn: () => apiGet<unknown>("/ponds") })
  const dashboard = unwrapObject(dashboardQuery.data)
  const farms = rows(farmsQuery.data).length ? rows(farmsQuery.data) : rows(dashboard.farms)
  const ponds = rows(pondsQuery.data).length ? rows(pondsQuery.data) : rows(dashboard.ponds)
  const firstFarmId = farms[0] ? pickId(farms[0]) : ""
  const firstPondId = ponds[0] ? pickId(ponds[0]) : defaultPond
  const activeFarmId = selectedFarmId || firstFarmId
  const activePondId = selectedPondId || firstPondId

  useEffect(() => {
    if (!selectedFarmId && firstFarmId) onFarmChange?.(firstFarmId)
  }, [firstFarmId, onFarmChange, selectedFarmId])

  useEffect(() => {
    if (!selectedPondId && firstPondId) onPondChange?.(firstPondId)
  }, [firstPondId, onPondChange, selectedPondId])

  return (
    <div className="aquatwin-studio">
      <MlopsTopBar
        backend={row(dashboard.backend)}
        farms={farms}
        ponds={ponds}
        selectedFarmId={activeFarmId}
        selectedPondId={activePondId}
        onFarmChange={(farmId) => onFarmChange?.(farmId)}
        onPondChange={(pondId) => onPondChange?.(pondId)}
      />
      <div className="studio-shell">
        <MlopsSidebar active={screen} onChange={setScreen} dashboard={dashboard} />
        <main className="studio-workspace">
          {screen === "summary" ? <OperationalSummaryView dashboard={dashboard} dashboardError={dashboardQuery.error} selectedPondId={activePondId} onNavigate={setScreen} /> : null}
          {screen === "data" ? <DataView selectedPondId={activePondId} /> : null}
          {screen === "cleaning" ? <CleaningView selectedPondId={activePondId} /> : null}
          {screen === "features" ? <FeaturesView selectedPondId={activePondId} /> : null}
          {screen === "training" ? <TrainingView selectedPondId={activePondId} /> : null}
          {screen === "artifacts" ? <ArtifactsView selectedPondId={activePondId} /> : null}
          {screen === "models" ? <ModelLifecycleView selectedPondId={activePondId} /> : null}
          {screen === "digitalTwin" ? <DigitalTwinStudioView selectedPondId={activePondId} /> : null}
          {screen === "traceability" ? <TraceabilityView dashboard={dashboard} /> : null}
        </main>
      </div>
    </div>
  )
}

function MlopsTopBar({
  backend,
  farms,
  ponds,
  selectedFarmId,
  selectedPondId,
  onFarmChange,
  onPondChange,
}: {
  backend: Row
  farms: Row[]
  ponds: Row[]
  selectedFarmId: string
  selectedPondId: string
  onFarmChange: (farmId: string) => void
  onPondChange: (pondId: string) => void
}) {
  const activePonds = ponds.filter((pond) => !selectedFarmId || text(pond.farm_id, "") === selectedFarmId)
  const online = ["online", "ok"].includes(text(backend.status, "").toLowerCase())
  return (
    <header className="topbar">
      <div className="brand">
        <Droplet size={30} />
        <div className="brand-stack">
          <strong><span>AquaTwin</span> <b>Studio</b></strong>
          <small>INICTEL-UNI / PROCIENCIA</small>
        </div>
      </div>
      <div className={online ? "top-pill status-online" : "top-pill status-offline"}>
        <span>Backend API</span>
        <strong>{online ? "ONLINE" : "REVISAR"}</strong>
        <i />
      </div>
      <TopSelect icon={<Database size={18} />} label="Granja" value={selectedFarmId} options={farms.map((farm) => ({ value: pickId(farm), label: pickName(farm) }))} onChange={onFarmChange} />
      <TopSelect icon={<BarChart3 size={18} />} label="Estanque" value={selectedPondId} options={activePonds.map((pond) => ({ value: pickId(pond), label: pickName(pond) }))} onChange={onPondChange} />
      <div className="top-pill select-pill">
        <CalendarDays size={18} />
        <span>Rango temporal</span>
        <select value="Ultimas 24 horas" onChange={() => undefined}>
          <option>Ultimas 24 horas</option>
        </select>
        <ChevronDown size={16} />
      </div>
      <div className="top-actions">
        <button type="button" className="icon-btn has-badge">
          <Bell size={18} />
          <small>2</small>
        </button>
        <button type="button" className="icon-btn">
          <Settings size={18} />
        </button>
        <div className="avatar">AP</div>
        <div className="user">
          <strong>Administrador</strong>
          <span>INICTEL-UNI PROCIENCIA</span>
        </div>
      </div>
    </header>
  )
}

function TopSelect({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: ReactNode
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const hasCurrentValue = options.some((option) => option.value === value)
  return (
    <label className="top-pill select-pill">
      {icon}
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        {!hasCurrentValue ? <option value={value || ""}>{value || "Sin datos"}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} />
    </label>
  )
}

function MlopsSidebar({ active, onChange, dashboard }: { active: MlopsScreen; onChange: (screen: MlopsScreen) => void; dashboard: Row }) {
  const items: { id: MlopsScreen; label: string; Icon: LucideIcon }[] = [
    { id: "summary", label: "Resumen", Icon: Home },
    { id: "data", label: "Datos", Icon: Database },
    { id: "cleaning", label: "Limpieza", Icon: Wand2 },
    { id: "features", label: "Features", Icon: Table2 },
    { id: "training", label: "Entrenar", Icon: Brain },
    { id: "artifacts", label: "Artefactos", Icon: Boxes },
    { id: "models", label: "Modelos ML", Icon: Rocket },
    { id: "digitalTwin", label: "Gemelo digital", Icon: Waves },
    { id: "traceability", label: "Trazabilidad", Icon: ClipboardList },
  ]
  const metrics = row(dashboard.system_metrics)
  return (
    <aside className="sidebar">
      <nav>
        {items.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={active === id ? "side-item active" : "side-item"} onClick={() => onChange(id)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="system-card">
        <div className="system-title">
          <span className="green-dot" />
          <div>
            <strong>Estado del sistema</strong>
            <em>Operativo</em>
          </div>
        </div>
        <dl>
          <dt>Sensores</dt>
          <dd>{text(metrics.sensors, "0")}</dd>
          <dt>Variables</dt>
          <dd>{text(metrics.variables, "0")}</dd>
          <dt>Actuadores</dt>
          <dd>{text(metrics.actuators, "0")}</dd>
        </dl>
      </div>
    </aside>
  )
}

function OperationalSummaryView({
  dashboard,
  dashboardError,
  selectedPondId,
  onNavigate,
}: {
  dashboard: Row
  dashboardError: unknown
  selectedPondId: string
  onNavigate: (screen: MlopsScreen) => void
}) {
  const coverageQuery = useQuery({ queryKey: ["summary-coverage", selectedPondId], queryFn: () => apiGet<unknown>(query("/datasets/coverage", { pond_id: selectedPondId })), refetchInterval: 30_000 })
  const runsQuery = useQuery({ queryKey: ["summary-cleaning-runs"], queryFn: () => apiGet<unknown>("/data/cleaning-runs"), refetchInterval: 30_000 })
  const featuresQuery = useQuery({ queryKey: ["summary-feature-sets"], queryFn: () => apiGet<unknown>("/features"), refetchInterval: 30_000 })
  const jobsQuery = useQuery({ queryKey: ["summary-jobs"], queryFn: () => apiGet<unknown>("/ml/training-jobs"), refetchInterval: 30_000 })
  const assetsQuery = useQuery({ queryKey: ["summary-assets"], queryFn: () => apiGet<unknown>(query("/ml/model-assets", { include_payload: false })), refetchInterval: 30_000 })
  const stateQuery = useQuery({ queryKey: ["summary-pond-state", selectedPondId], queryFn: () => apiGet<unknown>(`/ponds/${selectedPondId}/state`), refetchInterval: 30_000 })
  const coverage = row(coverageQuery.data)
  const currentWater = row(row(stateQuery.data).water_quality_current)
  const variables = rows(coverage.variables)
  const cleaningRuns = rows(runsQuery.data)
  const featureSets = rows(featuresQuery.data)
  const jobs = rows(jobsQuery.data)
  const assets = rows(assetsQuery.data)
  const completedJobs = jobs.filter((item) => text(item.status, "") === "completed")
  const activeAssets = assets.filter((item) => text(item.status, "") === "active")
  const workflow = [
    { title: "Datos reales", value: formatNumber(coverage.total_records, 0), detail: `${variables.length} variables observadas`, screen: "data" as MlopsScreen, kind: variables.length ? "success" : "warning" },
    { title: "Limpiezas guardadas", value: cleaningRuns.length, detail: "Copias versionadas sin tocar origen", screen: "cleaning" as MlopsScreen, kind: cleaningRuns.length ? "success" : "warning" },
    { title: "Feature sets", value: featureSets.length, detail: "Matrices preparadas para entrenar", screen: "features" as MlopsScreen, kind: featureSets.length ? "success" : "warning" },
    { title: "Entrenamientos", value: completedJobs.length, detail: `${jobs.length} jobs registrados`, screen: "training" as MlopsScreen, kind: completedJobs.length ? "success" : "warning" },
    { title: "Modelos productivos", value: activeAssets.length, detail: `${assets.length} artefactos versionados`, screen: "models" as MlopsScreen, kind: activeAssets.length ? "success" : "warning" },
    { title: "Gemelo digital", value: "En vivo", detail: "Escenarios horarios y modelos activables", screen: "digitalTwin" as MlopsScreen, kind: "info" },
  ]
  const waterRows = Object.entries(currentWater).map(([variable_code, raw]) => {
    const item = row(raw)
    return { variable_code, value: item.value, unit: item.unit, quality_flag: item.quality_flag, source: "clean_measurements" }
  })
  return (
    <>
      <section className="page-head command-head">
        <div>
          <h1>Resumen operativo</h1>
          <p>Estado real del estanque {selectedPondId}, preparación de datos, modelos y gemelo digital.</p>
        </div>
        <Badge kind={text(row(dashboard.backend).status, "") === "online" ? "success" : "warning"}>API {text(row(dashboard.backend).status, "revisar")}</Badge>
      </section>
      <ErrorNote error={dashboardError ?? coverageQuery.error ?? runsQuery.error ?? featuresQuery.error ?? jobsQuery.error ?? assetsQuery.error ?? stateQuery.error} />
      <section className="operational-summary-grid">
        {workflow.map((item) => (
          <button type="button" className={`operational-summary-item operational-summary-${item.kind}`} key={item.title} onClick={() => onNavigate(item.screen)}>
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </section>
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <div className="card-head">
            <div><h2>ESTADO ACTUAL DE LA PISCINA</h2><p className="soft">Últimas mediciones limpias provenientes de la base operativa.</p></div>
            <button type="button" className="mini-btn mini-btn-primary" onClick={() => onNavigate("digitalTwin")}>Abrir gemelo digital</button>
          </div>
          <DataTable rows={waterRows} columns={["variable_code", "value", "unit", "quality_flag", "source"]} />
        </div>
        <div className="studio-card mlops-card">
          <div className="card-head">
            <div><h2>SIGUIENTE ACCIÓN RECOMENDADA</h2><p className="soft">El resumen no fija un modelo: guía según el estado real del ciclo.</p></div>
          </div>
          <div className="check-list">
            <div><CheckCircle2 /><span>Datos</span><strong>{variables.length ? "disponibles" : "sin cobertura"}</strong></div>
            <div><CheckCircle2 /><span>Copias limpias</span><strong>{cleaningRuns.length ? "versionadas" : "crear limpieza"}</strong></div>
            <div><CheckCircle2 /><span>Entrenamiento</span><strong>{completedJobs.length ? "candidatos disponibles" : "pendiente"}</strong></div>
            <div><CheckCircle2 /><span>Simulación</span><strong>lista para configurar</strong></div>
          </div>
          <button type="button" className="primary-action" onClick={() => onNavigate(cleaningRuns.length ? "digitalTwin" : "cleaning")}>
            {cleaningRuns.length ? "Configurar escenario del gemelo" : "Crear primera limpieza"}
          </button>
        </div>
      </section>
    </>
  )
}

function DigitalTwinStudioView({ selectedPondId }: { selectedPondId: string }) {
  const queryClient = useQueryClient()
  const [horizonHours, setHorizonHours] = useState(24)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [modelsInitialized, setModelsInitialized] = useState(false)
  const [adjustments, setAdjustments] = useState<Record<string, number>>({
    dissolved_oxygen_mg_l: 0,
    water_temperature_c: 0,
    ph: 0,
    nitrate_ion: 0,
  })
  const [operationalControls, setOperationalControls] = useState<Record<string, number | boolean | string>>({
    fish_count: 25,
    aeration_percent: 60,
    filtration_percent: 50,
    temperature_setpoint_c: 24,
    feeding_mode: "automatic",
    feed_events: 0,
    siphon_events: 0,
  })
  const catalogQuery = useQuery({ queryKey: ["twin-model-catalog"], queryFn: () => apiGet<unknown>("/models") })
  const assetsQuery = useQuery({ queryKey: ["twin-active-assets"], queryFn: () => apiGet<unknown>(query("/ml/model-assets", { status: "active", include_payload: false })) })
  const latestSnapshotQuery = useQuery({ queryKey: ["twin-latest-snapshot", selectedPondId], queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/latest`), enabled: Boolean(selectedPondId), retry: false, refetchInterval: 30_000 })
  const risksQuery = useQuery({ queryKey: ["twin-risks", selectedPondId], queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/risks`), enabled: Boolean(selectedPondId), refetchInterval: 30_000 })
  const recommendationsQuery = useQuery({ queryKey: ["twin-recommendations", selectedPondId], queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/recommendations`), enabled: Boolean(selectedPondId), refetchInterval: 30_000 })
  const catalog = rows(catalogQuery.data)
  const assets = rows(assetsQuery.data)
  const availableModels = useMemo(() => {
    const codes = new Set<string>()
    catalog.forEach((item) => codes.add(text(item.model_code, "")))
    assets.forEach((item) => codes.add(text(item.model_code, "")))
    return Array.from(codes).filter(Boolean)
  }, [assets, catalog])
  useEffect(() => {
    if (modelsInitialized || !availableModels.length) return
    setSelectedModels(availableModels)
    setModelsInitialized(true)
  }, [availableModels, modelsInitialized])
  const projectionQuery = useQuery({
    queryKey: ["digital-twin-projection", selectedPondId, horizonHours, selectedModels, adjustments],
    queryFn: () => apiPost<unknown>(`/digital-twin/${selectedPondId}/projection`, {
      horizon_hours: horizonHours,
      step_hours: horizonHours <= 24 ? 1 : 3,
      selected_models: selectedModels,
      variable_adjustments_per_hour: adjustments,
      operational_controls: operationalControls,
    }),
    enabled: Boolean(selectedPondId),
    refetchInterval: 30_000,
  })
  const snapshotMutation = useMutation({
    mutationFn: () => apiPost<unknown>(`/digital-twin/${selectedPondId}/snapshot`, { operational_constraints: operationalControls }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twin-latest-snapshot", selectedPondId] })
      queryClient.invalidateQueries({ queryKey: ["twin-risks", selectedPondId] })
      queryClient.invalidateQueries({ queryKey: ["twin-recommendations", selectedPondId] })
    },
  })
  const projection = row(projectionQuery.data)
  const baseline = row(projection.baseline_values)
  const baselineObservedAt = row(projection.baseline_observed_at)
  const baselineIngestedAt = row(projection.baseline_ingested_at)
  const baselineUnits = row(projection.baseline_units)
  const baselineQualityFlags = row(projection.baseline_quality_flags)
  const trends = row(projection.observed_trends_per_hour)
  const chartRows = rows(projection.points).map((point) => {
    const values = row(point.values)
    const modelActivity = row(point.model_activity)
    return {
      hour: formatHourLabel(point.timestamp),
      ...values,
      ...Object.fromEntries(Object.entries(modelActivity).map(([code, value]) => [`model_${code}`, value])),
    }
  })
  const participation = rows(projection.model_participation)
  const snapshot = row(snapshotMutation.data ?? latestSnapshotQuery.data)
  const risks = rows(snapshot.risk_assessments).length ? rows(snapshot.risk_assessments) : rows(risksQuery.data)
  const recommendations = rows(snapshot.recommendations).length ? rows(snapshot.recommendations) : rows(recommendationsQuery.data)
  const modelOutputs = rows(snapshot.model_outputs)
  const oxygen = numberValue(baseline.dissolved_oxygen_mg_l)
  const temperature = numberValue(baseline.water_temperature_c)
  const ph = numberValue(baseline.ph)
  const nitrate = numberValue(baseline.nitrate_ion)
  const ammonia = numberValue(baseline.ammonia_mg_l ?? baseline.tan_mg_l)
  const turbidity = numberValue(baseline.turbidity_ntu)
  const poolState = oxygen > 0 && oxygen < 4 ? "critical" : oxygen > 0 && oxygen < 5 ? "warning" : "healthy"
  const liveMeasurementCards = [
    { code: "dissolved_oxygen_mg_l", label: "Oxígeno disuelto", value: oxygen, fallbackUnit: "mg/L" },
    { code: "water_temperature_c", label: "Temperatura", value: temperature, fallbackUnit: "°C" },
    { code: "ph", label: "pH", value: ph, fallbackUnit: "pH" },
    { code: "nitrate_ion", label: "Nitrato", value: nitrate, fallbackUnit: "mg/L" },
  ]
  const fishVisualCount = Math.min(14, Math.max(6, Math.round(numberValue(operationalControls.fish_count) / 7)))
  const aerationLevel = numberValue(operationalControls.aeration_percent)
  const filtrationLevel = numberValue(operationalControls.filtration_percent)
  const waterClarity = turbidity >= 40 || filtrationLevel < 25 ? "hazy" : turbidity >= 20 || filtrationLevel < 50 ? "moderate" : "clear"
  const setOperationalControl = (key: string, value: number | boolean | string) => setOperationalControls((current) => ({ ...current, [key]: value }))
  const registerOperation = (key: "feed_events" | "siphon_events") => setOperationalControls((current) => ({ ...current, [key]: numberValue(current[key]) + 1 }))
  const toggleModel = (modelCode: string) => setSelectedModels((current) => current.includes(modelCode) ? current.filter((code) => code !== modelCode) : [...current, modelCode])
  return (
    <>
      <section className="page-head command-head">
        <div>
          <h1>Gemelo digital de la piscina</h1>
          <p>Clon virtual en vivo: compara la tendencia real con cambios operativos explícitos.</p>
        </div>
        <Badge kind={projectionQuery.isFetching ? "info" : "success"}>{projectionQuery.isFetching ? "actualizando" : "sincronizado"}</Badge>
      </section>
      <ErrorNote error={catalogQuery.error ?? assetsQuery.error ?? projectionQuery.error ?? risksQuery.error ?? recommendationsQuery.error ?? snapshotMutation.error} />
      <section className="ras-console-grid">
        <div className="ras-console-column">
          <div className="studio-card ras-panel">
            <div className="card-head"><div><h2>MANDOS OPERATIVOS RAS</h2><p className="soft">Contexto trazable para ejecutar modelos y escenarios.</p></div><Gauge size={20} /></div>
            <RasRange label="Peces en crianza" value={numberValue(operationalControls.fish_count)} min={3} max={200} unit="" onChange={(value) => setOperationalControl("fish_count", value)} />
            <RasRange label="Aireación / inyección O₂" value={numberValue(operationalControls.aeration_percent)} min={0} max={100} unit="%" onChange={(value) => setOperationalControl("aeration_percent", value)} />
            <RasRange label="Filtrado mecánico / biológico" value={numberValue(operationalControls.filtration_percent)} min={0} max={100} unit="%" onChange={(value) => setOperationalControl("filtration_percent", value)} />
            <RasRange label="Temperatura objetivo" value={numberValue(operationalControls.temperature_setpoint_c)} min={12} max={34} step={0.5} unit=" °C" onChange={(value) => setOperationalControl("temperature_setpoint_c", value)} />
            <div className="ras-operation-actions">
              <button type="button" className="primary-action" onClick={() => registerOperation("feed_events")}><Fish size={15} /> Registrar alimentación</button>
              <button type="button" className="outline-action" onClick={() => registerOperation("siphon_events")}><RefreshCcw size={15} /> Registrar sifonado</button>
            </div>
            <small className="ras-context-note">Los mandos quedan registrados como contexto. Solo los ajustes explícitos inferiores alteran numéricamente la curva.</small>
          </div>
          <div className="studio-card ras-panel">
            <h2>TELEMETRÍA BIOQUÍMICA</h2>
            <RasTelemetry label="Oxígeno disuelto" value={oxygen} unit="mg/L" max={12} warning={5} critical={3} available={baseline.dissolved_oxygen_mg_l !== undefined} />
            <RasTelemetry label="Amoniaco / TAN" value={ammonia} unit="mg/L" max={0.1} warning={0.02} critical={0.05} reverse available={baseline.ammonia_mg_l !== undefined || baseline.tan_mg_l !== undefined} />
            <RasTelemetry label="Turbidez" value={turbidity} unit="NTU" max={100} warning={20} critical={40} reverse available={baseline.turbidity_ntu !== undefined} />
          </div>
        </div>
        <div className="studio-card ras-tank-panel">
          <div className="card-head"><div><h2>CÁMARA DE CULTIVO DIGITAL</h2><p className="soft">Estado real, dinámica visual y contexto operativo del escenario.</p></div><Badge kind={poolState === "healthy" ? "success" : poolState === "warning" ? "warning" : "danger"}>{poolState === "healthy" ? "estable" : poolState}</Badge></div>
          <div
            className={`ras-cylinder-tank ras-cylinder-${poolState} ras-water-${waterClarity}`}
            style={{ "--fish-load": Math.min(100, numberValue(operationalControls.fish_count)), "--aeration": aerationLevel, "--filtration": filtrationLevel } as CSSProperties}
          >
            <div className="ras-water-volume"><span /><span /><span /></div>
            <div className="ras-water-surface"><span /><span /><span /></div>
            <div className="ras-inlet" />
            <div className="ras-drain" />
            <div className="ras-floor"><span /><span /><span /><span /><span /></div>
            <div className="ras-current-ring ras-current-ring-a" />
            <div className="ras-current-ring ras-current-ring-b" />
            <div className="ras-diffuser ras-diffuser-a" />
            <div className="ras-diffuser ras-diffuser-b" />
            <div className="ras-bubble-field">
              {Array.from({ length: Math.max(8, Math.round(aerationLevel / 3)) }).map((_, index) => <i key={index} style={{ "--bubble-left": `${18 + ((index * 17) % 64)}%`, "--bubble-size": `${3 + ((index * 3) % 6)}px`, "--bubble-duration": `${3.2 + ((index % 7) * 0.37)}s`, "--bubble-delay": `${index * -0.23}s` } as CSSProperties} />)}
            </div>
            <div className="ras-particle-field">
              {Array.from({ length: Math.max(3, Math.round((100 - filtrationLevel) / 5)) }).map((_, index) => <i key={index} style={{ "--particle-top": `${16 + ((index * 23) % 67)}%`, "--particle-left": `${9 + ((index * 37) % 79)}%`, "--particle-size": `${2 + ((index * 5) % 4)}px`, "--particle-duration": `${8 + ((index % 8) * 1.8)}s`, "--particle-delay": `${index * -0.61}s` } as CSSProperties} />)}
            </div>
            <div className="ras-fish-field">
              {Array.from({ length: fishVisualCount }).map((_, index) => (
                <span
                  className={`ras-fish ras-fish-orbit-${index % 6}`}
                  key={index}
                  style={{
                    "--i": index,
                    "--fish-duration": `${13 + ((index * 7) % 15)}s`,
                    "--fish-delay": `${-((index * 3.7) % 22)}s`,
                    "--fish-scale": 0.58 + ((index * 13) % 42) / 100,
                    "--fish-opacity": 0.62 + ((index * 17) % 34) / 100,
                    "--fish-hue": `${185 + ((index * 29) % 105)}`,
                  } as CSSProperties}
                >
                  <span className="ras-fish-shape"><b /><i /><em /></span>
                </span>
              ))}
            </div>
            <div className="ras-sensor ras-sensor-oxygen"><span>OD</span><i /></div>
            <div className="ras-sensor ras-sensor-temperature"><span>T°</span><i /></div>
            <div className="ras-tank-reading"><Droplet size={24} /><strong>{formatNumber(oxygen, 2)} mg/L</strong><span>OD real de MySQL</span></div>
            <div className="ras-scene-status">
              <span>Corriente circular</span>
              <span>{waterClarity === "clear" ? "Agua clara" : waterClarity === "moderate" ? "Claridad media" : "Agua turbia"}</span>
            </div>
          </div>
          <div className="ras-engineering-strip">
            <div><span>Carga configurada</span><strong>{formatNumber(operationalControls.fish_count, 0)} peces</strong></div>
            <div><span>Aireación</span><strong>{formatNumber(operationalControls.aeration_percent, 0)}%</strong></div>
            <div><span>Filtración</span><strong>{formatNumber(operationalControls.filtration_percent, 0)}%</strong></div>
            <div><span>Último dato</span><strong>{formatDateTime(baselineObservedAt.dissolved_oxygen_mg_l)}</strong></div>
          </div>
          <div className="pool-live-panel ras-live-measurements">
            {liveMeasurementCards.map((measurement) => <div className="pool-live-card" key={measurement.code}><div className="pool-live-card-head"><span>{measurement.label}</span><Badge kind={text(baselineQualityFlags[measurement.code]) === "valid" ? "success" : "warning"}>{text(baselineQualityFlags[measurement.code], "sin dato")}</Badge></div><strong>{formatNumber(measurement.value, 2)} <em>{text(baselineUnits[measurement.code], measurement.fallbackUnit)}</em></strong><small>Medido: {formatDateTime(baselineObservedAt[measurement.code])}</small><small>Guardado: {formatDateTime(baselineIngestedAt[measurement.code])}</small></div>)}
          </div>
        </div>
        <div className="ras-console-column">
          <div className="studio-card ras-panel">
            <div className="card-head"><div><h2>INTELIGENCIA DEL GEMELO</h2><p className="soft">Ejecuta modelos, riesgos y recomendaciones reales.</p></div><Brain size={20} /></div>
            <button type="button" className="success-action native-wide" disabled={snapshotMutation.isPending} onClick={() => snapshotMutation.mutate()}><Power size={16} /> {snapshotMutation.isPending ? "Ejecutando modelos" : "Ejecutar snapshot inteligente"}</button>
            <MetricList rows={[["Snapshot", snapshot.snapshot_id ?? "pendiente"], ["Modelos ejecutados", modelOutputs.length], ["Riesgos", risks.length], ["Recomendaciones", recommendations.length]]} />
          </div>
          <div className="studio-card ras-panel ras-event-log">
            <h2>REGISTRO DE PROCESOS</h2>
            <div><span>{formatDateTime(projection.generated_at)}</span><p>Proyección recalculada con datos limpios reales.</p></div>
            <div><span>{formatDateTime(snapshot.timestamp)}</span><p>{snapshot.snapshot_id ? "Snapshot y modelos ejecutados." : "Ejecute un snapshot para diagnóstico."}</p></div>
            <div><span>Operación</span><p>Alimentaciones: {text(operationalControls.feed_events, "0")} · Sifonados: {text(operationalControls.siphon_events, "0")}</p></div>
          </div>
          <div className="studio-card ras-panel">
            <h2>RIESGOS Y RECOMENDACIONES</h2>
            <div className="ras-decision-list">
              {risks.slice(0, 3).map((risk) => <div key={text(risk.risk_code)}><AlertTriangle size={15} /><span><strong>{text(risk.risk_code)}</strong><small>{text(risk.explanation)}</small></span><Badge kind={text(risk.risk_level) === "high" ? "danger" : "warning"}>{text(risk.risk_level)}</Badge></div>)}
              {recommendations.slice(0, 3).map((recommendation) => <div key={text(recommendation.recommendation_code)}><CheckCircle2 size={15} /><span><strong>{text(recommendation.recommended_action)}</strong><small>{text(recommendation.explanation)}</small></span></div>)}
              {!risks.length && !recommendations.length ? <p className="soft">Sin diagnóstico todavía. Ejecute el snapshot inteligente.</p> : null}
            </div>
          </div>
        </div>
      </section>
      <section className="twin-control-grid">
        <div className="studio-card mlops-card twin-controls">
          <div className="card-head"><div><h2>ESCENARIO</h2><p className="soft">Los cambios son incrementos por hora y quedan identificados como simulación.</p></div><JsonButton label="Trazabilidad completa del escenario" value={projection} /></div>
          <div className="time-tabs interactive-time-tabs">
            {[12, 24, 48, 72].map((hours) => <button type="button" className={horizonHours === hours ? "active" : ""} key={hours} onClick={() => setHorizonHours(hours)}>{hours}H</button>)}
          </div>
          <div className="field-grid">
            {Object.keys(adjustments).map((variable) => (
              <label className="form-line" key={variable}>
                <span>{variable} / hora</span>
                <input type="number" step="0.01" value={adjustments[variable]} onChange={(event) => setAdjustments((current) => ({ ...current, [variable]: Number(event.target.value) }))} />
              </label>
            ))}
          </div>
          <button type="button" className="outline-action native-wide" onClick={() => setAdjustments({ dissolved_oxygen_mg_l: 0, water_temperature_c: 0, ph: 0, nitrate_ion: 0 })}>Restablecer escenario real</button>
        </div>
        <div className="studio-card mlops-card twin-models">
          <div className="card-head">
            <div><h2>MODELOS QUE PARTICIPAN</h2><p className="soft">Todos inician activos; puede aislar únicamente los que desea comparar.</p></div>
            <div className="twin-model-actions">
              <button type="button" className="mini-btn mini-btn-ghost" onClick={() => setSelectedModels([])}>Limpiar</button>
              <button type="button" className="mini-btn mini-btn-primary" onClick={() => setSelectedModels(availableModels)}>Activar todos</button>
              <Badge kind="info">{selectedModels.length} activos</Badge>
            </div>
          </div>
          <div className="twin-model-list">
            {availableModels.map((modelCode) => {
              const active = selectedModels.includes(modelCode)
              return <button type="button" className={active ? "twin-model active" : "twin-model"} key={modelCode} onClick={() => toggleModel(modelCode)}>
                <span>{active ? "ON" : "OFF"}</span><div><strong>{modelTitle(modelCode)}</strong><small>{modelPurpose(modelCode)}</small></div>
              </button>
            })}
          </div>
        </div>
      </section>
      <section className="studio-card mlops-card twin-chart-card">
        <div className="card-head"><div><h2>COMPORTAMIENTO INTEGRADO DEL ESTANQUE</h2><p className="soft">Variables físicas sobre el mismo horizonte. Use el selector inferior para ampliar cualquier tramo.</p></div><Badge kind="warning">escenario operacional</Badge></div>
        <ResponsiveContainer width="100%" height={470}>
          <ComposedChart data={chartRows} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef9" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="water" tick={{ fontSize: 11 }} label={{ value: "mg/L", angle: -90, position: "insideLeft" }} />
            <YAxis yAxisId="environment" orientation="right" tick={{ fontSize: 11 }} label={{ value: "°C / pH", angle: 90, position: "insideRight" }} />
            <Tooltip formatter={(value, name) => [formatNumber(value, 4), name]} />
            <Legend />
            <ReferenceArea yAxisId="water" y1={5} y2={9} fill="#dcfce7" fillOpacity={0.4} label="OD operativo" />
            <ReferenceLine yAxisId="water" y={4} stroke="#ef4444" strokeDasharray="5 5" label="OD crítico" />
            <Area yAxisId="water" type="monotone" dataKey="dissolved_oxygen_mg_l" name="Oxígeno disuelto" stroke="#1976ff" fill="#bfdbfe" fillOpacity={0.55} strokeWidth={3} dot={false} />
            <Line yAxisId="environment" type="monotone" dataKey="water_temperature_c" name="Temperatura" stroke="#ef4444" strokeWidth={2.5} dot={false} />
            <Line yAxisId="environment" type="monotone" dataKey="ph" name="pH" stroke="#16a34a" strokeWidth={2.5} dot={false} />
            <Line yAxisId="water" type="monotone" dataKey="nitrate_ion" name="Nitrato" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            <Brush dataKey="hour" height={26} stroke="#1976ff" travellerWidth={8} />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
      <section className="studio-card mlops-card twin-chart-card model-orchestration-card">
        <div className="card-head">
          <div><h2>ORQUESTACIÓN DE TODOS LOS MODELOS</h2><p className="soft">Cada curva muestra el índice de participación operacional del modelo seleccionado durante el escenario.</p></div>
          <Badge kind="info">{participation.length} capas simultáneas</Badge>
        </div>
        <ResponsiveContainer width="100%" height={390}>
          <ComposedChart data={chartRows} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef9" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: "Actividad %", angle: -90, position: "insideLeft" }} />
            <Tooltip formatter={(value, name) => [`${formatNumber(value, 2)}%`, name]} />
            <Legend />
            <ReferenceArea y1={70} y2={100} fill="#dcfce7" fillOpacity={0.35} />
            <ReferenceArea y1={30} y2={70} fill="#fef3c7" fillOpacity={0.3} />
            {participation.map((item, index) => (
              <Line
                key={text(item.model_code)}
                type="monotone"
                dataKey={`model_${text(item.model_code)}`}
                name={modelTitle(text(item.model_code))}
                stroke={twinModelColors[index % twinModelColors.length]}
                strokeWidth={text(item.status) === "available" ? 3 : 2}
                strokeDasharray={text(item.status) === "available" ? undefined : "6 4"}
                dot={false}
                connectNulls
              />
            ))}
            <Brush dataKey="hour" height={26} stroke="#16a34a" travellerWidth={8} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="model-layer-note"><AlertTriangle size={16} /><span>Este índice representa disponibilidad e injerencia sobre el escenario. No reemplaza la salida numérica propia de cada modelo ni inventa predicciones.</span></div>
      </section>
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <h2>BASE REAL Y TENDENCIA OBSERVADA</h2>
          <DataTable rows={Object.keys(baseline).map((variable) => ({ variable, valor_actual: baseline[variable], unidad: baselineUnits[variable], medido_en: baselineObservedAt[variable], guardado_en_bd: baselineIngestedAt[variable], tendencia_por_hora: trends[variable], origen: "clean_measurements" }))} columns={["variable", "valor_actual", "unidad", "medido_en", "guardado_en_bd", "tendencia_por_hora", "origen"]} />
        </div>
        <div className="studio-card mlops-card">
          <h2>INJERENCIA Y DISPONIBILIDAD</h2>
          <DataTable rows={participation} columns={["model_code", "status", "impact_variables", "asset_id", "explanation"]} />
        </div>
      </section>
      <section className="studio-card mlops-card">
        <h2>ADVERTENCIAS DE INTERPRETACIÓN</h2>
        <div className="check-list">
          {(Array.isArray(projection.warnings) ? projection.warnings : []).map((warning) => <div key={String(warning)}><AlertTriangle /><span>{String(warning)}</span><strong>revisar</strong></div>)}
        </div>
      </section>
    </>
  )
}

function formatHourLabel(value: unknown) {
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return text(value)
  return date.toLocaleString("es-PE", { day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function formatDateTime(value: unknown) {
  if (!value) return "sin registro"
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return text(value, "sin registro")
  return date.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function RasRange({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return (
    <label className="ras-range">
      <span><b>{label}</b><strong>{formatNumber(value, step < 1 ? 1 : 0)}{unit}</strong></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small>{min}{unit} · {max}{unit}</small>
    </label>
  )
}

function RasTelemetry({ label, value, unit, max, warning, critical, reverse = false, available }: { label: string; value: number; unit: string; max: number; warning: number; critical: number; reverse?: boolean; available: boolean }) {
  const ratio = available ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const criticalState = available && (reverse ? value >= critical : value <= critical)
  const warningState = available && !criticalState && (reverse ? value >= warning : value <= warning)
  return (
    <div className="ras-telemetry">
      <span><b>{label}</b><strong>{available ? `${formatNumber(value, max < 1 ? 3 : 2)} ${unit}` : "Sin sensor"}</strong></span>
      <div><i className={criticalState ? "critical" : warningState ? "warning" : available ? "healthy" : "missing"} style={{ width: `${ratio}%` }} /></div>
      <small>{available ? criticalState ? "Nivel crítico" : warningState ? "Requiere atención" : "Dentro del rango operativo" : "No disponible en la base de datos"}</small>
    </div>
  )
}

export function LegacyModelDashboardReference({ dashboard, dashboardError, selectedPondId, onNavigate }: { dashboard: Row; dashboardError: unknown; selectedPondId: string; onNavigate: (screen: MlopsScreen) => void }) {
  const lifecycleQuery = useQuery({ queryKey: ["ml-lifecycle"], queryFn: () => apiGet<unknown>("/ml/lifecycle/status"), refetchInterval: 30_000 })
  const trainableQuery = useQuery({ queryKey: ["summary-trainable-models"], queryFn: () => apiGet<unknown>("/ml/trainable-models"), refetchInterval: 30_000 })
  const assetsQuery = useQuery({ queryKey: ["summary-active-assets"], queryFn: () => apiGet<unknown>(query("/ml/model-assets", { status: "active", include_payload: false })), refetchInterval: 30_000 })
  const jobsQuery = useQuery({ queryKey: ["summary-training-jobs"], queryFn: () => apiGet<unknown>("/ml/training-jobs"), refetchInterval: 30_000 })
  const featuresQuery = useQuery({ queryKey: ["summary-features"], queryFn: () => apiGet<unknown>("/features"), refetchInterval: 30_000 })
  const lifecycle = unwrapObject(lifecycleQuery.data ?? dashboard.ml_lifecycle)
  const evidence = row(dashboard.evidence)
  const metrics = row(dashboard.system_metrics)
  const activeAssets = rows(assetsQuery.data)
  const trainable = rows(trainableQuery.data)
  const jobs = rows(jobsQuery.data)
  const featureSets = rows(featuresQuery.data)
  const champion = chooseChampionAsset(activeAssets)
  const championCode = text(champion.model_code, preferredVisualModel)
  const championMetrics = row(champion.metrics_json)
  const featureSetId = text(champion.feature_set_id, "")
  const championJob = jobs.find((job) => text(job.job_id, "") === text(champion.training_job_id, "")) ?? {}
  const championFeatureSet = featureSets.find((featureSet) => text(featureSet.feature_set_id, "") === featureSetId) ?? {}
  const previewQuery = useQuery({ queryKey: ["summary-feature-preview", featureSetId], queryFn: () => apiGet<unknown>(`/features/${featureSetId}/preview`), enabled: Boolean(featureSetId), refetchInterval: 60_000 })
  const previewObject = unwrapObject(previewQuery.data)
  const previewRows = rows(previewObject.preview_rows)
  const previewColumns = rows(previewObject.columns).length ? rows(previewObject.columns) : rows(championFeatureSet.columns)
  const featureNames = getFeatureNames(champion, championMetrics)
  const targetVariable = text(
    previewColumns.find((column) => text(column.role, "") === "target")?.source_variable ??
      championFeatureSet.target_variable ??
      row(champion.artifact_payload).target_variable,
    "ph",
  )
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({})
  const predictMutation = useMutation({
    mutationFn: () =>
      apiPost<unknown>(`/models/${championCode}/predict`, {
        features: Object.fromEntries(featureNames.map((name) => [name, Number(featureValues[name] ?? 0)])),
      }),
  })
  const demoMutation = useMutation({
    mutationFn: async () => {
      const sourceRows = previewRows.slice(0, 18)
      const results: Row[] = []
      for (const sample of sourceRows) {
        const features = Object.fromEntries(featureNames.map((name, index) => [name, getSampleFeatureValue(sample, name, index)]))
        const prediction = await apiPost<unknown>(`/models/${championCode}/predict`, { features })
        results.push({
          label: String(results.length + 1),
          observed: numberValue(sample.target),
          predicted: numberValue(row(prediction).prediction),
          error: Math.abs(numberValue(sample.target) - numberValue(row(prediction).prediction)),
          ...features,
        })
      }
      return results
    },
  })
  const demoRows = Array.isArray(demoMutation.data) ? demoMutation.data : []
  const previewChartRows = useMemo(() => buildPreviewChartRows(previewRows, featureNames), [previewRows, featureNames])
  const chartRows = demoRows.length ? demoRows : previewChartRows
  const pearsonRows = useMemo(() => buildPearsonRows(previewColumns), [previewColumns])
  const comparisonRows = useMemo(() => buildModelComparisonRows(activeAssets, trainable), [activeAssets, trainable])
  const pipelineRows = buildDashboardPipelineRows(lifecycle, champion, championJob, previewRows.length)
  const mae = latestMetric(championMetrics, "mae")
  const rmse = latestMetric(championMetrics, "rmse")
  const r2 = latestMetric(championMetrics, "r2")
  const confidence = modelConfidenceScore(championMetrics, previewRows.length, champion.status)
  const trust = modelTrustLabel(confidence, r2)
  const lastPrediction = row(predictMutation.data).prediction ?? row(demoRows[demoRows.length - 1]).predicted
  const averageError = demoRows.length ? demoRows.reduce((sum, item) => sum + numberValue(item.error), 0) / demoRows.length : mae

  const fillLatest = () => {
    const sample = row(previewRows[0])
    if (!Object.keys(sample).length) return
    setFeatureValues((current) => {
      const next = { ...current }
      featureNames.forEach((name, index) => {
        next[name] = text(getSampleFeatureValue(sample, name, index), "0")
      })
      return next
    })
  }

  const runRealTest = () => {
    fillLatest()
    demoMutation.mutate()
  }

  return (
    <>
      <section className="page-head command-head">
        <div>
          <h1>Centro de modelos predictivos</h1>
          <p>Monitorea, compara y opera modelos de machine learning para el estanque {selectedPondId}.</p>
        </div>
        <Badge kind={lifecycle.model_assets_enabled ? "success" : "warning"}>API ML {lifecycle.model_assets_enabled ? "online" : "revisar"}</Badge>
      </section>
      <ErrorNote error={dashboardError ?? lifecycleQuery.error ?? trainableQuery.error ?? assetsQuery.error ?? jobsQuery.error ?? featuresQuery.error ?? previewQuery.error ?? predictMutation.error ?? demoMutation.error} />
      <section className="studio-card command-hero">
        <div className="champion-icon">
          <LineChartIcon size={44} />
        </div>
        <div className="champion-main">
          <span>Modelo activo</span>
          <h2>{modelDashboardName(championCode, targetVariable)}</h2>
          <p>{modelPurpose(championCode)}</p>
          <Badge kind={modelTrustKind(confidence, r2)}>{trust}</Badge>
        </div>
        <div className="confidence-gauge" style={{ "--score": `${confidence}%` } as CSSProperties}>
          <span>Confianza del modelo</span>
          <strong>{confidence}</strong>
          <small>/100</small>
          <em>{confidence < 55 ? "Baja" : confidence < 75 ? "Media" : "Alta"}</em>
        </div>
        <MetricTile label="Ultima inferencia" value={lastPrediction === undefined ? "-" : formatNumber(lastPrediction, 4)} note={targetVariable} />
        <MetricTile label="Error medio (MAE)" value={formatNumber(averageError, 4)} note={mae === undefined ? "pendiente" : "validacion"} />
        <MetricTile label="R2 validacion" value={formatNumber(r2, 3)} note={r2 !== undefined && r2 < 0 ? "advertencia" : "estable"} danger={r2 !== undefined && r2 < 0} />
        <div className="hero-recommendation">
          <AlertTriangle size={16} />
          <span>{recommendationText(confidence, r2)}</span>
        </div>
        <div className="hero-actions">
          <button type="button" className="outline-action" disabled={!previewRows.length || demoMutation.isPending} onClick={runRealTest}>
            <Rocket size={16} /> Probar con datos reales
          </button>
          <button type="button" className="outline-action" onClick={() => document.getElementById("dashboard-model-comparator")?.scrollIntoView({ behavior: "smooth" })}>
            <BarChart3 size={16} /> Comparar modelos
          </button>
          <button type="button" className="primary-action" onClick={() => onNavigate("training")}>
            <RefreshCcw size={16} /> Reentrenar candidato
          </button>
        </div>
      </section>
      <section className="command-kpi-grid">
        <CommandKpi icon={<Database />} title="Datos del estanque" value={text(previewRows.length || championFeatureSet.test_rows || evidence.datasets, "0")} note={`${text(metrics.sensors, "0")} sensores conectados`} />
        <CommandKpi icon={<Waves />} title="Calidad de datos" value={lifecycle.cleaning_enabled ? "94%" : "Pendiente"} note="limpieza habilitada" kind="success" />
        <CommandKpi icon={<Brain />} title="Modelo activo" value={modelDashboardName(championCode, targetVariable)} note={trust} kind={modelTrustKind(confidence, r2)} />
        <CommandKpi icon={<LineChartIcon />} title="Error reciente" value={formatNumber(mae, 3)} note={rmse === undefined ? "RMSE pendiente" : `RMSE ${formatNumber(rmse, 3)}`} kind={r2 !== undefined && r2 < 0 ? "warning" : "success"} />
        <CommandKpi icon={<ClipboardList />} title="Trazabilidad" value="Completa" note={`${text(champion.version, "v1")} auditado`} kind="success" />
      </section>
      <section className="studio-card command-pipeline">
        <div className="card-head">
          <div>
            <h2>Pipeline del modelo</h2>
            <p className="soft">Estado de cada etapa del ciclo de vida del modelo champion.</p>
          </div>
          <button type="button" className="mini-btn mini-btn-ghost" onClick={() => onNavigate("traceability")}>Ver trazabilidad completa</button>
        </div>
        <div className="pipeline-track">
          {pipelineRows.map((step, index) => (
            <div className={`pipeline-node pipeline-node-${step.kind}`} key={step.title}>
              <span>{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <Badge kind={step.kind}>{step.status}</Badge>
            </div>
          ))}
        </div>
      </section>
      <section className="dashboard-model-grid">
        <div className="studio-card dashboard-catalog" id="dashboard-model-comparator">
          <div className="card-head">
            <div>
              <h2>Catalogo de modelos</h2>
              <p className="soft">Champion y candidatos disponibles para este estanque.</p>
            </div>
            <Badge kind="info">{comparisonRows.length} modelos</Badge>
          </div>
          <div className="catalog-tabs"><span>Todos</span><span>En produccion</span><span>Candidatos</span><span>Archivados</span></div>
          <div className="champion-card">
            <strong>{modelDashboardName(championCode, targetVariable)}</strong>
            <Badge kind={modelTrustKind(confidence, r2)}>{trust}</Badge>
            <p>MAE {formatNumber(mae, 3)} · R2 {formatNumber(r2, 3)}</p>
            <small>Artefacto {text(champion.version, "v1")} · {shortId(champion.asset_id)}</small>
          </div>
          <div className="challenger-list">
            {comparisonRows.slice(0, 7).map((model) => (
              <div key={text(model.model_code)}>
                <span>{modelDashboardName(model.model_code, model.target_variable)}</span>
                <b>{formatNumber(model.mae, 3)}</b>
                <em>{formatNumber(model.r2, 3)}</em>
                <Badge kind={model.kind}>{text(model.state)}</Badge>
              </div>
            ))}
          </div>
          <button type="button" className="outline-action native-wide" onClick={() => onNavigate("models")}>
            Comparar en Modelos ML
          </button>
        </div>
        <div className="studio-card dashboard-validation">
          <div className="card-head">
            <div>
              <h2>Validacion visual del modelo</h2>
              <p className="soft">{demoRows.length ? "Observado vs predicho con inferencias reales." : "Observado y tendencia reciente. Pulse probar para agregar predicciones reales."}</p>
            </div>
            <div className="time-tabs"><span>1H</span><span>6H</span><b>24H</b></div>
          </div>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartRows} margin={{ top: 12, right: 24, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eef9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} />
              <Tooltip formatter={(value) => formatNumber(value, 5)} labelFormatter={(label) => `Muestra ${label}`} />
              <Legend />
              <ReferenceLine y={0.8} stroke="#16a34a" strokeDasharray="4 4" label="Optimo superior" />
              <ReferenceLine y={0.4} stroke="#16a34a" strokeDasharray="4 4" label="Optimo inferior" />
              <ReferenceLine y={0.3} stroke="#f59e0b" strokeDasharray="4 4" label="Alerta" />
              <ReferenceLine y={0.15} stroke="#ef4444" strokeDasharray="4 4" label="Critico" />
              <Line type="monotone" dataKey="observed" name="Observado" stroke="#1976ff" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey={demoRows.length ? "predicted" : "trend"} name={demoRows.length ? "Predicho" : "Tendencia"} stroke="#16a34a" strokeWidth={3} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div className="validation-footer">
            <MetricTile label="Resumen reciente" value={demoRows.length ? `${demoRows.length} pruebas` : `${previewRows.length} muestras`} note={targetVariable} />
            <MetricTile label="Error promedio" value={formatNumber(averageError, 4)} note={confidence < 55 ? "Bajo desempeno" : "Aceptable"} />
            <MetricTile label="Estabilidad" value={confidence < 55 ? "Baja" : confidence < 75 ? "Media" : "Alta"} note={r2 !== undefined && r2 < 0 ? "varianza alta" : "estable"} danger={r2 !== undefined && r2 < 0} />
          </div>
          <div className="influence-strip">
            {pearsonRows.slice(0, 3).map((item) => (
              <span key={item.name}>{item.name}: <b>{formatNumber(item.score, 3)}</b></span>
            ))}
          </div>
        </div>
      </section>
      <section className="dashboard-bottom-grid">
        <div className="studio-card dashboard-compare">
          <h2>Comparador de modelos</h2>
          <DataTable rows={comparisonRows.slice(0, 6)} columns={["model_name", "mae", "rmse", "r2", "state"]} />
          <div className="suggestion-box">
            <Brain size={18} />
            <span>Mejor opcion sugerida: {text(comparisonRows[0]?.model_name, "entrenar nuevo candidato")}</span>
            <button type="button" className="mini-btn mini-btn-primary" onClick={() => onNavigate("artifacts")}>Promover modelo</button>
          </div>
        </div>
        <div className="studio-card dashboard-inference">
          <h2>Probar modelo activo</h2>
          <p className="soft">Ingresa valores o usa la ultima lectura real preparada.</p>
          <div className="field-grid">
            {featureNames.map((name) => (
              <label className="form-line" key={name}>
                <span>{name}</span>
                <input value={featureValues[name] ?? ""} placeholder="0" onChange={(event) => setFeatureValues((current) => ({ ...current, [name]: event.target.value }))} />
              </label>
            ))}
          </div>
          <div className="inference-actions">
            <button type="button" className="mini-btn mini-btn-ghost" disabled={!previewRows.length} onClick={fillLatest}>Usar ultima</button>
            <button type="button" className="primary-action" disabled={!featureNames.length || predictMutation.isPending} onClick={() => predictMutation.mutate()}>
              Ejecutar inferencia
            </button>
          </div>
        </div>
        <div className="studio-card dashboard-result">
          <h2>Resultado de la inferencia</h2>
          <strong>{lastPrediction === undefined ? "-" : formatNumber(lastPrediction, 4)} <span>{targetVariable}</span></strong>
          <Badge kind={modelTrustKind(confidence, r2)}>Confianza {confidence < 55 ? "baja" : confidence < 75 ? "media" : "alta"}</Badge>
          <MetricList rows={[["Modelo", modelDashboardName(championCode, targetVariable)], ["Artefacto", text(champion.version, "v1")], ["Fecha", formatDate(new Date())]]} />
          <JsonButton label="Trazabilidad de resultado" value={row(predictMutation.data).traceability ?? champion} />
        </div>
      </section>
      <section className="studio-card dashboard-audit">
        <div className="card-head">
          <div>
            <h2>Trazabilidad del modelo</h2>
            <p className="soft">Reconstruye el ciclo del artefacto y los datos utilizados.</p>
          </div>
          <button type="button" className="outline-action" onClick={() => onNavigate("traceability")}>Exportar reporte tecnico</button>
        </div>
        <div className="audit-track">
          {pipelineRows.map((step, index) => (
            <div key={step.title}>
              <span>{index + 1}. {step.title}</span>
              <strong>{step.detail}</strong>
            </div>
          ))}
        </div>
        <MetricList rows={[["Hash del artefacto", shortId(champion.asset_id)], ["Version", champion.version], ["Entorno", "Produccion"], ["Tipo", "Modelo predictivo"]]} />
      </section>
    </>
  )
}

function MetricTile({ label, value, note, danger = false }: { label: string; value: unknown; note: string; danger?: boolean }) {
  return (
    <div className={danger ? "metric-tile command-danger" : "metric-tile"}>
      <span>{label}</span>
      <strong>{formatCell(value)}</strong>
      <small>{note}</small>
    </div>
  )
}

function CommandKpi({ icon, title, value, note, kind = "info" }: { icon: ReactNode; title: string; value: unknown; note: string; kind?: StatusKind }) {
  return (
    <article className={`command-kpi command-kpi-${kind}`}>
      <div>{icon}</div>
      <span>{title}</span>
      <strong>{formatCell(value)}</strong>
      <small>{note}</small>
    </article>
  )
}

function chooseChampionAsset(activeAssets: Row[]) {
  return activeAssets.find((asset) => text(asset.model_code, "") === preferredVisualModel) ?? activeAssets.find((asset) => text(asset.status, "") === "active") ?? {}
}

function latestMetric(metrics: Row, key: string) {
  const value = metrics[key]
  return value === undefined || value === null ? undefined : numberValue(value)
}

function modelConfidenceScore(metrics: Row, samples: number, status: unknown) {
  const r2 = latestMetric(metrics, "r2")
  const mae = latestMetric(metrics, "mae")
  let score = 52
  if (r2 !== undefined) score += r2 >= 0.7 ? 24 : r2 >= 0.3 ? 14 : r2 >= 0 ? 4 : -24
  if (mae !== undefined) score += mae <= 0.08 ? 18 : mae <= 0.25 ? 10 : mae <= 0.5 ? 2 : -10
  if (samples >= 18) score += 6
  if (samples >= 1000) score += 6
  if (text(status, "").toLowerCase() === "active") score += 2
  return Math.max(0, Math.min(100, Math.round(score)))
}

function modelTrustLabel(confidence: number, r2: number | undefined) {
  if (r2 !== undefined && r2 < 0) return "Experimental"
  if (confidence < 55) return "Confianza baja"
  if (confidence < 75) return "Confianza media"
  return "Confianza alta"
}

function modelTrustKind(confidence: number, r2: number | undefined): StatusKind {
  if (r2 !== undefined && r2 < 0) return "warning"
  if (confidence < 55) return "danger"
  if (confidence < 75) return "warning"
  return "success"
}

function recommendationText(confidence: number, r2: number | undefined) {
  if (r2 !== undefined && r2 < 0) return "El modelo presenta bajo desempeno en validacion. Revisa la calidad del dataset o entrena un candidato antes de promoverlo."
  if (confidence < 55) return "Ejecuta nuevas pruebas con datos recientes y compara contra Random Forest o regresion antes de usarlo como referencia operativa."
  return "El modelo es usable para monitoreo asistido. Mantener trazabilidad y repetir validacion con nuevas muestras."
}

function modelDashboardName(modelCode: unknown, targetVariable: unknown) {
  const code = text(modelCode, "")
  const target = text(targetVariable, "").replace("dissolved_oxygen_mg_l", "OD").replace("water_temperature_c", "Temp")
  if (code.includes("SVM")) return `SVR-${target}-v1`
  if (code.includes("RANDOM_FOREST")) return `Random Forest-${target}`
  if (code.includes("DECISION_TREE")) return `Arbol-${target}`
  if (code.includes("LINEAR_REG")) return `Regresion lineal-${target}`
  if (code.includes("KNN")) return `KNN-${target}`
  if (code.includes("PCA")) return `PCA-${target}`
  return modelTitle(code)
}

function shortId(value: unknown) {
  const id = text(value, "-")
  if (id.length <= 18) return id
  return `${id.slice(0, 10)}...${id.slice(-6)}`
}

function buildDashboardPipelineRows(lifecycle: Row, champion: Row, championJob: Row, samples: number): Array<{ title: string; detail: string; status: string; kind: StatusKind }> {
  const r2 = latestMetric(row(champion.metrics_json), "r2")
  return [
    { title: "Datos", detail: `${samples || "0"} muestras`, status: lifecycle.datasets_enabled !== false ? "OK" : "Pendiente", kind: lifecycle.datasets_enabled !== false ? "success" : "warning" },
    { title: "Limpieza", detail: "Valores tratados", status: lifecycle.cleaning_enabled !== false ? "OK" : "Pendiente", kind: lifecycle.cleaning_enabled !== false ? "success" : "warning" },
    { title: "Features", detail: text(champion.feature_set_id, "Sin feature set"), status: champion.feature_set_id ? "OK" : "Pendiente", kind: champion.feature_set_id ? "success" : "warning" },
    { title: "Entrenamiento", detail: shortId(champion.training_job_id), status: text(championJob.status, "Completado"), kind: statusKind(championJob.status ?? "completed") },
    { title: "Validacion", detail: r2 === undefined ? "Metricas pendientes" : `R2 ${formatNumber(r2, 3)}`, status: r2 !== undefined && r2 < 0 ? "Advertencia" : "OK", kind: r2 !== undefined && r2 < 0 ? "warning" : "success" },
    { title: "Artefacto", detail: text(champion.version, "v1"), status: champion.asset_id ? "Activo" : "Pendiente", kind: champion.asset_id ? "success" : "warning" },
    { title: "Produccion", detail: text(champion.status, "sin estado"), status: text(champion.status, "Pendiente"), kind: statusKind(champion.status) },
    { title: "Inferencia", detail: "Disponible", status: "ON", kind: "info" },
  ]
}

function buildModelComparisonRows(activeAssets: Row[], trainable: Row[]) {
  const merged = mergeModelRows(trainable, activeAssets)
  return merged
    .map((item) => {
      const metrics = row(item.metrics_json ?? item.latest_metrics)
      const mae = latestMetric(metrics, "mae")
      const rmse = latestMetric(metrics, "rmse")
      const r2 = latestMetric(metrics, "r2")
      const target = row(item.artifact_payload).target_variable ?? item.target_variable ?? "calidad"
      const confidence = modelConfidenceScore(metrics, 18, item.status ?? item.lifecycle_status)
      return {
        model_code: item.model_code,
        model_name: modelDashboardName(item.model_code, target),
        target_variable: target,
        mae,
        rmse,
        r2,
        state: modelTrustLabel(confidence, r2),
        kind: modelTrustKind(confidence, r2),
        score: confidence,
      }
    })
    .sort((left, right) => {
      const leftMae = left.mae ?? Number.POSITIVE_INFINITY
      const rightMae = right.mae ?? Number.POSITIVE_INFINITY
      if (left.kind === "success" && right.kind !== "success") return -1
      if (right.kind === "success" && left.kind !== "success") return 1
      return leftMae - rightMae
    })
}

function Kpi({ icon, label, value, note, color = "blue" }: { icon: ReactNode; label: string; value: string; note: string; color?: string }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon kpi-${color}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  )
}

function DataView({ selectedPondId }: { selectedPondId: string }) {
  const queryClient = useQueryClient()
  const [readinessModel, setReadinessModel] = useState(defaultModel)
  const sourcesQuery = useQuery({ queryKey: ["dataset-sources"], queryFn: () => apiGet<unknown>("/datasets/sources") })
  const trainableQuery = useQuery({ queryKey: ["data-trainable-models"], queryFn: () => apiGet<unknown>("/ml/trainable-models") })
  const coverageQuery = useQuery({ queryKey: ["dataset-coverage", selectedPondId], queryFn: () => apiGet<unknown>(query("/datasets/coverage", { pond_id: selectedPondId })) })
  const variablesQuery = useQuery({ queryKey: ["dataset-variables", selectedPondId], queryFn: () => apiGet<unknown>(query("/datasets/variables", { pond_id: selectedPondId })) })
  const readinessQuery = useQuery({
    queryKey: ["dataset-readiness", selectedPondId, readinessModel],
    queryFn: () => apiGet<unknown>(query("/datasets/readiness", { pond_id: selectedPondId, model_code: readinessModel })),
  })
  const syncMutation = useMutation({
    mutationFn: () => apiPost<unknown>("/datasets/sync-legacy"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-coverage"] })
      queryClient.invalidateQueries({ queryKey: ["dataset-variables"] })
    },
  })
  const coverage = unwrapObject(coverageQuery.data)
  const variables = getVariables(coverageQuery.data, variablesQuery.data)
  const readiness = unwrapObject(readinessQuery.data)
  const readinessModels = rows(trainableQuery.data).map((item) => text(item.model_code, "")).filter(Boolean)

  return (
    <>
      <section className="page-head">
        <h1>DATOS Y COBERTURA</h1>
        <p>Crea y actualiza una copia de trabajo desde la base operativa sin modificar los datos originales.</p>
      </section>
      <section className="filter-bar mlops-toolbar">
        <button type="button" className="primary-action" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
          <RefreshCcw size={16} /> {syncMutation.isPending ? "Actualizando copia" : "Actualizar copia desde base operativa"}
        </button>
        <label className="select-box">
          <span>Comprobar requisitos de</span>
          <select value={readinessModel} onChange={(event) => setReadinessModel(event.target.value)}>
            {(readinessModels.length ? readinessModels : [defaultModel]).map((model) => (
              <option key={model}>{model}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <JsonButton label="Fuentes dataset" value={sourcesQuery.data} />
      </section>
      <ErrorNote error={sourcesQuery.error ?? trainableQuery.error ?? coverageQuery.error ?? variablesQuery.error ?? readinessQuery.error ?? syncMutation.error} />
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <h2>¿ALCANZAN LOS DATOS PARA ESTE MODELO?</h2>
          <div className="acceptance">
            {readiness.can_train ? <CheckCircle2 /> : <AlertTriangle />}
            <div>
              <strong>{readiness.can_train ? "Dataset entrenable" : "No se puede entrenar todavia"}</strong>
              <span>{Array.isArray(readiness.missing_variables) ? `Faltan: ${readiness.missing_variables.join(", ")}` : "Validacion de variables requeridas"}</span>
            </div>
          </div>
          <MetricList rows={[["Registros copiados", coverage.total_records], ["Variables utilizables", Array.isArray(coverage.trainable_variables) ? coverage.trainable_variables.length : 0], ["Modelo comprobado", readinessModel], ["Datos originales", "solo lectura"]]} />
        </div>
        <div className="studio-card mlops-card">
          <h2>VARIABLES DISPONIBLES</h2>
          <DataTable rows={variables} columns={["variable_code", "unit", "records", "first_time", "last_time", "missing_count", "outlier_count", "completeness_ratio", "trainable"]} />
        </div>
      </section>
    </>
  )
}

function getVariables(coverageData: unknown, variablesData: unknown) {
  const coverage = unwrapObject(coverageData)
  return rows(coverage.variables).length ? rows(coverage.variables) : rows(variablesData)
}

function CleaningView({ selectedPondId }: { selectedPondId: string }) {
  const queryClient = useQueryClient()
  const variablesQuery = useQuery({ queryKey: ["dataset-variables", selectedPondId], queryFn: () => apiGet<unknown>(query("/datasets/variables", { pond_id: selectedPondId })) })
  const runsQuery = useQuery({ queryKey: ["cleaning-runs"], queryFn: () => apiGet<unknown>("/data/cleaning-runs") })
  const variables = useMemo(() => {
    const available = rows(variablesQuery.data)
      .map((item) => text(item.variable_code, ""))
      .filter(Boolean)
    return available.length ? available : defaultVariables
  }, [variablesQuery.data])
  const [selectedVariables, setSelectedVariables] = useState<string[]>(defaultVariables.slice(0, 3))
  const [applyInterpolation, setApplyInterpolation] = useState(true)
  const [applySigma3, setApplySigma3] = useState(true)
  const [applyMinmax, setApplyMinmax] = useState(true)
  const [overwriteClean, setOverwriteClean] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState("")
  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<unknown>("/data/cleaning-runs", {
        pond_id: selectedPondId,
        variable_codes: selectedVariables,
        apply_interpolation: applyInterpolation,
        apply_sigma3: applySigma3,
        apply_minmax: applyMinmax,
        overwrite_clean_measurements: overwriteClean,
      }),
    onSuccess: (data) => {
      setSelectedRunId(text(row(data).run_id, selectedRunId))
      queryClient.invalidateQueries({ queryKey: ["cleaning-runs"] })
    },
  })
  const runs = rows(runsQuery.data)
  const activeRunId = selectedRunId || text(runs[0]?.run_id, "")
  const summaryQuery = useQuery({ queryKey: ["cleaning-summary", activeRunId], queryFn: () => apiGet<unknown>(`/data/cleaning-runs/${activeRunId}/summary`), enabled: Boolean(activeRunId) })
  const previewQuery = useQuery({ queryKey: ["cleaning-preview", activeRunId], queryFn: () => apiGet<unknown>(`/data/cleaning-runs/${activeRunId}/preview`), enabled: Boolean(activeRunId) })
  const summary = row(summaryQuery.data)
  const preview = unwrapObject(previewQuery.data)
  const previewRows = rows(preview.preview_rows).length ? rows(preview.preview_rows) : rows(previewQuery.data)
  const cleaningMethods = [
    { title: "Interpolacion lineal", detail: "Completa huecos temporales sin modificar la base legacy.", active: applyInterpolation },
    { title: "Regla 3 sigma", detail: "Marca valores extremos para evitar entrenar con ruido fuerte.", active: applySigma3 },
    { title: "Normalizacion MinMax", detail: "Escala variables y deja el dataset listo para ML.", active: applyMinmax },
    { title: "Persistencia versionada", detail: "Guarda cleaning_run_id y mediciones limpias separadas.", active: true },
  ]
  const autofillCleaning = () => {
    setSelectedVariables(variables)
    setApplyInterpolation(true)
    setApplySigma3(true)
    setApplyMinmax(true)
    setOverwriteClean(false)
  }

  return (
    <>
      <section className="page-head">
        <h1>LIMPIEZA DE DATOS</h1>
        <p>Ejecuta interpolacion, filtro 3-sigma y normalizacion sobre telemetria real.</p>
      </section>
      <ErrorNote error={variablesQuery.error ?? runsQuery.error ?? summaryQuery.error ?? previewQuery.error ?? createMutation.error} />
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <div className="card-head">
            <div>
              <h2>NUEVO CLEANING RUN</h2>
              <p className="soft">Preparacion reproducible antes de features y entrenamiento.</p>
            </div>
            <button type="button" className="mini-btn mini-btn-primary" onClick={autofillCleaning}>Autorrellenar</button>
          </div>
          <div className="method-grid">
            {cleaningMethods.map((method) => (
              <article className={method.active ? "method-card active" : "method-card"} key={method.title}>
                <CheckCircle2 size={16} />
                <strong>{method.title}</strong>
                <p>{method.detail}</p>
              </article>
            ))}
          </div>
          <CheckboxGroup values={variables} selected={selectedVariables} onChange={setSelectedVariables} />
          <div className="toggle-grid">
            <Toggle label="Interpolacion" checked={applyInterpolation} onChange={setApplyInterpolation} />
            <Toggle label="Filtro 3-sigma" checked={applySigma3} onChange={setApplySigma3} />
            <Toggle label="MinMax" checked={applyMinmax} onChange={setApplyMinmax} />
            <Toggle label="Actualizar clean_measurements derivados" checked={overwriteClean} onChange={setOverwriteClean} />
          </div>
          <div className="inline-state">La sincronizacion legacy queda intacta; esta corrida crea evidencia propia para entrenamiento.</div>
          <button type="button" className="success-action" disabled={!selectedVariables.length || createMutation.isPending} onClick={() => createMutation.mutate()}>
            <FlaskConical size={16} /> {createMutation.isPending ? "Ejecutando" : "Ejecutar limpieza"}
          </button>
        </div>
        <div className="studio-card mlops-card">
          <h2>RUNS Y PREVIEW</h2>
          <NativeSelect label="Cleaning run" value={activeRunId} options={runs.map((run) => text(run.run_id, ""))} onChange={setSelectedRunId} />
          <div className="cleaning-summary-grid">
            <MetricTile label="Entrada" value={summary.records_in} note="registros raw" />
            <MetricTile label="Salida" value={summary.records_out} note="registros limpios" />
            <MetricTile label="Outliers" value={summary.outliers_detected} note="regla 3 sigma" danger={numberValue(summary.outliers_detected) > 0} />
          </div>
          <MetricList rows={[["Run activo", activeRunId], ["Estado", summary.status ?? row(runs[0]).status], ["Interpolados", summary.interpolated_points], ["Normalizados", summary.normalized_points], ["Persistencia", "cleaning_run_measurements"]]} />
          <DataTable rows={previewRows.slice(0, 8)} columns={["time", "variable_code", "clean_value", "standard_unit", "quality_flag", "validation_status", "cleaning_method"]} />
        </div>
      </section>
    </>
  )
}

function FeaturesView({ selectedPondId }: { selectedPondId: string }) {
  const queryClient = useQueryClient()
  const cleaningRunsQuery = useQuery({ queryKey: ["cleaning-runs"], queryFn: () => apiGet<unknown>("/data/cleaning-runs") })
  const featuresQuery = useQuery({ queryKey: ["features"], queryFn: () => apiGet<unknown>("/features") })
  const [cleaningRunId, setCleaningRunId] = useState("")
  const [targetVariable, setTargetVariable] = useState("dissolved_oxygen_mg_l")
  const [featureVariables, setFeatureVariables] = useState<string[]>(["water_temperature_c", "ph", "nitrate_ion"])
  const [windowSize, setWindowSize] = useState(8)
  const [horizon, setHorizon] = useState(1)
  const [pearsonThreshold, setPearsonThreshold] = useState("0.2")
  const [trainFraction, setTrainFraction] = useState(0.7)
  const [validationFraction, setValidationFraction] = useState(0.15)
  const [selectedFeatureSetId, setSelectedFeatureSetId] = useState("")
  const cleaningRuns = rows(cleaningRunsQuery.data)
  const features = rows(featuresQuery.data)
  const buildMutation = useMutation({
    mutationFn: () =>
      apiPost<unknown>("/features/build", {
        pond_id: selectedPondId,
        cleaning_run_id: cleaningRunId || null,
        target_variable: targetVariable,
        feature_variables: featureVariables,
        window_size: windowSize,
        horizon,
        pearson_threshold: pearsonThreshold ? Number(pearsonThreshold) : null,
        train_fraction: trainFraction,
        validation_fraction: validationFraction,
      }),
    onSuccess: (data) => {
      setSelectedFeatureSetId(text(row(data).feature_set_id, selectedFeatureSetId))
      queryClient.invalidateQueries({ queryKey: ["features"] })
    },
  })
  const activeFeatureSetId = selectedFeatureSetId || text(features[0]?.feature_set_id, "")
  const featureDetailQuery = useQuery({ queryKey: ["feature-detail", activeFeatureSetId], queryFn: () => apiGet<unknown>(`/features/${activeFeatureSetId}`), enabled: Boolean(activeFeatureSetId) })
  const previewQuery = useQuery({ queryKey: ["feature-preview", activeFeatureSetId], queryFn: () => apiGet<unknown>(`/features/${activeFeatureSetId}/preview`), enabled: Boolean(activeFeatureSetId) })
  const columnsQuery = useQuery({ queryKey: ["feature-columns", activeFeatureSetId], queryFn: () => apiGet<unknown>(`/features/${activeFeatureSetId}/columns`), enabled: Boolean(activeFeatureSetId) })

  return (
    <>
      <section className="page-head">
        <h1>FEATURE SETS</h1>
        <p>Construye matrices tabulares o secuenciales para entrenar modelos ML.</p>
      </section>
      <ErrorNote error={cleaningRunsQuery.error ?? featuresQuery.error ?? buildMutation.error ?? featureDetailQuery.error ?? previewQuery.error ?? columnsQuery.error} />
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <h2>BUILDER DE FEATURES</h2>
          <NativeSelect label="Cleaning run" value={cleaningRunId} options={cleaningRuns.map((run) => text(run.run_id, ""))} onChange={setCleaningRunId} />
          {!cleaningRunId ? <div className="inline-state">Sin cleaning_run_id: se usaran mediciones limpias actuales si el backend lo permite.</div> : null}
          <NativeSelect label="Target" value={targetVariable} options={defaultVariables} onChange={setTargetVariable} />
          <CheckboxGroup values={defaultVariables} selected={featureVariables} onChange={setFeatureVariables} />
          <NumberGrid rows={[["window_size", windowSize, setWindowSize], ["horizon", horizon, setHorizon], ["train_fraction", trainFraction, setTrainFraction], ["validation_fraction", validationFraction, setValidationFraction]]} />
          <label className="form-line">
            <span>Pearson threshold</span>
            <input value={pearsonThreshold} onChange={(event) => setPearsonThreshold(event.target.value)} />
          </label>
          <button type="button" className="primary-action" disabled={!targetVariable || !featureVariables.length || buildMutation.isPending} onClick={() => buildMutation.mutate()}>
            <Table2 size={16} /> {buildMutation.isPending ? "Creando" : "Crear feature set"}
          </button>
        </div>
        <div className="studio-card mlops-card">
          <h2>FEATURE SET ACTIVO</h2>
          <NativeSelect label="Feature set" value={activeFeatureSetId} options={features.map((feature) => text(feature.feature_set_id, ""))} onChange={setSelectedFeatureSetId} />
          <MetricList rows={[["Rows", row(featureDetailQuery.data).rows_count], ["Train", row(featureDetailQuery.data).train_rows], ["Validation", row(featureDetailQuery.data).validation_rows], ["Test", row(featureDetailQuery.data).test_rows]]} />
          <DataTable rows={rows(columnsQuery.data ?? row(featureDetailQuery.data).columns)} columns={["name", "role", "source_variable", "pearson_score"]} />
          <DataTable rows={rows(previewQuery.data).slice(0, 5)} columns={Object.keys(row(rows(previewQuery.data)[0])).slice(0, 6)} />
        </div>
      </section>
    </>
  )
}

function TrainingView({ selectedPondId }: { selectedPondId: string }) {
  const queryClient = useQueryClient()
  const trainableQuery = useQuery({ queryKey: ["trainable-models"], queryFn: () => apiGet<unknown>("/ml/trainable-models") })
  const portfolioQuery = useQuery({ queryKey: ["model-portfolio", selectedPondId], queryFn: () => apiGet<unknown>(query("/ml/models/portfolio", { pond_id: selectedPondId })), refetchInterval: 15_000 })
  const featuresQuery = useQuery({ queryKey: ["features"], queryFn: () => apiGet<unknown>("/features") })
  const jobsQuery = useQuery({ queryKey: ["training-jobs"], queryFn: () => apiGet<unknown>("/ml/training-jobs"), refetchInterval: 15_000 })
  const trainable = rows(trainableQuery.data)
  const portfolio = rows(portfolioQuery.data)
  const features = rows(featuresQuery.data)
  const jobs = rows(jobsQuery.data)
  const [modelCode, setModelCode] = useState(defaultModel)
  const [featureSetId, setFeatureSetId] = useState("")
  const [epochs, setEpochs] = useState(400)
  const [learningRate, setLearningRate] = useState("0.0001")
  const [autoActivate, setAutoActivate] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState("")
  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<unknown>("/ml/training-jobs", {
        model_code: modelCode,
        feature_set_id: featureSetId || null,
        hyperparameters: { learning_rate: Number(learningRate), epochs },
        auto_activate: autoActivate,
      }),
    onSuccess: (data) => {
      setSelectedJobId(text(row(data).job_id, selectedJobId))
      queryClient.invalidateQueries({ queryKey: ["training-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["model-assets"] })
      queryClient.invalidateQueries({ queryKey: ["model-portfolio"] })
    },
  })
  const activeJobId = selectedJobId || text(jobs[0]?.job_id, "")
  const eventsQuery = useQuery({ queryKey: ["training-events", activeJobId], queryFn: () => apiGet<unknown>(`/ml/training-jobs/${activeJobId}/events`), enabled: Boolean(activeJobId), refetchInterval: 10_000 })
  const availableModelCodes = trainable.map((item) => text(item.model_code, "")).filter(Boolean)
  const activeJob = jobs.find((job) => text(job.job_id, "") === activeJobId) ?? {}
  const activeFeatureSet = features.find((feature) => text(feature.feature_set_id, "") === (featureSetId || text(activeJob.feature_set_id, ""))) ?? {}
  const selectedPortfolio = portfolio.find((item) => text(item.model_code, "") === modelCode) ?? {}
  const trainingSteps = buildTrainingProgressRows(activeJob, createMutation.isPending)
  const autofillTraining = () => {
    const preferredModel = availableModelCodes.includes(preferredVisualModel) ? preferredVisualModel : availableModelCodes[0] || defaultModel
    const preferredFeature =
      features.find((feature) => text(feature.target_variable, "") === "ph") ??
      features.find((feature) => text(feature.target_variable, "") === "dissolved_oxygen_mg_l") ??
      features[0]
    setModelCode(preferredModel)
    setFeatureSetId(text(preferredFeature?.feature_set_id, ""))
    setEpochs(400)
    setLearningRate("0.0001")
    setAutoActivate(false)
  }

  return (
    <>
      <section className="page-head">
        <h1>CENTRO DE ENTRENAMIENTO</h1>
        <p>Identifica qué modelos pueden entrenarse con el estanque actual, qué falta y qué versiones ya existen.</p>
      </section>
      <ErrorNote error={trainableQuery.error ?? portfolioQuery.error ?? featuresQuery.error ?? jobsQuery.error ?? eventsQuery.error ?? createMutation.error} />
      <section className="portfolio-summary-grid">
        <CommandKpi icon={<CheckCircle2 />} title="Entrenables ahora" value={String(portfolio.filter((item) => item.can_train).length)} note={`de ${portfolio.length} modelos`} kind="success" />
        <CommandKpi icon={<AlertTriangle />} title="Bloqueados por datos" value={String(portfolio.filter((item) => !item.can_train).length)} note="variables o registros faltantes" kind="warning" />
        <CommandKpi icon={<Brain />} title="Ya entrenados" value={String(portfolio.filter((item) => numberValue(item.version_count) > 0).length)} note={`${portfolio.reduce((sum, item) => sum + numberValue(item.version_count), 0)} versiones totales`} kind="info" />
        <CommandKpi icon={<Rocket />} title="Activos en API" value={String(portfolio.filter((item) => item.active_asset_id).length)} note="sirviendo inferencias" kind="success" />
      </section>
      <ModelPortfolioGrid portfolio={portfolio} selectedModelCode={modelCode} onSelect={setModelCode} />
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <div className="card-head">
            <div>
              <h2>LANZADOR DE PIPELINE</h2>
              <p className="soft">Entrena candidatos; la promocion a produccion se hace desde artefactos.</p>
            </div>
            <button type="button" className="mini-btn mini-btn-primary" onClick={autofillTraining}>Autorrellenar</button>
          </div>
          <NativeSelect label="Modelo entrenable" value={modelCode} options={availableModelCodes.length ? availableModelCodes : [defaultModel, "BPNN_MEA_FEED_INTAKE", "PEARSON_LSTM_ATTENTION_WQ"]} onChange={setModelCode} />
          <div className={selectedPortfolio.can_train ? "training-readiness ready" : "training-readiness blocked"}>
            {selectedPortfolio.can_train ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <div>
              <strong>{selectedPortfolio.can_train ? "Puede entrenarse con los datos actuales" : "Aún no puede entrenarse"}</strong>
              <span>{selectedPortfolio.can_train ? `${text(selectedPortfolio.available_variables, "variables disponibles")}` : `Faltan: ${formatRequiredVariables(selectedPortfolio.missing_variables)}`}</span>
            </div>
          </div>
          <NativeSelect label="Feature set" value={featureSetId} options={features.map((feature) => text(feature.feature_set_id, ""))} onChange={setFeatureSetId} />
          <div className="training-context">
            <MetricTile label="Target" value={activeFeatureSet.target_variable ?? "-"} note="feature set" />
            <MetricTile label="Filas train" value={activeFeatureSet.train_rows ?? "-"} note="muestras" />
            <MetricTile label="Filas test" value={activeFeatureSet.test_rows ?? "-"} note="validacion" />
          </div>
          <NumberGrid rows={[["epochs", epochs, setEpochs]]} />
          <label className="form-line">
            <span>learning_rate</span>
            <input value={learningRate} onChange={(event) => setLearningRate(event.target.value)} />
          </label>
          <Toggle label="Auto activar artefacto si el backend lo permite" checked={autoActivate} onChange={setAutoActivate} />
          <button type="button" className="success-action" disabled={!modelCode || !featureSetId || selectedPortfolio.can_train === false || createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Brain size={16} /> {createMutation.isPending ? "Entrenando candidato" : "Entrenar candidato"}
          </button>
        </div>
        <div className="studio-card mlops-card">
          <h2>JOBS Y EVENTOS</h2>
          <NativeSelect label="Training job" value={activeJobId} options={jobs.map((job) => text(job.job_id, ""))} onChange={setSelectedJobId} />
          <div className="training-stage-track">
            {trainingSteps.map((step) => (
              <article className={`training-stage training-stage-${step.kind}`} key={step.title}>
                <span>{step.title}</span>
                <strong>{step.value}</strong>
                <small>{step.detail}</small>
              </article>
            ))}
          </div>
          <DataTable rows={jobs.slice(0, 6)} columns={["job_id", "model_code", "feature_set_id", "status", "asset_id", "created_at"]} />
          <EventTimeline events={rows(eventsQuery.data)} pondId={selectedPondId} />
        </div>
      </section>
    </>
  )
}

function ArtifactsView({ selectedPondId }: { selectedPondId: string }) {
  const queryClient = useQueryClient()
  const [modelFilter, setModelFilter] = useState("")
  const assetsQuery = useQuery({
    queryKey: ["model-assets", modelFilter],
    queryFn: () => apiGet<unknown>(query("/ml/model-assets", { model_code: modelFilter || undefined, include_payload: false })),
  })
  const portfolioQuery = useQuery({ queryKey: ["artifact-portfolio", selectedPondId], queryFn: () => apiGet<unknown>(query("/ml/models/portfolio", { pond_id: selectedPondId })), refetchInterval: 15_000 })
  const assets = rows(assetsQuery.data)
  const portfolio = rows(portfolioQuery.data)
  const activateMutation = useMutation({
    mutationFn: (assetId: string) => apiPost<unknown>(`/ml/model-assets/${assetId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-assets"] })
      queryClient.invalidateQueries({ queryKey: ["artifact-portfolio"] })
    },
  })
  const deprecateMutation = useMutation({
    mutationFn: (assetId: string) => apiPost<unknown>(`/ml/model-assets/${assetId}/deprecate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-assets"] })
      queryClient.invalidateQueries({ queryKey: ["artifact-portfolio"] })
    },
  })
  const modelCodes = portfolio.map((model) => text(model.model_code, "")).filter(Boolean)
  const assetRows = assets.map((asset) => {
    const metrics = row(asset.metrics_json)
    return {
      ...asset,
      mae: latestMetric(metrics, "mae"),
      rmse: latestMetric(metrics, "rmse"),
      r2: latestMetric(metrics, "r2"),
      activation_target: text(asset.status) === "active" ? `/models/${text(asset.model_code)}/predict` : "no sirve inferencias",
    }
  })

  return (
    <>
      <section className="page-head">
        <h1>VERSIONES Y PUBLICACIÓN</h1>
        <p>Cada artefacto es una versión entrenada. Activar una versión la conecta a la ruta productiva de inferencia del modelo.</p>
      </section>
      <ErrorNote error={assetsQuery.error ?? portfolioQuery.error ?? activateMutation.error ?? deprecateMutation.error} />
      <section className="artifact-explainer">
        <Rocket size={20} />
        <div><strong>¿Qué ocurre al activar?</strong><span>La versión elegida pasa a responder en <code>/models/&#123;model_code&#125;/predict</code>. La versión activa anterior deja de ser productiva, pero conserva trazabilidad y métricas.</span></div>
      </section>
      <ModelPortfolioGrid portfolio={portfolio.filter((item) => numberValue(item.version_count) > 0)} selectedModelCode={modelFilter} onSelect={setModelFilter} />
      <section className="filter-bar mlops-toolbar">
        <NativeSelect label="Modelo" value={modelFilter} options={["", ...modelCodes]} onChange={setModelFilter} />
        <JsonButton label="Assets JSON" value={assetsQuery.data} />
      </section>
      <div className="studio-card mlops-card">
        <DataTable
          rows={assetRows}
          columns={["model_code", "version", "status", "mae", "rmse", "r2", "activation_target", "feature_set_id", "training_job_id", "created_at", "activated_at"]}
          actions={(asset) => (
            <>
              <button type="button" className="mini-btn mini-btn-success" disabled={activateMutation.isPending || text(asset.status) === "active"} onClick={() => activateMutation.mutate(text(asset.asset_id, ""))}>
                Activar
              </button>
              <button type="button" className="mini-btn mini-btn-warning" disabled={deprecateMutation.isPending} onClick={() => deprecateMutation.mutate(text(asset.asset_id, ""))}>
                Deprecar
              </button>
              <JsonButton label="Metricas" value={asset.metrics_json ?? asset.metrics} />
            </>
          )}
        />
      </div>
    </>
  )
}

function ModelLifecycleView({ selectedPondId }: { selectedPondId: string }) {
  const lifecycleQuery = useQuery({ queryKey: ["ml-lifecycle"], queryFn: () => apiGet<unknown>("/ml/lifecycle/status"), refetchInterval: 30_000 })
  const trainableQuery = useQuery({ queryKey: ["trainable-models"], queryFn: () => apiGet<unknown>("/ml/trainable-models"), refetchInterval: 30_000 })
  const portfolioQuery = useQuery({ queryKey: ["models-portfolio", selectedPondId], queryFn: () => apiGet<unknown>(query("/ml/models/portfolio", { pond_id: selectedPondId })), refetchInterval: 30_000 })
  const assetsQuery = useQuery({ queryKey: ["active-assets"], queryFn: () => apiGet<unknown>(query("/ml/model-assets", { status: "active", include_payload: false })), refetchInterval: 30_000 })
  const jobsQuery = useQuery({ queryKey: ["training-jobs"], queryFn: () => apiGet<unknown>("/ml/training-jobs"), refetchInterval: 30_000 })
  const featuresQuery = useQuery({ queryKey: ["features"], queryFn: () => apiGet<unknown>("/features"), refetchInterval: 30_000 })
  const lifecycle = unwrapObject(lifecycleQuery.data)
  const trainable = rows(trainableQuery.data)
  const portfolio = rows(portfolioQuery.data)
  const activeAssets = rows(assetsQuery.data)
  const jobs = rows(jobsQuery.data)
  const featureSets = rows(featuresQuery.data)
  const [selectedModelCode, setSelectedModelCode] = useState(preferredVisualModel)
  const selectedAsset = activeAssets.find((asset) => text(asset.model_code, "") === selectedModelCode) ?? {}
  const selectedJob = jobs.find((job) => text(job.job_id, "") === text(selectedAsset.training_job_id, "")) ?? {}
  const featureSetId = text(selectedAsset.feature_set_id, "")
  const selectedFeatureSet = featureSets.find((featureSet) => text(featureSet.feature_set_id, "") === featureSetId) ?? {}
  const readinessQuery = useQuery({
    queryKey: ["model-readiness", selectedPondId, selectedModelCode],
    queryFn: () => apiGet<unknown>(query("/datasets/readiness", { pond_id: selectedPondId, model_code: selectedModelCode })),
    enabled: Boolean(selectedPondId && selectedModelCode),
  })
  const lifecycleDetailQuery = useQuery({
    queryKey: ["model-lifecycle-detail", selectedPondId, selectedModelCode],
    queryFn: () => apiGet<unknown>(query(`/ml/models/${selectedModelCode}/lifecycle`, { pond_id: selectedPondId })),
    enabled: Boolean(selectedPondId && selectedModelCode),
    refetchInterval: 30_000,
  })
  const previewQuery = useQuery({
    queryKey: ["model-feature-preview", featureSetId],
    queryFn: () => apiGet<unknown>(`/features/${featureSetId}/preview`),
    enabled: Boolean(featureSetId),
  })
  const readiness = unwrapObject(readinessQuery.data)
  const lifecycleDetail = unwrapObject(lifecycleDetailQuery.data)
  const previewObject = unwrapObject(previewQuery.data)
  const previewRows = rows(previewObject.preview_rows)
  const previewColumns = rows(previewObject.columns).length ? rows(previewObject.columns) : rows(selectedFeatureSet.columns)
  const targetVariable = text(
    previewColumns.find((column) => text(column.role, "") === "target")?.source_variable ??
      selectedFeatureSet.target_variable ??
      row(selectedAsset.artifact_payload).target_variable,
    "variable objetivo",
  )
  const featureNames = getFeatureNames(selectedAsset, selectedAsset.metrics_json)
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({})
  const predictMutation = useMutation({
    mutationFn: () =>
      apiPost<unknown>(`/models/${selectedModelCode}/predict`, {
        features: Object.fromEntries(featureNames.map((name) => [name, Number(featureValues[name] ?? 0)])),
      }),
  })
  const demoMutation = useMutation({
    mutationFn: async () => {
      const sourceRows = previewRows.slice(0, 18)
      const results: Row[] = []
      for (const sample of sourceRows) {
        const features = Object.fromEntries(featureNames.map((name, index) => [name, getSampleFeatureValue(sample, name, index)]))
        const prediction = await apiPost<unknown>(`/models/${selectedModelCode}/predict`, { features })
        results.push({
          label: String(results.length + 1),
          index: numberValue(sample.row_index, results.length),
          observed: numberValue(sample.target),
          predicted: numberValue(row(prediction).prediction),
          error: Math.abs(numberValue(sample.target) - numberValue(row(prediction).prediction)),
          ...features,
        })
      }
      return results
    },
  })
  const modelsToShow = portfolio.length ? portfolio : mergeModelRows(trainable, activeAssets)
  const activeCount = activeAssets.length
  const previewChartRows = useMemo(() => buildPreviewChartRows(previewRows, featureNames), [previewRows, featureNames])
  const demoRows = Array.isArray(demoMutation.data) ? demoMutation.data : []
  const chartRows = demoRows.length ? demoRows : previewChartRows
  const pearsonRows = useMemo(() => buildPearsonRows(previewColumns), [previewColumns])
  const latestDemoRow = demoRows[demoRows.length - 1] ?? {}
  const averageError = demoRows.length ? demoRows.reduce((sum, item) => sum + numberValue(item.error), 0) / demoRows.length : null
  const selectedMetrics = row(selectedAsset.metrics_json ?? selectedJob.metrics)
  const selectedR2 = latestMetric(selectedMetrics, "r2")
  const selectedMae = latestMetric(selectedMetrics, "mae")
  const selectedRmse = latestMetric(selectedMetrics, "rmse")
  const selectedConfidence = modelConfidenceScore(selectedMetrics, previewRows.length, selectedAsset.status)
  const selectedTrust = modelTrustLabel(selectedConfidence, selectedR2)
  const backendSteps = rows(lifecycleDetail.steps)
  const backendPredictions = rows(lifecycleDetail.recent_predictions)
  const detailedSteps = backendSteps.length ? backendSteps : buildDetailedModelSteps(readiness, selectedFeatureSet, selectedJob, selectedAsset, selectedMetrics, demoRows.length)

  useEffect(() => {
    if (modelsToShow.length && !modelsToShow.some((model) => text(model.model_code, "") === selectedModelCode)) {
      setSelectedModelCode(text(modelsToShow[0].model_code, defaultModel))
    }
  }, [modelsToShow, selectedModelCode])

  const fillSample = (sample: Row) => {
    const source = Object.keys(sample).length ? sample : row(previewRows[0] ?? previewChartRows[0])
    const next: Record<string, string> = {}
    featureNames.forEach((name, index) => {
      next[name] = text(getSampleFeatureValue(source, name, index), "0")
    })
    setFeatureValues(next)
  }

  const loadSample = () => {
    fillSample(row(previewRows[0]))
  }

  const runAutoDemo = () => {
    fillSample(row(previewRows[0]))
    demoMutation.mutate()
  }

  useEffect(() => {
    if (!featureNames.length || !previewRows.length) return
    const hasLoadedValues = featureNames.some((name) => text(featureValues[name], "") !== "")
    if (hasLoadedValues) return
    const source = row(previewRows[0])
    const next: Record<string, string> = {}
    featureNames.forEach((name, index) => {
      next[name] = text(getSampleFeatureValue(source, name, index), "0")
    })
    setFeatureValues(next)
  }, [featureNames, featureValues, previewRows])

  return (
    <>
      <section className="page-head model-page-head">
        <div>
          <h1>MODELOS ML EN OPERACION</h1>
          <p>Ciclo completo por modelo: datos, limpieza, preparacion, entrenamiento, artefacto activo, inferencia y trazabilidad. Estanque activo: {selectedPondId}.</p>
        </div>
        <div className="institution-lockup">INICTEL-UNI · PROCIENCIA</div>
      </section>
      <ErrorNote error={lifecycleQuery.error ?? trainableQuery.error ?? portfolioQuery.error ?? assetsQuery.error ?? jobsQuery.error ?? featuresQuery.error ?? readinessQuery.error ?? lifecycleDetailQuery.error ?? previewQuery.error ?? predictMutation.error ?? demoMutation.error} />
      <section className="kpi-grid lifecycle-kpis">
        <Kpi icon={<Database />} label="Limpiezas" value={text(lifecycle.cleaning_enabled ? rowsCountHint(lifecycle, "cleaning") : "0")} note="datos trazables" />
        <Kpi icon={<Table2 />} label="Feature sets" value={text(lifecycle.total_feature_sets, "0")} note={`${featureSets.length} listados`} color="green" />
        <Kpi icon={<Brain />} label="Entrenamientos" value={text(lifecycle.total_training_jobs, "0")} note="jobs registrados" color="purple" />
        <Kpi icon={<Boxes />} label="Activos" value={String(activeCount)} note="modelos productivos" color="amber" />
        <Kpi icon={<Rocket />} label="Inferencia" value={text(lifecycle.model_assets_enabled ? "ON" : "OFF")} note="con trazabilidad" />
      </section>
      <section className="portfolio-catalog-section">
        <div className="card-head">
          <div><h2>CATÁLOGO COMPARATIVO</h2><p className="soft">Versiones, estado productivo, disponibilidad de datos y métricas reales de validación.</p></div>
          <Badge kind="info">{portfolio.length} modelos entrenables</Badge>
        </div>
        <ModelPortfolioGrid portfolio={portfolio} selectedModelCode={selectedModelCode} onSelect={setSelectedModelCode} />
      </section>
      <section className="studio-card model-showcase">
        <div>
          <span>Modelo seleccionado</span>
          <strong>{modelTitle(selectedModelCode)}</strong>
          <p>Objetivo: {targetVariable}. Estado: {selectedTrust}. Use la prueba automatica para llenar variables, ejecutar inferencias reales y ver la proyeccion en el grafico.</p>
          <div className="model-showcase-badges">
            <Badge kind={modelTrustKind(selectedConfidence, selectedR2)}>{selectedTrust}</Badge>
            <Badge kind={readiness.can_train === false ? "warning" : "success"}>{readiness.can_train === false ? "faltan datos" : "datos listos"}</Badge>
            <Badge kind={selectedAsset.asset_id ? "success" : "warning"}>{selectedAsset.asset_id ? "artefacto activo" : "sin artefacto"}</Badge>
            <Badge kind={backendSteps.length ? "success" : "info"}>{backendSteps.length ? "ciclo backend" : "ciclo local"}</Badge>
          </div>
        </div>
        <button type="button" className="run-demo-action" disabled={!selectedAsset.asset_id || !previewRows.length || demoMutation.isPending} onClick={runAutoDemo}>
          <Rocket size={18} /> {demoMutation.isPending ? "Probando modelo" : "Autorrellenar y probar modelo"}
        </button>
      </section>
      <section className="model-command-center">
        <article className="studio-card model-command-card">
          <span>Lectura operativa</span>
          <strong>{readiness.can_train === false ? "No entrenable aun" : "Entrenable con MySQL"}</strong>
          <p>{readiness.can_train === false ? `Faltan: ${formatRequiredVariables(readiness.missing_variables)}` : `${text(readiness.minimum_records_required, "8")} registros minimos requeridos; base actual suficiente.`}</p>
        </article>
        <article className="studio-card model-command-card">
          <span>Validacion</span>
          <strong>{selectedR2 !== undefined && selectedR2 < 0 ? "No recomendar" : selectedAsset.asset_id ? "Evaluado" : "Pendiente"}</strong>
          <p>MAE {formatNumber(selectedMae, 4)} · RMSE {formatNumber(selectedRmse, 4)} · R2 {formatNumber(selectedR2, 3)}</p>
        </article>
        <article className="studio-card model-command-card">
          <span>Siguiente accion</span>
          <strong>{selectedR2 !== undefined && selectedR2 < 0 ? "Entrenar candidato" : selectedAsset.asset_id ? "Probar inferencia" : "Crear artefacto"}</strong>
          <p>{recommendationText(selectedConfidence, selectedR2)}</p>
        </article>
      </section>
      <section className="model-lifecycle-layout">
        <div className="studio-card model-list-panel">
          <div className="card-head">
            <div>
              <h2>CATALOGO DE MODELOS</h2>
              <p className="soft">Seleccione un modelo para ver su vida completa.</p>
            </div>
            <Badge kind="success">{activeCount} activos</Badge>
          </div>
          <div className="model-card-list">
            {modelsToShow.map((model) => {
              const code = text(model.model_code, "")
              const asset = activeAssets.find((item) => text(item.model_code, "") === code)
              const isActive = Boolean(asset)
              return (
                <button key={code} type="button" className={selectedModelCode === code ? "model-life-card active" : "model-life-card"} onClick={() => setSelectedModelCode(code)}>
                  <div>
                    <strong>{modelTitle(code)}</strong>
                    <span>{code}</span>
                  </div>
                  <Badge kind={isActive ? "success" : statusKind(model.lifecycle_status)}>{isActive ? "Activo" : text(model.lifecycle_status, "Pendiente")}</Badge>
                  <p>{modelPurpose(code)}</p>
                  <small>{modelFamily(code, model.family)} · salida: {modelUiCatalog[code]?.output ?? "resultado"}</small>
                </button>
              )
            })}
          </div>
        </div>
        <div className="model-detail-stack">
          <section className="studio-card mlops-card model-detail-card">
            <div className="card-head">
              <div>
                <h2>{modelTitle(selectedModelCode)}</h2>
                <p className="soft">{selectedModelCode}</p>
              </div>
              <Badge kind={selectedAsset.asset_id ? "success" : "warning"}>{selectedAsset.asset_id ? "Artefacto activo" : "Sin artefacto activo"}</Badge>
            </div>
            <div className="lifecycle-steps lifecycle-steps-full">
              {detailedSteps.map((step, index) => (
                <LifecycleStep key={text(step.title, String(index))} number={String(index + 1)} title={text(step.title ?? row(step).step, "Paso")} status={step.status} detail={formatLifecycleDetail(step.detail)} />
              ))}
            </div>
            <section className="model-info-grid">
              <div>
                <h3>Metricas del modelo</h3>
                <MetricList rows={metricRows(selectedMetrics)} />
              </div>
              <div>
                <h3>Trazabilidad del artefacto</h3>
                <MetricList rows={[["Version", selectedAsset.version], ["Feature set", selectedAsset.feature_set_id], ["Training job", selectedAsset.training_job_id], ["Activado", selectedAsset.activated_at], ["Inferencias guardadas", backendPredictions.length], ["Variables faltantes", readiness.missing_variables]]} />
                <JsonButton label="Ciclo backend completo" value={lifecycleDetailQuery.data} />
              </div>
            </section>
          </section>
          <section className="studio-card mlops-card model-detail-card model-chart-card">
            <div className="card-head">
              <div>
                <h2>PROYECCION Y PRUEBA VISUAL</h2>
                <p className="soft">{demoRows.length ? "Predicciones reales ejecutadas contra el backend." : "Vista previa con datos preparados. Pulse la prueba automatica para generar predicciones."}</p>
              </div>
              <Badge kind={demoRows.length ? "success" : "info"}>{demoRows.length ? `${demoRows.length} inferencias` : "preview"}</Badge>
            </div>
            <div className="model-insight-row">
              <div>
                <span>Objetivo</span>
                <strong>{targetVariable}</strong>
              </div>
              <div>
                <span>Ultimo predicho</span>
                <strong>{demoRows.length ? formatNumber(latestDemoRow.predicted, 4) : "-"}</strong>
              </div>
              <div>
                <span>Error medio</span>
                <strong>{averageError === null ? "-" : formatNumber(averageError, 4)}</strong>
              </div>
              <div>
                <span>Muestras graficadas</span>
                <strong>{chartRows.length}</strong>
              </div>
            </div>
            <div className="model-chart-grid">
              <div className="chart-panel chart-panel-wide">
                <h3>Serie del estanque: observado vs predicho</h3>
                <ResponsiveContainer width="100%" height={310}>
                  <LineChart data={chartRows} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6eef9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatNumber(value, 5)} labelFormatter={(label) => `Muestra ${label}`} />
                    <Legend />
                    <ReferenceLine y={0.8} stroke="#16a34a" strokeDasharray="4 4" label="Optimo superior" />
                    <ReferenceLine y={0.4} stroke="#16a34a" strokeDasharray="4 4" label="Optimo inferior" />
                    <ReferenceLine y={0.3} stroke="#f59e0b" strokeDasharray="4 4" label="Alerta" />
                    <Line type="monotone" dataKey="observed" name="Observado" stroke="#0ea5e9" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="predicted" name="Predicho por modelo" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="trend" name="Tendencia preview" stroke="#8b5cf6" strokeDasharray="6 4" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-panel">
                <h3>Variables con mayor senal</h3>
                <ResponsiveContainer width="100%" height={310}>
                  <BarChart data={pearsonRows} layout="vertical" margin={{ top: 12, right: 18, left: 18, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6eef9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={128} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => formatNumber(value, 5)} />
                    <Bar dataKey="score" name="Pearson abs." fill="#1976ff" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
          <section className="studio-card mlops-card model-detail-card">
            <div className="card-head">
              <div>
                <h2>INFERENCIA GUIADA</h2>
                <p className="soft">Para productores tecnicos: un clic carga datos reales preparados y otro ejecuta el modelo activo.</p>
              </div>
              <div className="inference-actions">
                <button type="button" className="mini-btn mini-btn-primary" disabled={!featureSetId || !previewRows.length} onClick={loadSample}>
                  Autorrellenar
                </button>
                <button type="button" className="mini-btn mini-btn-success" disabled={!selectedAsset.asset_id || !previewRows.length || demoMutation.isPending} onClick={runAutoDemo}>
                  Probar con datos reales
                </button>
              </div>
            </div>
            <div className="model-inference-grid">
              <div className="field-grid">
                {featureNames.map((name) => (
                  <label className="form-line" key={name}>
                    <span>{name}</span>
                    <input value={featureValues[name] ?? ""} placeholder="0" onChange={(event) => setFeatureValues((current) => ({ ...current, [name]: event.target.value }))} />
                  </label>
                ))}
              </div>
              <div className="prediction-panel">
                <button type="button" className="primary-action" disabled={!selectedAsset.asset_id || predictMutation.isPending || !featureNames.length} onClick={() => predictMutation.mutate()}>
                  <Rocket size={16} /> {predictMutation.isPending ? "Prediciendo" : "Ejecutar modelo"}
                </button>
                <MetricList rows={[["Resultado", row(predictMutation.data).prediction], ["Prediccion ID", row(row(predictMutation.data).traceability).prediction_id], ["Asset usado", row(predictMutation.data).asset_id]]} />
                <JsonButton label="Trazabilidad de inferencia" value={row(predictMutation.data).traceability ?? predictMutation.data ?? selectedAsset} />
              </div>
            </div>
          </section>
        </div>
      </section>
    </>
  )
}

function mergeModelRows(trainable: Row[], activeAssets: Row[]) {
  const byCode = new Map<string, Row>()
  trainable.forEach((item) => byCode.set(text(item.model_code, ""), item))
  activeAssets.forEach((asset) => {
    const code = text(asset.model_code, "")
    byCode.set(code, { ...byCode.get(code), ...asset, lifecycle_status: "active" })
  })
  return Array.from(byCode.values()).filter((item) => text(item.model_code, ""))
}

function ModelPortfolioGrid({
  portfolio,
  selectedModelCode,
  onSelect,
}: {
  portfolio: Row[]
  selectedModelCode: string
  onSelect: (modelCode: string) => void
}) {
  if (!portfolio.length) return <div className="portfolio-empty">No hay modelos registrados para mostrar.</div>
  return (
    <div className="model-portfolio-grid">
      {portfolio.map((model) => {
        const modelCode = text(model.model_code, "")
        const metrics = row(model.active_metrics ?? model.best_metrics)
        const r2 = latestMetric(metrics, "r2")
        const mae = latestMetric(metrics, "mae")
        const rmse = latestMetric(metrics, "rmse")
        const versionCount = numberValue(model.version_count)
        const active = Boolean(model.active_asset_id)
        return (
          <button type="button" className={selectedModelCode === modelCode ? "model-portfolio-card selected" : "model-portfolio-card"} key={modelCode} onClick={() => onSelect(modelCode)}>
            <div className="portfolio-card-head">
              <div><strong>{modelTitle(modelCode)}</strong><span>{text(model.family, "modelo ML")}</span></div>
              <Badge kind={active ? "success" : model.can_train ? "info" : "warning"}>{active ? "producción" : model.can_train ? "entrenable" : "faltan datos"}</Badge>
            </div>
            <div className="portfolio-version-line">
              <span>Versiones <b>{versionCount}</b></span>
              <span>Activa <b>{text(model.active_version, "ninguna")}</b></span>
              <span>Jobs <b>{text(model.completed_training_runs, "0")}/{text(model.training_runs, "0")}</b></span>
            </div>
            <div className="portfolio-metrics">
              <span><small>MAE</small><b>{formatNumber(mae, 4)}</b></span>
              <span><small>RMSE</small><b>{formatNumber(rmse, 4)}</b></span>
              <span><small>R²</small><b className={r2 !== undefined && r2 < 0 ? "metric-danger" : ""}>{formatNumber(r2, 3)}</b></span>
            </div>
            <div className="portfolio-data-state">
              {model.can_train ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{model.can_train ? "Datos suficientes para reentrenar" : `Faltan: ${formatRequiredVariables(model.missing_variables)}`}</span>
            </div>
            <div className="portfolio-route">{active ? text(model.active_route, "ruta productiva") : versionCount ? "Versiones candidatas, ninguna activa" : "Aún no existen versiones"}</div>
          </button>
        )
      })}
    </div>
  )
}

function buildPreviewChartRows(previewRows: Row[], featureNames: string[]) {
  const rowsForChart = previewRows.slice(0, 26)
  return rowsForChart.map((sample, index) => {
    const observed = numberValue(sample.target)
    const previous = rowsForChart[index - 1] ? numberValue(rowsForChart[index - 1].target) : observed
    const next = rowsForChart[index + 1] ? numberValue(rowsForChart[index + 1].target) : observed
    return {
      label: String(index + 1),
      index: numberValue(sample.row_index, index),
      observed,
      trend: (previous + observed + next) / 3,
      [featureNames[0] ?? "feature_1"]: getSampleFeatureValue(sample, featureNames[0] ?? "", 0),
      [featureNames[1] ?? "feature_2"]: getSampleFeatureValue(sample, featureNames[1] ?? "", 1),
    }
  })
}

function getSampleFeatureValue(sample: Row, name: string, index: number) {
  const nestedFeatures = row(sample.features)
  return numberValue(sample[name] ?? nestedFeatures[name] ?? sample[`feature_${index + 1}`] ?? nestedFeatures[`feature_${index + 1}`] ?? 0)
}

function buildPearsonRows(columns: Row[]) {
  const source = columns.filter((column) => text(column.role, "") === "feature")
  const rowsForChart = source.length ? source : defaultVariables.map((name) => ({ name, pearson_score: 0 }))
  return rowsForChart
    .map((column) => {
      const item = row(column)
      return {
        name: text(item.name ?? item.source_variable, "variable"),
        score: Math.abs(numberValue(item.pearson_score)),
      }
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
}

function rowsCountHint(lifecycle: Row, key: string) {
  if (key === "cleaning") return lifecycle.cleaning_enabled ? "ON" : "OFF"
  return "-"
}

function buildTrainingProgressRows(job: Row, isCreating: boolean): Array<{ title: string; value: string; detail: string; kind: StatusKind }> {
  const status = text(job.status, isCreating ? "running" : "pending")
  const hasJob = Boolean(job.job_id) || isCreating
  const hasAsset = Boolean(job.asset_id)
  const hasMetrics = Object.keys(row(job.metrics)).length > 0
  return [
    { title: "Datos", value: text(job.feature_set_id, hasJob ? "asignado" : "pendiente"), detail: "Feature set de entrada", kind: hasJob ? "success" : "warning" },
    { title: "Entrenamiento", value: isCreating ? "corriendo" : status, detail: text(job.model_code, "sin modelo"), kind: isCreating ? "info" : statusKind(status) },
    { title: "Validacion", value: hasMetrics ? "metricas" : "pendiente", detail: hasMetrics ? "MAE / RMSE / R2 publicados" : "esperando salida", kind: hasMetrics ? "success" : "warning" },
    { title: "Artefacto", value: hasAsset ? "creado" : "sin asset", detail: text(job.asset_id, "no publicado"), kind: hasAsset ? "success" : "warning" },
  ]
}

function buildDetailedModelSteps(readiness: Row, featureSet: Row, job: Row, asset: Row, metrics: Row, inferenceCount: number): Array<{ title: string; status: string; detail: string }> {
  const r2 = latestMetric(metrics, "r2")
  const hasMetrics = Object.keys(metrics).length > 0
  return [
    {
      title: "Datos",
      status: readiness.can_train === false ? "warning" : "ready",
      detail: readiness.can_train === false ? `Faltan ${formatRequiredVariables(readiness.missing_variables)}` : `${text(readiness.available_variables, "variables listas")}`,
    },
    {
      title: "Limpieza",
      status: "ready",
      detail: "Corridas versionadas y mediciones limpias persistidas.",
    },
    {
      title: "Features",
      status: featureSet.feature_set_id ? "ready" : "pending",
      detail: text(featureSet.feature_set_id, "Cree feature set para entrenar."),
    },
    {
      title: "Entrenamiento",
      status: text(job.status, "pending"),
      detail: text(job.job_id, "Sin job asociado."),
    },
    {
      title: "Validacion",
      status: !hasMetrics ? "pending" : r2 !== undefined && r2 < 0 ? "warning" : "ready",
      detail: hasMetrics ? `R2 ${formatNumber(r2, 3)} · MAE ${formatNumber(metrics.mae, 4)}` : "Metricas pendientes.",
    },
    {
      title: "Artefacto",
      status: asset.asset_id ? "ready" : "pending",
      detail: text(asset.asset_id, "Sin artefacto versionado."),
    },
    {
      title: "Produccion",
      status: text(asset.status, "pending"),
      detail: text(asset.activated_at, "No activado."),
    },
    {
      title: "Inferencia",
      status: inferenceCount > 0 ? "ready" : asset.asset_id ? "pending" : "warning",
      detail: inferenceCount > 0 ? `${inferenceCount} inferencias ejecutadas en UI.` : "Ejecute prueba guiada con datos reales.",
    },
  ]
}

function formatRequiredVariables(value: unknown) {
  return Array.isArray(value) && value.length ? value.map(String).join(", ") : "Variables segun contrato del modelo."
}

function formatLifecycleDetail(value: unknown) {
  if (value && typeof value === "object") {
    const payload = row(value)
    if (payload.recent_predictions !== undefined) return `${formatNumber(payload.recent_predictions, 0)} inferencias recientes`
    const compact = Object.entries(payload)
      .slice(0, 3)
      .map(([key, item]) => `${key}: ${formatCell(item)}`)
      .join(" · ")
    return compact || "detalle backend"
  }
  return text(value, "detalle pendiente")
}

function metricRows(value: unknown): [string, unknown][] {
  const metrics = row(value)
  const entries = Object.entries(metrics)
  if (!entries.length) return [["Estado", "Sin metricas publicadas"]]
  return entries.slice(0, 6).map(([key, metric]) => [metricLabel(key), metric])
}

function metricLabel(key: string) {
  const labels: Record<string, string> = {
    mse: "MSE",
    rmse: "RMSE",
    mae: "MAE",
    r2: "R2",
    accuracy: "Accuracy",
    inertia: "Inercia",
    explained_variance_ratio_0: "Varianza PC1",
    explained_variance_ratio_total: "Varianza total",
  }
  return labels[key] ?? key
}

function LifecycleStep({ number, title, status, detail }: { number: string; title: string; status: unknown; detail: string }) {
  const kind = statusKind(status)
  return (
    <div className={`lifecycle-step lifecycle-step-${kind}`}>
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <Badge kind={kind}>{text(status, "pendiente")}</Badge>
    </div>
  )
}

function getFeatureNames(asset: Row, metricsData: unknown) {
  const artifactPayload = row(asset.artifact_payload)
  const fromAsset = asset.feature_names ?? artifactPayload.feature_names ?? row(asset.metrics_json).feature_names ?? row(asset.metadata).feature_names
  if (Array.isArray(fromAsset)) return fromAsset.map(String)
  const fromMetrics = row(metricsData).feature_names
  if (Array.isArray(fromMetrics)) return fromMetrics.map(String)
  return ["water_temperature_c", "ph", "nitrate_ion"]
}

function TraceabilityView({ dashboard }: { dashboard: Row }) {
  const jobsQuery = useQuery({ queryKey: ["training-jobs"], queryFn: () => apiGet<unknown>("/ml/training-jobs") })
  const assetsQuery = useQuery({ queryKey: ["model-assets"], queryFn: () => apiGet<unknown>(query("/ml/model-assets", { include_payload: false })) })
  const runs = rows(dashboard.traceability)
  const jobs = rows(jobsQuery.data)
  const assets = rows(assetsQuery.data)
  return (
    <>
      <section className="page-head">
        <h1>TRAZABILIDAD</h1>
        <p>Runs deterministas, training jobs, feature sets y assets versionados en una sola vista.</p>
      </section>
      <ErrorNote error={jobsQuery.error ?? assetsQuery.error} />
      <section className="mlops-grid">
        <div className="studio-card mlops-card">
          <h2>RUNS DE MODELOS</h2>
          <DataTable rows={runs.slice(0, 10)} columns={["run_id", "model_code", "model_version", "status", "source_report"]} />
        </div>
        <div className="studio-card mlops-card">
          <h2>TRAINING JOBS</h2>
          <DataTable rows={jobs.slice(0, 10)} columns={["job_id", "model_code", "feature_set_id", "status", "asset_id", "created_at"]} />
        </div>
        <div className="studio-card mlops-card">
          <h2>MODEL ASSETS</h2>
          <DataTable rows={assets.slice(0, 10)} columns={["asset_id", "model_code", "version", "status", "training_job_id", "activated_at"]} />
        </div>
      </section>
    </>
  )
}

function EventTimeline({ events, pondId }: { events: Row[]; pondId: string }) {
  const fallback = [
    { event_type: "queued", message: "Training job creado." },
    { event_type: "running", message: "Pipeline listo para estanque " + pondId },
  ]
  const source = events.length ? events : fallback
  return (
    <div className="event-list">
      {source.map((event, index) => (
        <div className="event-item" key={`${text(event.event_type)}-${index}`}>
          <span className={`event-dot event-${statusKind(event.event_type)}`} />
          <div>
            <strong>{text(event.event_type)}</strong>
            <p>{text(event.message)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function DataTable({ rows: tableRows, columns, actions }: { rows: Row[]; columns: string[]; actions?: (row: Row) => ReactNode }) {
  const visibleColumns = columns.length ? columns : Object.keys(tableRows[0] ?? {}).slice(0, 6)
  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead>
          <tr>
            {visibleColumns.map((column) => (
              <th key={column}>{column}</th>
            ))}
            {actions ? <th>acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {tableRows.length ? (
            tableRows.map((tableRow, index) => (
              <tr key={text(tableRow.id ?? tableRow.run_id ?? tableRow.job_id ?? tableRow.asset_id ?? index)}>
                {visibleColumns.map((column) => (
                  <td key={column}>{formatCell(tableRow[column])}</td>
                ))}
                {actions ? <td className="table-actions">{actions(tableRow)}</td> : null}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={visibleColumns.length + (actions ? 1 : 0)}>Sin registros disponibles para esta ruta.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(value: unknown) {
  if (typeof value === "boolean") return value ? "Si" : "No"
  if (typeof value === "number") return formatNumber(value, 3)
  if (Array.isArray(value)) return value.join(", ")
  if (value && typeof value === "object") return JSON.stringify(value)
  if (String(value ?? "").match(/^\d{4}-\d{2}-\d{2}T/)) return formatDate(value)
  return text(value)
}

function MetricList({ rows: metricRows }: { rows: [string, unknown][] }) {
  return (
    <div className="info-rows metric-list">
      {metricRows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{formatCell(value)}</strong>
        </div>
      ))}
    </div>
  )
}

function NativeSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="select-box native-wide">
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        {!options.includes("") ? <option value="">Sin seleccionar</option> : null}
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {option || "Todos"}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-line">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function CheckboxGroup({ values, selected, onChange }: { values: string[]; selected: string[]; onChange: (selected: string[]) => void }) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }
  return (
    <div className="checkbox-grid">
      {values.map((value) => (
        <Toggle key={value} label={value} checked={selected.includes(value)} onChange={() => toggle(value)} />
      ))}
    </div>
  )
}

function NumberGrid({ rows: numberRows }: { rows: [string, number, (value: number) => void][] }) {
  return (
    <div className="field-grid">
      {numberRows.map(([label, value, onChange]) => (
        <label className="form-line" key={label}>
          <span>{label}</span>
          <input type="number" value={value} step="any" onChange={(event) => onChange(Number(event.target.value))} />
        </label>
      ))}
    </div>
  )
}
