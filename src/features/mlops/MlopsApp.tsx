import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Code2,
  Cuboid,
  Database,
  Droplet,
  FileJson,
  FlaskConical,
  GitBranch,
  Home,
  Layers3,
  LineChart as LineChartIcon,
  RefreshCcw,
  Rocket,
  Settings,
  Table2,
  Wand2,
  Waves,
  type LucideIcon,
} from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { ViewContext } from "@/App"
import { apiGet, apiPost } from "@/lib/api"
import { pickId, pickName, query, unwrapList, unwrapObject, type Row } from "@/lib/normalize"

type MlopsScreen = "summary" | "data" | "cleaning" | "features" | "training" | "artifacts" | "models" | "traceability"
type StatusKind = "success" | "warning" | "info" | "danger" | "purple" | "neutral"

const defaultPond = "LEGACY-POND-1"
const defaultModel = "ML_SUPERVISED_LINEAR_REG"
const defaultVariables = ["water_temperature_c", "ph", "dissolved_oxygen_mg_l", "nitrate_ion"]

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
          {screen === "summary" ? <SummaryView dashboard={dashboard} dashboardError={dashboardQuery.error} selectedPondId={activePondId} /> : null}
          {screen === "data" ? <DataView selectedPondId={activePondId} /> : null}
          {screen === "cleaning" ? <CleaningView selectedPondId={activePondId} /> : null}
          {screen === "features" ? <FeaturesView selectedPondId={activePondId} /> : null}
          {screen === "training" ? <TrainingView selectedPondId={activePondId} /> : null}
          {screen === "artifacts" ? <ArtifactsView /> : null}
          {screen === "models" ? <ModelLifecycleView selectedPondId={activePondId} /> : null}
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

function SummaryView({ dashboard, dashboardError, selectedPondId }: { dashboard: Row; dashboardError: unknown; selectedPondId: string }) {
  const lifecycleQuery = useQuery({ queryKey: ["ml-lifecycle"], queryFn: () => apiGet<unknown>("/ml/lifecycle/status") })
  const lifecycle = unwrapObject(lifecycleQuery.data ?? dashboard.ml_lifecycle)
  const evidence = row(dashboard.evidence)
  const metrics = row(dashboard.system_metrics)
  const components = row(dashboard.component_summary)
  const projectMap = rows(dashboard.project_map)
  const waterQuality = row(dashboard.water_quality_current)
  const chartData = Object.values(waterQuality)
    .map(row)
    .map((item) => ({ variable: text(item.variable_code), value: numberValue(item.clean_value), unit: text(item.standard_unit) }))
    .filter((item) => item.variable !== "-")

  return (
    <>
      <section className="page-head">
        <h1>RESUMEN OPERATIVO MLOPS</h1>
        <p>Datos, limpieza, features, entrenamiento, artefactos, inferencia y trazabilidad sobre el estanque activo.</p>
      </section>
      <ErrorNote error={dashboardError ?? lifecycleQuery.error} />
      <section className="kpi-grid">
        <Kpi icon={<Database />} label="Sensores" value={text(metrics.sensors, "0")} note="telemetria disponible" />
        <Kpi icon={<Waves />} label="Variables" value={text(metrics.variables, "0")} note="series limpias" color="green" />
        <Kpi icon={<Layers3 />} label="Componentes" value={text(components.total_components, "45")} note={`${text(components.executable_model_runners, "13")} runners API`} color="amber" />
        <Kpi icon={<Brain />} label="Training jobs" value={text(evidence.training_jobs, "0")} note="ciclo ML" color="purple" />
        <Kpi icon={<Boxes />} label="Assets" value={text(evidence.model_assets, "0")} note="artefactos versionados" />
      </section>
      <section className="mlops-grid three">
        <div className="studio-card mlops-card wide">
          <h2>MAPA INTEGRAL DEL PROYECTO</h2>
          <div className="deliverable-grid compact">
            {(projectMap.length ? projectMap : fallbackProjectMap()).map((item, index) => (
              <article className="deliverable-card" key={text(item.title, String(index))}>
                <div className="number-pill">{text(item.order, String(index + 1))}</div>
                <DeliverableIcon index={index} />
                <h3>{text(item.title)}</h3>
                <p>{text(item.backend_status, "ready")}</p>
                <Badge kind={statusKind(item.backend_status ?? item.status)}>{text(item.status, "IMPLEMENTADO")}</Badge>
              </article>
            ))}
          </div>
        </div>
        <div className="studio-card mlops-card">
          <h2>CICLO DE VIDA ML</h2>
          <LifecycleRows lifecycle={lifecycle} />
        </div>
        <div className="studio-card mlops-card">
          <h2>CALIDAD DE AGUA ACTUAL</h2>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chartData}>
              <Bar dataKey="value" fill="#0b7cff" radius={[6, 6, 0, 0]} />
              <XAxis dataKey="variable" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
            </BarChart>
          </ResponsiveContainer>
          <p className="soft">Estanque activo: {selectedPondId}</p>
        </div>
      </section>
    </>
  )
}

function fallbackProjectMap(): Row[] {
  return [
    { order: 1, title: "Contenedor informatico / Arquitectura web", status: "IMPLEMENTADO", backend_status: "ready" },
    { order: 2, title: "Modelos de regresion ML en Python", status: "EN PRUEBA", backend_status: "requires_artifacts" },
    { order: 3, title: "Modelos de arboles de decision", status: "EN PRUEBA", backend_status: "contract_ready" },
    { order: 4, title: "Analisis e interpretacion estadistica", status: "VALIDADO", backend_status: "ready" },
    { order: 5, title: "Modelo matematico de oxigeno disuelto", status: "LISTO", backend_status: "ready" },
    { order: 6, title: "Modelo de crecimiento de peces", status: "LISTO", backend_status: "ready" },
    { order: 7, title: "Gemelo digital aplicado al crecimiento", status: "IMPLEMENTADO", backend_status: "ready" },
  ]
}

function DeliverableIcon({ index }: { index: number }) {
  const icons = [Code2, LineChartIcon, GitBranch, BarChart3, Droplet, Activity, Cuboid]
  const Icon = icons[index % icons.length]
  return <Icon className="deliverable-icon" />
}

function LifecycleRows({ lifecycle }: { lifecycle: Row }) {
  const rowsList = [
    ["datasets_enabled", "Datasets"],
    ["cleaning_enabled", "Limpieza"],
    ["features_enabled", "Features"],
    ["training_enabled", "Entrenamiento"],
    ["model_assets_enabled", "Artefactos"],
  ] as const
  return (
    <div className="check-list">
      {rowsList.map(([key, label]) => {
        const enabled = lifecycle[key] !== false
        return (
          <div key={key}>
            <span>{label}</span>
            <strong>{enabled ? "Habilitado" : "No disponible"}</strong>
            {enabled ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          </div>
        )
      })}
    </div>
  )
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

  return (
    <>
      <section className="page-head">
        <h1>DATOS Y COBERTURA</h1>
        <p>Conecta la data legacy y valida si el estanque tiene variables entrenables suficientes.</p>
      </section>
      <section className="filter-bar mlops-toolbar">
        <button type="button" className="primary-action" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
          <RefreshCcw size={16} /> {syncMutation.isPending ? "Sincronizando" : "Sincronizar legacy"}
        </button>
        <label className="select-box">
          <span>Modelo ML</span>
          <select value={readinessModel} onChange={(event) => setReadinessModel(event.target.value)}>
            {[defaultModel, "BPNN_MEA_FEED_INTAKE", "PEARSON_LSTM_ATTENTION_WQ"].map((model) => (
              <option key={model}>{model}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <JsonButton label="Fuentes dataset" value={sourcesQuery.data} />
      </section>
      <ErrorNote error={sourcesQuery.error ?? coverageQuery.error ?? variablesQuery.error ?? readinessQuery.error ?? syncMutation.error} />
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <h2>READINESS PARA ENTRENAMIENTO</h2>
          <div className="acceptance">
            {readiness.can_train ? <CheckCircle2 /> : <AlertTriangle />}
            <div>
              <strong>{readiness.can_train ? "Dataset entrenable" : "No se puede entrenar todavia"}</strong>
              <span>{Array.isArray(readiness.missing_variables) ? `Faltan: ${readiness.missing_variables.join(", ")}` : "Validacion de variables requeridas"}</span>
            </div>
          </div>
          <MetricList rows={[["Total registros", coverage.total_records], ["Variables entrenables", rows(coverage.trainable_variables).length || text(coverage.trainable_variables, "0")], ["Modelo", readinessModel]]} />
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
  const [applyMinmax, setApplyMinmax] = useState(false)
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

  return (
    <>
      <section className="page-head">
        <h1>LIMPIEZA DE DATOS</h1>
        <p>Ejecuta interpolacion, filtro 3-sigma y normalizacion sobre telemetria real.</p>
      </section>
      <ErrorNote error={variablesQuery.error ?? runsQuery.error ?? summaryQuery.error ?? previewQuery.error ?? createMutation.error} />
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <h2>NUEVO CLEANING RUN</h2>
          <CheckboxGroup values={variables} selected={selectedVariables} onChange={setSelectedVariables} />
          <div className="toggle-grid">
            <Toggle label="Interpolacion" checked={applyInterpolation} onChange={setApplyInterpolation} />
            <Toggle label="Filtro 3-sigma" checked={applySigma3} onChange={setApplySigma3} />
            <Toggle label="MinMax" checked={applyMinmax} onChange={setApplyMinmax} />
            <Toggle label="Sobrescribir clean_measurements" checked={overwriteClean} onChange={setOverwriteClean} />
          </div>
          <button type="button" className="success-action" disabled={!selectedVariables.length || createMutation.isPending} onClick={() => createMutation.mutate()}>
            <FlaskConical size={16} /> {createMutation.isPending ? "Ejecutando" : "Ejecutar limpieza"}
          </button>
        </div>
        <div className="studio-card mlops-card">
          <h2>RUNS Y PREVIEW</h2>
          <NativeSelect label="Cleaning run" value={activeRunId} options={runs.map((run) => text(run.run_id, ""))} onChange={setSelectedRunId} />
          <MetricList rows={[["Run activo", activeRunId], ["Estado", row(summaryQuery.data).status ?? row(runs[0]).status], ["Records in", row(summaryQuery.data).records_in], ["Records out", row(summaryQuery.data).records_out], ["Outliers", row(summaryQuery.data).outliers_detected]]} />
          <DataTable rows={rows(previewQuery.data).slice(0, 8)} columns={["time", "variable_code", "clean_value", "standard_unit", "quality_flag", "validation_status", "cleaning_method"]} />
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
  const featuresQuery = useQuery({ queryKey: ["features"], queryFn: () => apiGet<unknown>("/features") })
  const jobsQuery = useQuery({ queryKey: ["training-jobs"], queryFn: () => apiGet<unknown>("/ml/training-jobs"), refetchInterval: 15_000 })
  const trainable = rows(trainableQuery.data)
  const features = rows(featuresQuery.data)
  const jobs = rows(jobsQuery.data)
  const [modelCode, setModelCode] = useState(defaultModel)
  const [featureSetId, setFeatureSetId] = useState("")
  const [epochs, setEpochs] = useState(400)
  const [learningRate, setLearningRate] = useState("0.0001")
  const [autoActivate, setAutoActivate] = useState(true)
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
    },
  })
  const activeJobId = selectedJobId || text(jobs[0]?.job_id, "")
  const eventsQuery = useQuery({ queryKey: ["training-events", activeJobId], queryFn: () => apiGet<unknown>(`/ml/training-jobs/${activeJobId}/events`), enabled: Boolean(activeJobId), refetchInterval: 10_000 })
  const availableModelCodes = trainable.map((item) => text(item.model_code, "")).filter(Boolean)

  return (
    <>
      <section className="page-head">
        <h1>ENTRENAMIENTO EN VIVO</h1>
        <p>Lanza training jobs desde feature sets versionados y observa eventos del pipeline.</p>
      </section>
      <ErrorNote error={trainableQuery.error ?? featuresQuery.error ?? jobsQuery.error ?? eventsQuery.error ?? createMutation.error} />
      <section className="mlops-grid two">
        <div className="studio-card mlops-card">
          <h2>LANZADOR DE PIPELINE</h2>
          <NativeSelect label="Modelo entrenable" value={modelCode} options={availableModelCodes.length ? availableModelCodes : [defaultModel, "BPNN_MEA_FEED_INTAKE", "PEARSON_LSTM_ATTENTION_WQ"]} onChange={setModelCode} />
          <NativeSelect label="Feature set" value={featureSetId} options={features.map((feature) => text(feature.feature_set_id, ""))} onChange={setFeatureSetId} />
          <NumberGrid rows={[["epochs", epochs, setEpochs]]} />
          <label className="form-line">
            <span>learning_rate</span>
            <input value={learningRate} onChange={(event) => setLearningRate(event.target.value)} />
          </label>
          <Toggle label="Auto activar artefacto" checked={autoActivate} onChange={setAutoActivate} />
          <button type="button" className="success-action" disabled={!modelCode || createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Brain size={16} /> {createMutation.isPending ? "Entrenando" : "Entrenar"}
          </button>
        </div>
        <div className="studio-card mlops-card">
          <h2>JOBS Y EVENTOS</h2>
          <NativeSelect label="Training job" value={activeJobId} options={jobs.map((job) => text(job.job_id, ""))} onChange={setSelectedJobId} />
          <DataTable rows={jobs.slice(0, 6)} columns={["job_id", "model_code", "feature_set_id", "status", "asset_id", "created_at"]} />
          <EventTimeline events={rows(eventsQuery.data)} pondId={selectedPondId} />
        </div>
      </section>
    </>
  )
}

function ArtifactsView() {
  const queryClient = useQueryClient()
  const [modelFilter, setModelFilter] = useState("")
  const assetsQuery = useQuery({
    queryKey: ["model-assets", modelFilter],
    queryFn: () => apiGet<unknown>(query("/ml/model-assets", { model_code: modelFilter || undefined, include_payload: false })),
  })
  const assets = rows(assetsQuery.data)
  const activateMutation = useMutation({
    mutationFn: (assetId: string) => apiPost<unknown>(`/ml/model-assets/${assetId}/activate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["model-assets"] }),
  })
  const deprecateMutation = useMutation({
    mutationFn: (assetId: string) => apiPost<unknown>(`/ml/model-assets/${assetId}/deprecate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["model-assets"] }),
  })
  const modelCodes = Array.from(new Set(assets.map((asset) => text(asset.model_code, "")).filter(Boolean)))

  return (
    <>
      <section className="page-head">
        <h1>ARTEFACTOS DE MODELO</h1>
        <p>Administra versiones entrenadas, activacion productiva y deprecacion controlada.</p>
      </section>
      <ErrorNote error={assetsQuery.error ?? activateMutation.error ?? deprecateMutation.error} />
      <section className="filter-bar mlops-toolbar">
        <NativeSelect label="Modelo" value={modelFilter} options={["", ...modelCodes]} onChange={setModelFilter} />
        <JsonButton label="Assets JSON" value={assetsQuery.data} />
      </section>
      <div className="studio-card mlops-card">
        <DataTable
          rows={assets}
          columns={["asset_id", "model_code", "version", "artifact_format", "feature_set_id", "training_job_id", "status", "created_at", "activated_at"]}
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
  const assetsQuery = useQuery({ queryKey: ["active-assets"], queryFn: () => apiGet<unknown>(query("/ml/model-assets", { status: "active", include_payload: false })), refetchInterval: 30_000 })
  const jobsQuery = useQuery({ queryKey: ["training-jobs"], queryFn: () => apiGet<unknown>("/ml/training-jobs"), refetchInterval: 30_000 })
  const featuresQuery = useQuery({ queryKey: ["features"], queryFn: () => apiGet<unknown>("/features"), refetchInterval: 30_000 })
  const lifecycle = unwrapObject(lifecycleQuery.data)
  const trainable = rows(trainableQuery.data)
  const activeAssets = rows(assetsQuery.data)
  const jobs = rows(jobsQuery.data)
  const featureSets = rows(featuresQuery.data)
  const [selectedModelCode, setSelectedModelCode] = useState(defaultModel)
  const selectedAsset = activeAssets.find((asset) => text(asset.model_code, "") === selectedModelCode) ?? {}
  const selectedTrainable = trainable.find((model) => text(model.model_code, "") === selectedModelCode) ?? {}
  const selectedJob = jobs.find((job) => text(job.job_id, "") === text(selectedAsset.training_job_id, "")) ?? {}
  const featureSetId = text(selectedAsset.feature_set_id, "")
  const previewQuery = useQuery({
    queryKey: ["model-feature-preview", featureSetId],
    queryFn: () => apiGet<unknown>(`/features/${featureSetId}/preview`),
    enabled: Boolean(featureSetId),
  })
  const featureNames = getFeatureNames(selectedAsset, selectedAsset.metrics_json)
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({})
  const predictMutation = useMutation({
    mutationFn: () =>
      apiPost<unknown>(`/models/${selectedModelCode}/predict`, {
        features: Object.fromEntries(featureNames.map((name) => [name, Number(featureValues[name] ?? 0)])),
      }),
  })
  const modelsToShow = mergeModelRows(trainable, activeAssets)
  const activeCount = activeAssets.length

  useEffect(() => {
    if (activeAssets.length && !activeAssets.some((asset) => text(asset.model_code, "") === selectedModelCode)) {
      setSelectedModelCode(text(activeAssets[0].model_code, defaultModel))
    }
  }, [activeAssets, selectedModelCode])

  const loadSample = () => {
    const sample = row(rows(previewQuery.data)[0])
    if (!Object.keys(sample).length) return
    setFeatureValues((current) => {
      const next = { ...current }
      featureNames.forEach((name) => {
        next[name] = text(sample[name], "0")
      })
      return next
    })
  }

  return (
    <>
      <section className="page-head model-page-head">
        <div>
          <h1>MODELOS ML EN OPERACION</h1>
          <p>Ciclo completo por modelo: datos, limpieza, preparacion, entrenamiento, artefacto activo, inferencia y trazabilidad. Estanque activo: {selectedPondId}.</p>
        </div>
        <div className="institution-lockup">INICTEL-UNI · PROCIENCIA</div>
      </section>
      <ErrorNote error={lifecycleQuery.error ?? trainableQuery.error ?? assetsQuery.error ?? jobsQuery.error ?? featuresQuery.error ?? previewQuery.error ?? predictMutation.error} />
      <section className="kpi-grid lifecycle-kpis">
        <Kpi icon={<Database />} label="Limpiezas" value={text(lifecycle.cleaning_enabled ? rowsCountHint(lifecycle, "cleaning") : "0")} note="datos trazables" />
        <Kpi icon={<Table2 />} label="Feature sets" value={text(lifecycle.total_feature_sets, "0")} note={`${featureSets.length} listados`} color="green" />
        <Kpi icon={<Brain />} label="Entrenamientos" value={text(lifecycle.total_training_jobs, "0")} note="jobs registrados" color="purple" />
        <Kpi icon={<Boxes />} label="Activos" value={String(activeCount)} note="modelos productivos" color="amber" />
        <Kpi icon={<Rocket />} label="Inferencia" value={text(lifecycle.model_assets_enabled ? "ON" : "OFF")} note="con trazabilidad" />
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
            <div className="lifecycle-steps">
              <LifecycleStep number="1" title="Datos" status={selectedTrainable.required_variables ? "ready" : "pending"} detail={formatRequiredVariables(selectedTrainable.required_variables)} />
              <LifecycleStep number="2" title="Limpieza" status="ready" detail="Datos versionados por cleaning run." />
              <LifecycleStep number="3" title="Preparacion" status={featureSetId ? "ready" : "pending"} detail={featureSetId || "Cree un feature set para este modelo."} />
              <LifecycleStep number="4" title="Entrenamiento" status={selectedJob.status ?? selectedAsset.training_job_id} detail={text(selectedAsset.training_job_id, "Sin job asociado")} />
              <LifecycleStep number="5" title="Produccion" status={selectedAsset.status} detail={text(selectedAsset.asset_id, "Sin asset activo")} />
            </div>
            <section className="model-info-grid">
              <div>
                <h3>Metricas del modelo</h3>
                <MetricList rows={metricRows(selectedAsset.metrics_json ?? selectedJob.metrics)} />
              </div>
              <div>
                <h3>Trazabilidad del artefacto</h3>
                <MetricList rows={[["Version", selectedAsset.version], ["Feature set", selectedAsset.feature_set_id], ["Training job", selectedAsset.training_job_id], ["Activado", selectedAsset.activated_at]]} />
              </div>
            </section>
          </section>
          <section className="studio-card mlops-card model-detail-card">
            <div className="card-head">
              <div>
                <h2>INFERENCIA GUIADA</h2>
                <p className="soft">Use una muestra real del feature set o escriba valores manuales.</p>
              </div>
              <button type="button" className="mini-btn mini-btn-primary" disabled={!featureSetId || !rows(previewQuery.data).length} onClick={loadSample}>
                Cargar muestra
              </button>
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

function rowsCountHint(lifecycle: Row, key: string) {
  if (key === "cleaning") return lifecycle.cleaning_enabled ? "ON" : "OFF"
  return "-"
}

function formatRequiredVariables(value: unknown) {
  return Array.isArray(value) && value.length ? value.map(String).join(", ") : "Variables segun contrato del modelo."
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
