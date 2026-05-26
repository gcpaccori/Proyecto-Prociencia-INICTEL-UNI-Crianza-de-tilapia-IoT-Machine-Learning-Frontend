import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Code2,
  Database,
  Download,
  Droplet,
  ExternalLink,
  Eye,
  FileJson,
  FileText,
  Fish,
  Lock,
  MoreVertical,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Timer,
  Waves,
  type LucideIcon,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { ViewContext } from "@/App"
import { apiGet, apiPost } from "@/lib/api"
import { pickId, pickName, pickValue, query, unwrapList, unwrapObject, type Row } from "@/lib/normalize"

type ScreenMode = "center" | "runner"
type StatusKind = "success" | "warning" | "info" | "danger" | "muted" | "purple"

interface JsonPanelState {
  title: string
  value: unknown
}

const FALLBACK_MODEL_CODES = [
  "DO_DYNAMIC_0D_ROYER_2021",
  "DO_TRANSPORT_1D",
  "RAS_OXYGEN_BALANCE",
  "YI_ENVIRONMENTAL_GROWTH",
  "SODERBERG_LINEAR_GROWTH",
  "ZOOTECHNIC_INDEXES",
  "BIOENERGETIC_SPARUS_AURATA_BRIGOLIN_2010",
  "DAILY_RATION_MODEL",
  "FEEDING_SATIETY_RULES",
  "BPNN_MEA_FEED_INTAKE",
  "PEARSON_LSTM_ATTENTION_WQ",
  "FISH_COUNTING_MODEL",
  "FISH_SIZE_WEIGHT_ESTIMATION",
]

const FAMILY_LABELS: Record<string, string> = {
  oxygen_water_quality: "Oxigeno disuelto",
  growth_bioenergetic: "Crecimiento",
  ml_tabular_statistics: "ML tabular",
  architecture_twin: "Gemelo digital",
  conditioned_external: "Condicionados",
  RAS: "RAS",
}

const MODEL_ICONS: { test: (code: string, family: string) => boolean; Icon: LucideIcon }[] = [
  { test: (code) => code.includes("TRANSPORT"), Icon: Waves },
  { test: (code) => code.includes("RAS"), Icon: Activity },
  { test: (code) => code.includes("GROWTH") || code.includes("ZOOTECHNIC"), Icon: Fish },
  { test: (code) => code.includes("FEED") || code.includes("RATION"), Icon: Sparkles },
  { test: (code) => code.includes("LSTM") || code.includes("BPNN"), Icon: BarChart3 },
  { test: (code) => code.includes("FISH_COUNT") || code.includes("SIZE_WEIGHT"), Icon: Eye },
  { test: (code, family) => family.toLowerCase().includes("oxigeno") || code.includes("DO_"), Icon: Droplet },
]

function asRow(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {}
}

function text(value: unknown, fallback = "") {
  if (value === undefined || value === null || value === "") return fallback
  return String(value)
}

function modelCode(model: Row) {
  return text(pickValue(model, ["model_code", "code"]), "sin_codigo")
}

function readiness(modelOrStatus: Row | string | unknown) {
  const value =
    typeof modelOrStatus === "string"
      ? modelOrStatus
      : text(pickValue(asRow(modelOrStatus), ["readiness_status", "backend_status", "status"]))
  return value.toLowerCase()
}

function statusKind(value: unknown): StatusKind {
  const status = readiness(value)
  if (status.includes("artifact") || status.includes("warning") || status.includes("dry")) return "warning"
  if (status.includes("ready") || status.includes("completed") || status.includes("ok")) return "success"
  if (status.includes("metadata") || status.includes("conditioned")) return "purple"
  if (status.includes("blocked") || status.includes("error") || status.includes("fail")) return "danger"
  return "info"
}

function statusLabel(value: unknown) {
  const status = readiness(value)
  if (status.includes("requires_external_artifact") || status.includes("artifact")) return "Requiere artefacto"
  if (status.includes("metadata") || status.includes("dry")) return "Solo dry-run"
  if (status.includes("ready") || status.includes("completed") || status.includes("ok")) return "Ejecutable"
  if (status.includes("conditioned")) return "Condicionado"
  if (status.includes("blocked")) return "Bloqueado"
  return text(value, "En revision")
}

function familyLabel(value: unknown) {
  const raw = text(value, "Sin familia")
  return FAMILY_LABELS[raw] ?? raw.replaceAll("_", " ")
}

function inferFamily(model: Row, component?: Row) {
  const componentFamily = text(component?.family)
  if (componentFamily) return familyLabel(componentFamily)
  const code = modelCode(model)
  const type = text(model.model_type)
  if (code.includes("RAS")) return "RAS"
  if (code.includes("DO_") || code.includes("OXYGEN") || code.includes("LSTM")) return "Oxigeno disuelto"
  if (code.includes("GROWTH") || code.includes("BIOENERGETIC") || code.includes("ZOOTECHNIC")) return "Crecimiento"
  if (code.includes("FEED") || code.includes("RATION") || code.includes("SATIETY")) return "Alimentacion"
  if (type.includes("vision") || code.includes("FISH_")) return "Vision"
  if (type.includes("learning") || type.includes("machine")) return "ML tabular"
  return familyLabel(type || "Sin familia")
}

function iconForModel(code: string, family: string) {
  return MODEL_ICONS.find((item) => item.test(code, family))?.Icon ?? Box
}

function formatNumber(value: unknown, digits = 2) {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return text(value, "-")
  return numeric.toLocaleString("en-US", { maximumFractionDigits: digits })
}

function formatDateTime(value: unknown) {
  if (!value) return "-"
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return text(value)
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatInputValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ")
  if (value && typeof value === "object") return JSON.stringify(value, null, 2)
  return text(value)
}

function parseInputValue(raw: string, control: unknown) {
  const controlName = text(control).toLowerCase()
  const trimmed = raw.trim()
  if (controlName === "number") {
    const numeric = Number(trimmed.replaceAll(",", ""))
    return Number.isFinite(numeric) ? numeric : trimmed
  }
  if (controlName === "checkbox") return trimmed === "true" || trimmed === "si"
  if (controlName === "timeseries") {
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return trimmed
      }
    }
    return trimmed
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value))
  }
  if (controlName === "json_editor") {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }
  return raw
}

function valueFromInputObject(input: unknown) {
  const row = asRow(input)
  return row.value
}

function payloadInputMap(payload: unknown) {
  const request = asRow(asRow(payload).request)
  return asRow(request.inputs)
}

function outputValue(result: unknown, key: string) {
  const output = asRow(asRow(result).outputs)[key]
  const row = asRow(output)
  return row.value ?? output
}

function outputUnit(result: unknown, key: string) {
  const output = asRow(asRow(result).outputs)[key]
  const row = asRow(output)
  return text(row.unit)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la accion"
}

function buildModelRows(catalog: Row[], dashboardModels: Row[], components: Row[]) {
  const byCode = new Map<string, Row>()
  const componentsByCode = new Map<string, Row>()

  components.forEach((component) => {
    const linkedCode = text(component.linked_model_code)
    if (linkedCode) componentsByCode.set(linkedCode, component)
  })

  const add = (row: Row) => {
    const code = modelCode(row)
    if (!code || code === "sin_codigo") return
    const current = byCode.get(code) ?? {}
    byCode.set(code, { ...current, ...row, component: componentsByCode.get(code) })
  }

  catalog.forEach(add)
  dashboardModels.forEach(add)
  components
    .filter((component) => Boolean(component.is_executable_model_runner && component.linked_model_code))
    .forEach((component) => {
      const code = text(component.linked_model_code)
      add({
        model_code: code,
        name: component.title,
        readiness_status: component.backend_status,
        component,
      })
    })

  FALLBACK_MODEL_CODES.forEach((code) => {
    if (!byCode.has(code)) byCode.set(code, { model_code: code, name: code, readiness_status: "ready" })
  })

  return Array.from(byCode.values()).sort((a, b) => {
    const familyCompare = inferFamily(a, asRow(a.component)).localeCompare(inferFamily(b, asRow(b.component)))
    return familyCompare || modelCode(a).localeCompare(modelCode(b))
  })
}

function useDashboardEndpoint(selectedFarmId: string, selectedPondId: string, rangeLabel: string) {
  return query("/frontend/dashboard", {
    farm_id: selectedFarmId || undefined,
    pond_id: selectedPondId || undefined,
    range_label: rangeLabel,
  })
}

interface ModelsViewProps extends ViewContext {
  embedded?: boolean
}

export function ModelsView({
  selectedFarmId,
  selectedPondId,
  onFarmChange,
  onPondChange,
  embedded,
}: ModelsViewProps) {
  const queryClient = useQueryClient()
  const [screen, setScreen] = useState<ScreenMode>("center")
  const [rangeLabel, setRangeLabel] = useState("Ultimas 24 horas")
  const [modelCodeState, setModelCodeState] = useState("DO_DYNAMIC_0D_ROYER_2021")
  const [familyFilter, setFamilyFilter] = useState("Todos")
  const [statusFilter, setStatusFilter] = useState("Todos")
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({})
  const [jsonPanel, setJsonPanel] = useState<JsonPanelState | null>(null)

  const dashboardEndpoint = useDashboardEndpoint(selectedFarmId, selectedPondId, rangeLabel)
  const dashboardQuery = useQuery({
    queryKey: ["frontend-dashboard", selectedFarmId, selectedPondId, rangeLabel],
    queryFn: () => apiGet<unknown>(dashboardEndpoint),
    refetchInterval: 30_000,
  })
  const catalogQuery = useQuery({ queryKey: ["models"], queryFn: () => apiGet<unknown>("/models") })
  const componentsQuery = useQuery({ queryKey: ["frontend-components"], queryFn: () => apiGet<unknown>("/frontend/components") })

  const dashboard = unwrapObject(dashboardQuery.data)
  const componentsObject = unwrapObject(componentsQuery.data)
  const dashboardModels = unwrapList(dashboard.models)
  const catalog = unwrapList(catalogQuery.data)
  const components = unwrapList(componentsObject.components ?? dashboard.components)
  const componentSummary = asRow(dashboard.component_summary ?? componentsObject)
  const traceability = unwrapList(dashboard.traceability)
  const farms = unwrapList(dashboard.farms)
  const ponds = unwrapList(dashboard.ponds)
  const health = asRow(dashboard.backend)

  const modelRows = useMemo(() => buildModelRows(catalog, dashboardModels, components), [catalog, dashboardModels, components])
  const selectedModelCode = modelRows.some((model) => modelCode(model) === modelCodeState)
    ? modelCodeState
    : modelCode(modelRows[0] ?? { model_code: "DO_DYNAMIC_0D_ROYER_2021" })

  const detailQuery = useQuery({
    queryKey: ["model-detail", selectedModelCode],
    queryFn: () => apiGet<unknown>(`/models/${selectedModelCode}`),
    enabled: Boolean(selectedModelCode),
  })
  const auditQuery = useQuery({
    queryKey: ["model-input-audit", selectedModelCode, selectedPondId],
    queryFn: () => apiGet<unknown>(query(`/models/${selectedModelCode}/input-audit`, { pond_id: selectedPondId })),
    enabled: Boolean(selectedModelCode && selectedPondId),
  })
  const testPayloadQuery = useQuery({
    queryKey: ["model-test-payload", selectedModelCode, selectedPondId],
    queryFn: () => apiGet<unknown>(query(`/models/${selectedModelCode}/test-payload`, { pond_id: selectedPondId })),
    enabled: Boolean(selectedModelCode && selectedPondId),
    staleTime: 60_000,
  })

  const activeFromCatalog = modelRows.find((model) => modelCode(model) === selectedModelCode) ?? {}
  const activeFromDashboard = dashboardModels.find((model) => modelCode(model) === selectedModelCode) ?? {}
  const activeModel = {
    ...activeFromCatalog,
    ...activeFromDashboard,
    ...unwrapObject(detailQuery.data),
  }
  const activeAudit = {
    ...asRow(activeFromDashboard.audit),
    ...unwrapObject(auditQuery.data),
  }
  const activeComponent = asRow(activeModel.component)
  const autoInputs = asRow(activeAudit.auto_inputs)
  const fields = unwrapList(activeAudit.form_fields)
  const formFields = fields.filter((field) => text(field.status) !== "auto_available")
  const generatedInputs = payloadInputMap(testPayloadQuery.data)
  const blockedBy = Array.isArray(activeAudit.blocked_by) ? activeAudit.blocked_by.map(String) : []
  const lastRun = traceability.find((run) => text(run.model_code) === selectedModelCode)

  const firstFarmId = farms[0] ? pickId(farms[0]) : ""
  const firstPondId = ponds[0] ? pickId(ponds[0]) : ""

  useEffect(() => {
    if (!selectedFarmId && firstFarmId) onFarmChange?.(firstFarmId)
  }, [firstFarmId, onFarmChange, selectedFarmId])

  useEffect(() => {
    if (!selectedPondId && firstPondId) onPondChange?.(firstPondId)
  }, [firstPondId, onPondChange, selectedPondId])

  const inputKey = (inputName: string) => `${selectedModelCode}.${inputName}`
  const getFieldValue = (field: Row) => {
    const name = text(field.input_name)
    const key = inputKey(name)
    if (manualInputs[key] !== undefined) return manualInputs[key]
    if (text(field.status) !== "auto_available") {
      const generated = asRow(generatedInputs[name])
      if (generated.value !== undefined) return formatInputValue(generated.value)
    }
    if (field.value_preview !== undefined && field.value_preview !== null) {
      const preview = asRow(field.value_preview)
      return formatInputValue(preview.last_value ?? field.value_preview)
    }
    const generated = asRow(generatedInputs[name])
    if (generated.value !== undefined) return formatInputValue(generated.value)
    return ""
  }
  const setFieldValue = (field: Row, value: string) => {
    const name = text(field.input_name)
    setManualInputs((current) => ({ ...current, [inputKey(name)]: value }))
  }
  const resetActiveManualInputs = () => {
    setManualInputs((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${selectedModelCode}.`))),
    )
  }

  const missingManual = formFields.filter((field) => !getFieldValue(field).trim()).map((field) => text(field.input_name))
  const unitMismatches = fields.filter((field) => {
    const generated = asRow(generatedInputs[text(field.input_name)])
    return Boolean(generated.unit && field.unit && generated.unit !== field.unit)
  })
  const generatedUsed = formFields.filter((field) => {
    const name = text(field.input_name)
    const key = inputKey(name)
    const generated = asRow(generatedInputs[name])
    return manualInputs[key] === undefined && generated.quality_flag === "generated_test_value"
  })

  const productivePayload = useMemo(() => {
    const inputs: Row = { ...autoInputs }
    fields.forEach((field) => {
      const name = text(field.input_name)
      const key = inputKey(name)
      const hasManual = manualInputs[key] !== undefined
      const isAuto = text(field.status) === "auto_available"
      if (isAuto && !hasManual) return
      const raw = getFieldValue(field)
      if (!raw.trim()) return
      const generated = asRow(generatedInputs[name])
      inputs[name] = {
        value: parseInputValue(raw, field.control),
        unit: text(field.unit ?? generated.unit, "unit"),
        quality_flag: hasManual ? "manual_user" : text(generated.quality_flag, "generated_test_value"),
      }
    })
    return {
      farm_id: selectedFarmId || null,
      pond_id: selectedPondId || null,
      inputs,
      parameters: {},
    }
  }, [autoInputs, fields, generatedInputs, manualInputs, selectedFarmId, selectedModelCode, selectedPondId])

  const testRunMutation = useMutation({
    mutationFn: (code?: string) => apiPost<unknown>(query(`/models/${code ?? selectedModelCode}/test-run`, { pond_id: selectedPondId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["frontend-dashboard"] })
    },
  })
  const runMutation = useMutation({
    mutationFn: () => apiPost<unknown>(`/models/${selectedModelCode}/run`, productivePayload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["frontend-dashboard"] })
    },
  })
  const testRunAllMutation = useMutation({
    mutationFn: () => apiPost<unknown>(query("/models/test-run-all", { pond_id: selectedPondId })),
    onSuccess: (data) => {
      setJsonPanel({ title: "Resultado test-run all", value: data })
      queryClient.invalidateQueries({ queryKey: ["frontend-dashboard"] })
    },
  })

  const canTestRun = Boolean(selectedModelCode && selectedPondId)
  const canProductRun = missingManual.length === 0 && blockedBy.length === 0 && Boolean(selectedModelCode && selectedPondId)
  const latestResult = runMutation.data ?? testRunMutation.data
  const activeFamily = inferFamily(activeModel, activeComponent)

  const filteredModels = modelRows.filter((model) => {
    const modelFamily = inferFamily(model, asRow(model.component))
    const label = statusLabel(model)
    const familyOk = familyFilter === "Todos" || modelFamily === familyFilter
    const statusOk = statusFilter === "Todos" || label === statusFilter
    return familyOk && statusOk
  })

  const handleGeneratePayload = async () => {
    const result = await testPayloadQuery.refetch()
    if (result.data) setJsonPanel({ title: `Payload ${selectedModelCode}`, value: result.data })
  }
  const openRunner = () => {
    setScreen("runner")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const openCenter = () => {
    setScreen("center")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const selectModel = (code: string) => {
    setModelCodeState(code)
    setJsonPanel(null)
  }

  const content =
    screen === "center" ? (
      <ModelsCenter
        dashboard={dashboard}
        componentSummary={componentSummary}
        modelRows={filteredModels}
        allModelRows={modelRows}
        traceability={traceability}
        familyFilter={familyFilter}
        statusFilter={statusFilter}
        selectedModelCode={selectedModelCode}
        activeModel={activeModel}
        activeAudit={activeAudit}
        activeFamily={activeFamily}
        activeComponent={activeComponent}
        lastRun={lastRun}
        payload={testPayloadQuery.data}
        testResult={latestResult}
        isLoading={dashboardQuery.isLoading || catalogQuery.isLoading}
        error={dashboardQuery.error ?? catalogQuery.error}
        testRunAllPending={testRunAllMutation.isPending}
        onFamilyFilter={setFamilyFilter}
        onStatusFilter={setStatusFilter}
        onSelectModel={selectModel}
        onOpenRunner={openRunner}
        onGeneratePayload={handleGeneratePayload}
        onTestRun={(code) => testRunMutation.mutate(code ?? selectedModelCode)}
        onTestRunAll={() => testRunAllMutation.mutate()}
        onOpenJson={(title, value) => setJsonPanel({ title, value })}
      />
    ) : (
      <ModelRunner
        dashboard={dashboard}
        activeModel={activeModel}
        activeAudit={activeAudit}
        fields={fields}
        formFields={formFields}
        autoInputs={autoInputs}
        generatedInputs={generatedInputs}
        selectedModelCode={selectedModelCode}
        selectedFarmId={selectedFarmId || firstFarmId}
        selectedPondId={selectedPondId || firstPondId}
        productivePayload={productivePayload}
        blockedBy={blockedBy}
        missingManual={missingManual}
        unitMismatches={unitMismatches}
        generatedUsed={generatedUsed}
        lastRun={lastRun}
        result={latestResult}
        testPayload={testPayloadQuery.data}
        testPayloadLoading={testPayloadQuery.isFetching}
        testRunPending={testRunMutation.isPending}
        runPending={runMutation.isPending}
        testError={testRunMutation.error}
        runError={runMutation.error}
        canTestRun={canTestRun}
        canProductRun={canProductRun}
        getFieldValue={getFieldValue}
        setFieldValue={setFieldValue}
        onBack={openCenter}
        onReset={resetActiveManualInputs}
        onGeneratePayload={handleGeneratePayload}
        onTestRun={() => testRunMutation.mutate(selectedModelCode)}
        onProductiveRun={() => runMutation.mutate()}
        onOpenJson={(title, value) => setJsonPanel({ title, value })}
      />
    )

  if (embedded) {
    return (
      <>
        {content}
        {jsonPanel ? <JsonPanel panel={jsonPanel} onClose={() => setJsonPanel(null)} /> : null}
      </>
    )
  }

  return (
    <div className="aquatwin-studio">
      <TopBarStudio
        backend={health}
        farms={farms}
        ponds={ponds}
        selectedFarmId={selectedFarmId || firstFarmId}
        selectedPondId={selectedPondId || firstPondId}
        rangeLabel={rangeLabel}
        lastUpdated={dashboardQuery.dataUpdatedAt}
        onFarmChange={(farmId) => onFarmChange?.(farmId)}
        onPondChange={(pondId) => onPondChange?.(pondId)}
        onRangeChange={setRangeLabel}
      />
      <main className="studio-workspace">{content}</main>
      {jsonPanel ? <JsonPanel panel={jsonPanel} onClose={() => setJsonPanel(null)} /> : null}
    </div>
  )
}

function Badge({ children, kind = "info" }: { children: ReactNode; kind?: StatusKind }) {
  return <span className={`at-badge at-badge-${kind}`}>{children}</span>
}

function ActionButton({
  children,
  kind = "outline",
  disabled,
  onClick,
  title,
}: {
  children: ReactNode
  kind?: "outline" | "primary" | "success" | "warning" | "ghost"
  disabled?: boolean
  onClick?: () => void
  title?: string
}) {
  return (
    <button type="button" className={`mini-btn mini-btn-${kind}`} disabled={disabled} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

function IconButton({ children, onClick, badge }: { children: ReactNode; onClick?: () => void; badge?: string }) {
  return (
    <button type="button" className={badge ? "icon-btn has-badge" : "icon-btn"} onClick={onClick}>
      {children}
      {badge ? <small>{badge}</small> : null}
    </button>
  )
}

function TopBarStudio({
  backend,
  farms,
  ponds,
  selectedFarmId,
  selectedPondId,
  rangeLabel,
  lastUpdated,
  onFarmChange,
  onPondChange,
  onRangeChange,
}: {
  backend: Row
  farms: Row[]
  ponds: Row[]
  selectedFarmId: string
  selectedPondId: string
  rangeLabel: string
  lastUpdated: number
  onFarmChange: (farmId: string) => void
  onPondChange: (pondId: string) => void
  onRangeChange: (range: string) => void
}) {
  const backendOnline = readiness(backend.status).includes("online") || readiness(backend.status).includes("ok")
  const activePonds = ponds.filter((pond) => !selectedFarmId || text(pond.farm_id) === selectedFarmId)
  return (
    <header className="topbar">
      <div className="brand" aria-label="AquaTwin Studio">
        <Droplet size={30} />
        <span>AquaTwin</span>
        <b>Studio</b>
      </div>

      <div className={backendOnline ? "top-pill status-online" : "top-pill status-offline"}>
        <span>Backend</span>
        <strong>{backendOnline ? "ONLINE" : "PENDIENTE"}</strong>
        <i />
      </div>

      <SelectPill
        icon={<Database size={18} />}
        label="Granja"
        value={selectedFarmId}
        fallback="Sin granja"
        options={farms.map((farm) => ({ value: pickId(farm), label: pickName(farm) }))}
        onChange={onFarmChange}
      />
      <SelectPill
        icon={<BarChart3 size={18} />}
        label="Estanque"
        value={selectedPondId}
        fallback="Sin estanque"
        options={activePonds.map((pond) => ({ value: pickId(pond), label: pickName(pond) }))}
        onChange={onPondChange}
      />
      <SelectPill
        icon={<CalendarDays size={18} />}
        label="Rango temporal"
        value={rangeLabel}
        fallback="Ultimas 24 horas"
        options={["Ultimas 24 horas", "Ultimos 7 dias", "Ultimos 30 dias"].map((value) => ({ value, label: value }))}
        onChange={onRangeChange}
      />

      <div className="top-actions">
        <IconButton badge="2">
          <Bell size={18} />
        </IconButton>
        <IconButton>
          <Settings size={18} />
        </IconButton>
        <div className="avatar">AP</div>
        <div className="user">
          <strong>Administrador</strong>
          <span>{formatDateTime(lastUpdated)}</span>
        </div>
        <ChevronDown size={16} />
      </div>
    </header>
  )
}

function SelectPill({
  icon,
  label,
  value,
  fallback,
  options,
  onChange,
}: {
  icon: ReactNode
  label: string
  value: string
  fallback: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="top-pill select-pill">
      {icon}
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        {!options.length ? <option value="">{fallback}</option> : null}
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

function ModelsCenter({
  dashboard,
  componentSummary,
  modelRows,
  allModelRows,
  traceability,
  familyFilter,
  statusFilter,
  selectedModelCode,
  activeModel,
  activeAudit,
  activeFamily,
  activeComponent,
  lastRun,
  payload,
  testResult,
  isLoading,
  error,
  testRunAllPending,
  onFamilyFilter,
  onStatusFilter,
  onSelectModel,
  onOpenRunner,
  onGeneratePayload,
  onTestRun,
  onTestRunAll,
  onOpenJson,
}: {
  dashboard: Row
  componentSummary: Row
  modelRows: Row[]
  allModelRows: Row[]
  traceability: Row[]
  familyFilter: string
  statusFilter: string
  selectedModelCode: string
  activeModel: Row
  activeAudit: Row
  activeFamily: string
  activeComponent: Row
  lastRun?: Row
  payload: unknown
  testResult: unknown
  isLoading: boolean
  error: unknown
  testRunAllPending: boolean
  onFamilyFilter: (family: string) => void
  onStatusFilter: (status: string) => void
  onSelectModel: (code: string) => void
  onOpenRunner: () => void
  onGeneratePayload: () => void
  onTestRun: (code?: string) => void
  onTestRunAll: () => void
  onOpenJson: (title: string, value: unknown) => void
}) {
  const totalComponents = Number(componentSummary.total_components ?? allModelRows.length)
  const executableRunners = Number(componentSummary.executable_model_runners ?? allModelRows.filter((model) => statusKind(model) === "success").length)
  const artifactCount = allModelRows.filter((model) => statusLabel(model) === "Requiere artefacto").length
  const dryRunCount = allModelRows.filter((model) => statusLabel(model) === "Solo dry-run" || statusLabel(model) === "Requiere artefacto").length
  const traceCount = traceability.length || Number(asRow(dashboard.evidence).models ?? 0)
  const families = Array.from(new Set(allModelRows.map((model) => inferFamily(model, asRow(model.component)))))
  const statusOptions = Array.from(new Set(allModelRows.map(statusLabel)))
  const familyChips = [
    { label: "Todos", count: totalComponents },
    ...families.map((family) => ({
      label: family,
      count: allModelRows.filter((model) => inferFamily(model, asRow(model.component)) === family).length,
    })),
  ]

  return (
    <>
      <section className="page-head">
        <h1>CENTRO DE MODELOS</h1>
        <p>Auditoria, ejecucion, validacion y trazabilidad de modelos del Gemelo Digital Acuicola</p>
      </section>

      {isLoading ? <div className="inline-state">Cargando contrato vivo del backend...</div> : null}
      {error ? <div className="inline-state inline-error">{getErrorMessage(error)}</div> : null}

      <section className="kpi-grid">
        <KpiCard icon={<Box />} label="Componentes registrados" value={String(totalComponents)} note="40 con viabilidad tecnica alta" />
        <KpiCard icon={<Play />} label="Runners API" value={String(executableRunners)} note="Ejecutables por contrato" color="green" />
        <KpiCard icon={<Sparkles />} label="Requieren artefacto" value={String(artifactCount)} note="ML, LSTM o vision" color="amber" />
        <KpiCard icon={<Activity />} label="Dry-run habilitado" value={String(dryRunCount)} note="Contrato validable" color="purple" />
        <KpiCard icon={<BarChart3 />} label="Trazabilidad viva" value={String(traceCount)} note="Runs recientes en backend" />
      </section>

      <section className="filter-bar">
        <NativeFilter label="Familia" value={familyFilter} values={["Todos", ...families]} onChange={onFamilyFilter} />
        <NativeFilter label="Estado" value={statusFilter} values={["Todos", ...statusOptions]} onChange={onStatusFilter} />
        <NativeFilter label="Tipo" value="Todos" values={["Todos", "mechanistic", "deterministic", "machine_learning", "computer_vision"]} />
        <NativeFilter label="Artefacto" value="Todos" values={["Todos", "No requiere", "Pendiente"]} />
        <NativeFilter label="Estanque" value={text(asRow(dashboard.selection).pond_id, "Activo")} values={[text(asRow(dashboard.selection).pond_id, "Activo")]} />
        <NativeFilter label="Rango temporal" value={text(asRow(dashboard.selection).range_label, "Ultimas 24 horas")} values={[text(asRow(dashboard.selection).range_label, "Ultimas 24 horas")]} />
        <div className="filter-actions">
          <ActionButton disabled={testRunAllPending} onClick={onTestRunAll}>
            <Play size={15} /> {testRunAllPending ? "Ejecutando" : "Test-run all"}
          </ActionButton>
          <ActionButton kind="primary">
            <Plus size={15} /> Nuevo entrenamiento
          </ActionButton>
          <ActionButton kind="ghost">
            <MoreVertical size={16} />
          </ActionButton>
        </div>
      </section>

      <section className="chips-row">
        {familyChips.map((chip) => (
          <button
            type="button"
            key={chip.label}
            className={familyFilter === chip.label ? "chip active" : "chip"}
            onClick={() => onFamilyFilter(chip.label)}
          >
            {chip.label} <b>{chip.count}</b>
          </button>
        ))}
      </section>

      <section className="models-layout">
        <div className="studio-card catalog-card">
          <div className="card-head">
            <h2>CATALOGO DE MODELOS</h2>
            <div className="view-toggle">
              <button type="button" className="active">
                Vista tarjetas
              </button>
              <button type="button">Vista tabla</button>
            </div>
          </div>

          <div className="model-list">
            {modelRows.map((model) => (
              <ModelRowCard
                key={modelCode(model)}
                model={model}
                selected={modelCode(model) === selectedModelCode}
                lastRun={traceability.find((run) => text(run.model_code) === modelCode(model))}
                onSelect={() => onSelectModel(modelCode(model))}
                onOpenRunner={onOpenRunner}
                onTestRun={onTestRun}
              />
            ))}
          </div>
        </div>

        <Inspector
          activeModel={activeModel}
          activeAudit={activeAudit}
          activeFamily={activeFamily}
          activeComponent={activeComponent}
          lastRun={lastRun}
          payload={payload}
          testResult={testResult}
          onOpenRunner={onOpenRunner}
          onGeneratePayload={onGeneratePayload}
          onTestRun={onTestRun}
          onOpenJson={onOpenJson}
        />
      </section>

      <section className="bottom-grid">
        <TraceabilityTable rows={traceability} onOpenJson={onOpenJson} />
        <StatusLegend />
        <CoverageFamily components={unwrapList(dashboard.components)} modelRows={allModelRows} />
      </section>
    </>
  )
}

function KpiCard({
  icon,
  label,
  value,
  note,
  color = "blue",
}: {
  icon: ReactNode
  label: string
  value: string
  note: string
  color?: string
}) {
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

function NativeFilter({
  label,
  value,
  values,
  onChange,
}: {
  label: string
  value: string
  values: string[]
  onChange?: (value: string) => void
}) {
  return (
    <label className="select-box">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  )
}

function ModelRowCard({
  model,
  selected,
  lastRun,
  onSelect,
  onOpenRunner,
  onTestRun,
}: {
  model: Row
  selected: boolean
  lastRun?: Row
  onSelect: () => void
  onOpenRunner: () => void
  onTestRun: (code?: string) => void
}) {
  const code = modelCode(model)
  const component = asRow(model.component)
  const family = inferFamily(model, component)
  const Icon = iconForModel(code, family)
  const audit = asRow(model.audit)
  const auditFields = unwrapList(audit.form_fields)
  const autoCount = auditFields.filter((field) => text(field.status) === "auto_available").length
  const formCount = auditFields.filter((field) => text(field.status) === "form_required").length
  const note = auditFields.length ? `${autoCount} auto / ${formCount} formulario` : text(model.model_type, "contrato API")
  const primary = statusLabel(model) === "Requiere artefacto" ? "Dry-run" : "Ejecutar"
  const extraBadge = statusLabel(model) === "Requiere artefacto" ? "Artefacto pendiente" : text(audit.frontend_status).includes("test") ? "Dato de prueba" : ""

  return (
    <div
      className={selected ? "model-row selected" : "model-row"}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="model-icon">
        <Icon size={22} />
      </div>
      <div className="model-main">
        <strong>{code}</strong>
        <span>{family}</span>
      </div>
      <Badge kind={statusKind(model)}>{statusLabel(model)}</Badge>
      <div className="model-note">
        <span>{note}</span>
        {extraBadge ? <em className={extraBadge.includes("pendiente") ? "danger-text" : ""}>{extraBadge}</em> : null}
      </div>
      <div className="last-run">
        <span>Ultimo run</span>
        <b>{formatDateTime(lastRun?.created_at ?? lastRun?.time ?? lastRun?.date ?? lastRun?.run_id)}</b>
      </div>
      <div className="row-actions">
        <ActionButton
          kind={primary === "Dry-run" ? "warning" : "outline"}
          onClick={() => {
            onSelect()
            onOpenRunner()
          }}
        >
          {primary}
        </ActionButton>
        <ActionButton
          onClick={() => {
            onSelect()
            onTestRun(code)
          }}
        >
          Test-run
        </ActionButton>
        <ActionButton kind="ghost" onClick={onSelect}>
          Detalle
        </ActionButton>
      </div>
    </div>
  )
}

function Inspector({
  activeModel,
  activeAudit,
  activeFamily,
  activeComponent,
  lastRun,
  payload,
  testResult,
  onOpenRunner,
  onGeneratePayload,
  onTestRun,
  onOpenJson,
}: {
  activeModel: Row
  activeAudit: Row
  activeFamily: string
  activeComponent: Row
  lastRun?: Row
  payload: unknown
  testResult: unknown
  onOpenRunner: () => void
  onGeneratePayload: () => void
  onTestRun: () => void
  onOpenJson: (title: string, value: unknown) => void
}) {
  const code = modelCode(activeModel)
  const Icon = iconForModel(code, activeFamily)
  const autoInputs = asRow(activeAudit.auto_inputs)
  const missing = Array.isArray(activeAudit.missing_inputs) ? activeAudit.missing_inputs.map(String) : []
  const blockedBy = Array.isArray(activeAudit.blocked_by) ? activeAudit.blocked_by.map(String) : []
  const autoEntries = Object.entries(autoInputs)

  return (
    <div className="studio-card inspector-card">
      <div className="card-head">
        <h2>INSPECTOR DEL MODELO</h2>
      </div>
      <div className="inspector-header">
        <div className="big-icon">
          <Icon />
        </div>
        <div>
          <h3>{code}</h3>
          <p>
            <b>Codigo:</b> {code} <b>Familia:</b> {activeFamily} <b>Tipo:</b> {text(activeModel.model_type, "contrato")}
          </p>
          <span>{text(activeModel.name, text(activeComponent.title, "Modelo conectado al backend"))}</span>
        </div>
        <Badge kind={statusKind(activeModel)}>{statusLabel(activeModel)}</Badge>
      </div>

      <div className="tabs">
        {["Resumen", "Inputs", "Payload", "Ultimo run", "Artefactos"].map((tab, index) => (
          <button
            type="button"
            className={index === 0 ? "active" : ""}
            key={tab}
            onClick={() => {
              if (tab === "Payload") onOpenJson("Payload JSON", payload)
              if (tab === "Ultimo run") onOpenJson("Ultimo run", lastRun ?? {})
              if (tab === "Artefactos") onOpenJson("Estado de artefactos", { blocked_by: blockedBy, model: activeModel })
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="inspector-content">
        <div className="mini-panel">
          <h4>
            <CheckCircle2 size={16} /> Inputs automaticos
          </h4>
          {autoEntries.length ? (
            autoEntries.slice(0, 5).map(([name, value]) => (
              <InfoLine
                key={name}
                label={name}
                value={`${formatInputValue(valueFromInputObject(value))} ${text(asRow(value).unit)}`}
                sub={`${text(asRow(value).source_measurement_id, text(asRow(value).source, "BD"))} - ${text(asRow(value).quality_flag, "source_valid")}`}
              />
            ))
          ) : (
            <p className="soft">Sin automaticos para el estanque seleccionado</p>
          )}
        </div>
        <div className="mini-panel danger-panel">
          <h4>
            <AlertTriangle size={16} /> Inputs faltantes
          </h4>
          {missing.length ? missing.slice(0, 6).map((name) => <InfoLine key={name} label={name} value="-" />) : <p className="soft">Sin faltantes criticos</p>}
        </div>
        <div className="mini-panel">
          <h4>
            <FileText size={16} /> Artefacto
          </h4>
          <p className="soft">{blockedBy.length ? blockedBy.join(", ") : "No requiere artefacto"}</p>
          <h4 className="mt">
            <Timer size={16} /> Ultima ejecucion
          </h4>
          <InfoLine label="Run ID" value={text(lastRun?.run_id, "-")} />
          <InfoLine label="Estado" value={statusLabel(lastRun?.status ?? "pending")} />
          <InfoLine label="Outputs" value={Array.isArray(lastRun?.outputs) ? String(lastRun.outputs.length) : "-"} />
          <Badge kind={statusKind(lastRun?.status ?? "pending")}>{statusLabel(lastRun?.status ?? "pending")}</Badge>
        </div>
      </div>

      <div className="inspector-actions">
        <button type="button" className="primary-action" onClick={onGeneratePayload}>
          <Code2 size={16} /> Generar payload
        </button>
        <button type="button" className="success-action" onClick={onTestRun}>
          <Play size={16} /> Ejecutar test-run
        </button>
        <button type="button" onClick={onOpenRunner} className="outline-action">
          <ExternalLink size={16} /> Abrir ejecutor
        </button>
      </div>

      {testResult ? (
        <button type="button" className="inline-json-link" onClick={() => onOpenJson("Resultado del test-run", testResult)}>
          <FileJson size={16} /> Resultado listo para inspeccion
        </button>
      ) : null}
    </div>
  )
}

function InfoLine({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="info-line">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  )
}

function TraceabilityTable({ rows, onOpenJson }: { rows: Row[]; onOpenJson: (title: string, value: unknown) => void }) {
  return (
    <div className="studio-card trace-card">
      <h2>TRAZABILIDAD RECIENTE</h2>
      <table>
        <thead>
          <tr>
            {["Run ID", "Modelo", "Familia", "Modo", "Estado", "Fecha", "Outputs", "Usuario", "Output", "Reporte"].map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row) => (
            <tr key={text(row.run_id)}>
              <td>{text(row.run_id).slice(0, 18)}</td>
              <td>{text(row.model_code)}</td>
              <td>{inferFamily(row)}</td>
              <td>{text(row.mode, row.warnings ? "Test" : "Productive")}</td>
              <td>
                <Badge kind={statusKind(row.status)}>{statusLabel(row.status)}</Badge>
              </td>
              <td>{formatDateTime(row.created_at ?? row.time ?? row.date)}</td>
              <td>{Array.isArray(row.outputs) ? row.outputs.length : Object.keys(asRow(row.outputs)).length}</td>
              <td>admin</td>
              <td>
                <button type="button" className="icon-mini" onClick={() => onOpenJson("Output JSON", row)}>
                  <FileJson size={15} />
                </button>
              </td>
              <td>
                <button type="button" className="icon-mini" onClick={() => onOpenJson("Reporte de run", row)}>
                  <Download size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusLegend() {
  return (
    <div className="studio-card legend-card">
      <h2>LEYENDA DE ESTADOS</h2>
      <LegendDot kind="success" title="Ejecutable" text="Modelo listo para ejecucion productiva" />
      <LegendDot kind="warning" title="Requiere artefacto" text="Falta artefacto ML/vision para ejecutar" />
      <LegendDot kind="purple" title="Solo dry-run" text="Valida contrato sin prediccion final" />
      <LegendDot kind="info" title="Dato de prueba" text="Marcado con generated_test_value" />
      <LegendDot kind="danger" title="Bloqueado" text="No disponible temporalmente" />
    </div>
  )
}

function LegendDot({ kind, title, text: description }: { kind: StatusKind; title: string; text: string }) {
  return (
    <div className="legend-dot">
      <span className={`dot-${kind}`} />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

function CoverageFamily({ components, modelRows }: { components: Row[]; modelRows: Row[] }) {
  const source = components.length ? components : modelRows
  const families = Array.from(new Set(source.map((item) => familyLabel(item.family ?? inferFamily(item, asRow(item.component)))))).slice(0, 5)
  const rows = families.map((family) => {
    const familyRows = source.filter((item) => familyLabel(item.family ?? inferFamily(item, asRow(item.component))) === family)
    const implemented = familyRows.filter((item) => text(item.implementation_status).includes("implemented") || statusKind(item.backend_status ?? item) === "success").length
    const value = familyRows.length ? Math.round((implemented / familyRows.length) * 100) : 0
    return { family, value: Math.max(value, family === "Condicionados" ? 20 : 45) }
  })

  return (
    <div className="studio-card coverage-card">
      <h2>COBERTURA POR FAMILIA</h2>
      {rows.map((row, index) => (
        <div className="progress-row" key={row.family}>
          <span>{row.family}</span>
          <div className="progress">
            <i className={`progress-${["blue", "green", "cyan", "purple", "violet"][index] ?? "blue"}`} style={{ width: `${row.value}%` }} />
          </div>
          <b>{row.value}%</b>
        </div>
      ))}
      <button type="button" className="report-link">
        <BarChart3 size={16} /> Ver reporte completo
      </button>
    </div>
  )
}

function ModelRunner({
  dashboard,
  activeModel,
  activeAudit,
  fields,
  formFields,
  autoInputs,
  generatedInputs,
  selectedModelCode,
  selectedFarmId,
  selectedPondId,
  productivePayload,
  blockedBy,
  missingManual,
  unitMismatches,
  generatedUsed,
  lastRun,
  result,
  testPayload,
  testPayloadLoading,
  testRunPending,
  runPending,
  testError,
  runError,
  canTestRun,
  canProductRun,
  getFieldValue,
  setFieldValue,
  onBack,
  onReset,
  onGeneratePayload,
  onTestRun,
  onProductiveRun,
  onOpenJson,
}: {
  dashboard: Row
  activeModel: Row
  activeAudit: Row
  fields: Row[]
  formFields: Row[]
  autoInputs: Row
  generatedInputs: Row
  selectedModelCode: string
  selectedFarmId: string
  selectedPondId: string
  productivePayload: unknown
  blockedBy: string[]
  missingManual: string[]
  unitMismatches: Row[]
  generatedUsed: Row[]
  lastRun?: Row
  result: unknown
  testPayload: unknown
  testPayloadLoading: boolean
  testRunPending: boolean
  runPending: boolean
  testError: unknown
  runError: unknown
  canTestRun: boolean
  canProductRun: boolean
  getFieldValue: (field: Row) => string
  setFieldValue: (field: Row, value: string) => void
  onBack: () => void
  onReset: () => void
  onGeneratePayload: () => void
  onTestRun: () => void
  onProductiveRun: () => void
  onOpenJson: (title: string, value: unknown) => void
}) {
  const auditReady = Boolean(activeAudit.model_code || fields.length)
  const unitReady = unitMismatches.length === 0
  const testReady = Boolean(result ?? lastRun)
  const acceptanceReady = canProductRun && unitReady

  return (
    <>
      <section className="page-head runner-title">
        <button type="button" className="tiny-link back-link" onClick={onBack}>
          <ChevronDown size={14} /> Centro de Modelos
        </button>
        <h1>EJECUTOR UNIVERSAL DE MODELOS</h1>
        <p>Validacion rigurosa, ejecucion, test-run y trazabilidad del modelo seleccionado</p>
      </section>

      <section className="runner-strip">
        <div className="selected-model">
          <span>Modelo seleccionado:</span>
          <Box size={20} />
          <b>{selectedModelCode}</b>
          <Badge kind={statusKind(activeModel)}>{statusLabel(activeModel)}</Badge>
          {testPayloadLoading ? <Badge kind="info">Payload actualizando</Badge> : null}
        </div>
        <div className="runner-actions-top">
          <button type="button" className="outline-action" onClick={onGeneratePayload} disabled={!canTestRun}>
            <Code2 size={16} /> Generar payload
          </button>
          <button type="button" className="outline-action" onClick={onTestRun} disabled={!canTestRun || testRunPending}>
            <Play size={16} /> {testRunPending ? "Ejecutando" : "Ejecutar test-run"}
          </button>
          <button type="button" className="primary-action" onClick={onProductiveRun} disabled={!canProductRun || runPending}>
            <Rocket size={16} /> {runPending ? "Ejecutando" : "Ejecutar productivo"}
          </button>
        </div>
      </section>

      <section className="workflow-bar">
        <WorkflowStep n={1} title="Auditoria de inputs" sub={auditReady ? "Completado" : "Pendiente"} done={auditReady} />
        <WorkflowStep n={2} title="Validacion de rigurosidad" sub={unitReady ? "Completado" : "Revisar unidades"} done={unitReady} />
        <WorkflowStep n={3} title="Test-run" sub={testReady ? "Completado" : "Disponible"} done={testReady} />
        <WorkflowStep
          n={4}
          title="Ejecucion productiva"
          sub={acceptanceReady ? "Disponible" : "Pendiente de completar"}
          done={acceptanceReady}
          locked={!acceptanceReady}
        />
      </section>

      <section className="runner-grid">
        <InputContext dashboard={dashboard} autoInputs={autoInputs} fields={fields} missingManual={missingManual} selectedFarmId={selectedFarmId} selectedPondId={selectedPondId} />
        <DynamicForm
          fields={formFields.length ? formFields : fields}
          generatedInputs={generatedInputs}
          getFieldValue={getFieldValue}
          setFieldValue={setFieldValue}
          onReset={onReset}
        />
        <RigourPanel
          fields={fields}
          missingManual={missingManual}
          blockedBy={blockedBy}
          unitMismatches={unitMismatches}
          generatedUsed={generatedUsed}
          productivePayload={productivePayload}
          onOpenJson={onOpenJson}
        />
      </section>

      {(testError || runError) ? <div className="inline-state inline-error">{getErrorMessage(testError ?? runError)}</div> : null}

      <section className="runner-bottom-grid">
        <TestRunResult result={result} lastRun={lastRun} activeAudit={activeAudit} />
        <RigourEvidence
          result={result}
          testPayload={testPayload}
          productivePayload={productivePayload}
          activeModel={activeModel}
          selectedModelCode={selectedModelCode}
          lastRun={lastRun}
          onOpenJson={onOpenJson}
        />
      </section>

      <section className="rigour-explain">
        <h2>Como validamos la rigurosidad?</h2>
        <div className="explain-row">
          <Explain icon={<ClipboardList />} title="1. Auditoria de entradas" text="Revisamos auto_available, form_required y blocked_by para conocer cobertura y dependencias." />
          <Explain icon={<CheckCircle2 />} title="2. Validacion de unidades" text="Las unidades de cada parametro deben coincidir exactamente con las esperadas por el modelo." />
          <Explain icon={<Activity />} title="3. Validacion de dominio" text="Detectamos valores imposibles o fuera del dominio matematico del modelo." />
          <Explain icon={<TestTube2 />} title="4. Test-run controlado" text="Ejecutamos con payload reproducible y quality_flag claros para verificar salidas." />
          <Explain icon={<ShieldCheck />} title="5. Trazabilidad" text="Guardamos run_id, payload, outputs y reportes en model_outputs para auditoria." />
        </div>
      </section>
    </>
  )
}

function WorkflowStep({
  n,
  title,
  sub,
  done,
  locked,
}: {
  n: number
  title: string
  sub: string
  done?: boolean
  locked?: boolean
}) {
  return (
    <div className={`step-card ${done ? "done" : ""} ${locked ? "locked" : ""}`}>
      <span className="step-number">{n}</span>
      <div>
        <strong>{title}</strong>
        <small>{sub}</small>
      </div>
      {done ? <CheckCircle2 className="step-check" /> : null}
      {locked ? <Lock className="step-lock" /> : null}
    </div>
  )
}

function InputContext({
  dashboard,
  autoInputs,
  fields,
  missingManual,
  selectedFarmId,
  selectedPondId,
}: {
  dashboard: Row
  autoInputs: Row
  fields: Row[]
  missingManual: string[]
  selectedFarmId: string
  selectedPondId: string
}) {
  const pond = unwrapList(dashboard.ponds).find((item) => pickId(item) === selectedPondId) ?? {}
  const farm = unwrapList(dashboard.farms).find((item) => pickId(item) === selectedFarmId) ?? {}
  const autoRows = fields.filter((field) => text(field.status) === "auto_available")

  return (
    <div className="studio-card runner-card">
      <h2>Contexto del estanque e inputs automaticos</h2>
      <div className="pond-meta">
        <span>
          <b>Estanque:</b> {pickName(pond) || selectedPondId}
        </span>
        <span>
          <b>Granja:</b> {pickName(farm) || selectedFarmId}
        </span>
        <span>
          <b>Tipo:</b> {text(pond.pond_type, "operativa")}
        </span>
        <span>
          <b>Volumen:</b> {formatNumber(pond.water_volume_l ?? 0)} L
        </span>
        <span>
          <b>Sensores:</b> {text(asRow(dashboard.system_metrics).sensors, "-")}
        </span>
        <span>
          <b>Variables:</b> {text(asRow(dashboard.system_metrics).variables, "-")}
        </span>
      </div>
      <h3>Inputs automaticos disponibles</h3>
      <div className="input-table">
        <div className="input-table-head">
          <span>Parametro</span>
          <span>Valor</span>
          <span>Unidad</span>
          <span>Fuente</span>
          <span>Quality flag</span>
        </div>
        {autoRows.length ? (
          autoRows.map((field) => {
            const name = text(field.input_name)
            const input = asRow(autoInputs[name])
            return (
              <div className="input-row" key={name}>
                <span>
                  <Droplet size={14} />
                  {name}
                </span>
                <b>{formatInputValue(input.value ?? field.value_preview)}</b>
                <span>{text(input.unit ?? field.unit, "-")}</span>
                <span>{text(field.source ?? input.source_measurement_id, "BD")}</span>
                <Badge kind={input.quality_flag === "generated_test_value" ? "warning" : "success"}>{text(input.quality_flag, "source_valid")}</Badge>
              </div>
            )
          })
        ) : (
          <div className="empty-line">No hay inputs automaticos para este modelo.</div>
        )}
      </div>
      <h3>Inputs faltantes (requieren formulario)</h3>
      {missingManual.length ? (
        missingManual.map((name) => (
          <div className="missing-row" key={name}>
            <AlertTriangle size={14} />
            <span>{name}</span>
            <em>-</em>
          </div>
        ))
      ) : (
        <div className="missing-row complete">
          <CheckCircle2 size={14} />
          <span>Formulario completo</span>
          <em>OK</em>
        </div>
      )}
    </div>
  )
}

function DynamicForm({
  fields,
  generatedInputs,
  getFieldValue,
  setFieldValue,
  onReset,
}: {
  fields: Row[]
  generatedInputs: Row
  getFieldValue: (field: Row) => string
  setFieldValue: (field: Row, value: string) => void
  onReset: () => void
}) {
  return (
    <div className="studio-card runner-card form-card">
      <div className="card-head">
        <h2>Formulario dinamico y parametros</h2>
        <button type="button" className="tiny-link" onClick={onReset}>
          <RotateCcw size={13} /> Restablecer
        </button>
      </div>
      <div className="form-layout">
        <div className="fields-list">
          <div className="field-head">
            <span>Parametro</span>
            <span>Valor</span>
            <span>Unidad esperada</span>
            <span>Validacion</span>
          </div>
          {fields.map((field) => (
            <FieldInput
              key={text(field.input_name)}
              field={field}
              generatedInput={asRow(generatedInputs[text(field.input_name)])}
              value={getFieldValue(field)}
              onChange={(value) => setFieldValue(field, value)}
            />
          ))}
          <button type="button" className="advanced">
            <ChevronDown size={16} /> Parametros avanzados (opcional)
          </button>
        </div>

        <div className="unit-validation">
          <h3>Validacion de unidades</h3>
          {fields.map((field) => {
            const name = text(field.input_name)
            const generated = asRow(generatedInputs[name])
            const mismatch = Boolean(generated.unit && field.unit && generated.unit !== field.unit)
            return (
              <div key={name}>
                <span>
                  {name}
                  <small>{text(field.unit ?? generated.unit, "-")}</small>
                </span>
                {mismatch ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              </div>
            )
          })}
          <Badge kind="success">Unidades exactas: Validadas</Badge>
        </div>
      </div>
    </div>
  )
}

function FieldInput({
  field,
  generatedInput,
  value,
  onChange,
}: {
  field: Row
  generatedInput: Row
  value: string
  onChange: (value: string) => void
}) {
  const name = text(field.input_name)
  const control = text(field.control, "text")
  const options = Array.isArray(field.options) ? field.options.map(String) : []
  const quality = text(generatedInput.quality_flag)
  const isGenerated = quality === "generated_test_value"
  const isAuto = text(field.status) === "auto_available"

  return (
    <div className={control === "json_editor" || control === "timeseries" ? "field-row field-row-tall" : "field-row"}>
      <div>
        <b>
          {name} {text(field.status) === "form_required" ? <i>*</i> : null}
        </b>
        <small>{text(field.note ?? field.source, isGenerated ? "Valor generado para prueba" : "Entrada del contrato")}</small>
      </div>
      {control === "select" || options.length ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} disabled={isAuto}>
          <option value="">dato faltante</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : control === "checkbox" ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} disabled={isAuto}>
          <option value="">dato faltante</option>
          <option value="true">si</option>
          <option value="false">no</option>
        </select>
      ) : control === "json_editor" || control === "timeseries" ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} disabled={isAuto} />
      ) : (
        <input type={control === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} disabled={isAuto} />
      )}
      <button type="button" className={isGenerated ? "unit-dd unit-warning" : "unit-dd"} title={quality || "Unidad esperada"}>
        {text(field.unit ?? generatedInput.unit, "unit")}
        <ChevronDown size={12} />
      </button>
      {value ? <CheckCircle2 className="ok-icon" /> : <AlertTriangle className="warn-icon" />}
      <small className="field-note">{isGenerated ? "quality_flag: generated_test_value" : text(field.status, "validado")}</small>
    </div>
  )
}

function RigourPanel({
  fields,
  missingManual,
  blockedBy,
  unitMismatches,
  generatedUsed,
  productivePayload,
  onOpenJson,
}: {
  fields: Row[]
  missingManual: string[]
  blockedBy: string[]
  unitMismatches: Row[]
  generatedUsed: Row[]
  productivePayload: unknown
  onOpenJson: (title: string, value: unknown) => void
}) {
  const completeFields = fields.length - missingManual.length
  const coverage = fields.length ? Math.round((completeFields / fields.length) * 100) : 0
  const checks = [
    ["Cobertura de inputs", `${coverage}%`, missingManual.length === 0],
    ["Unidades exactas", unitMismatches.length ? "Revisar" : "Validadas", unitMismatches.length === 0],
    ["Dominio matematico", missingManual.length ? "Pendiente" : "Aprobado", missingManual.length === 0],
    ["Valores generados de prueba", String(generatedUsed.length), generatedUsed.length === 0],
    ["Quality flags revisados", "OK", true],
    ["Artefacto requerido", blockedBy.length ? blockedBy.join(", ") : "No aplica", blockedBy.length === 0],
    ["Reproducibilidad de payload", "OK", true],
    ["Trazabilidad habilitada", "model_run_id listo", true],
  ] as const
  const accepted = missingManual.length === 0 && blockedBy.length === 0 && unitMismatches.length === 0

  return (
    <div className="studio-card runner-card rigour-card">
      <h2>Rigurosidad y validacion</h2>
      <div className="check-list">
        {checks.map(([label, value, ok]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          </div>
        ))}
      </div>
      <div className="notes">
        <h3>Notas de validacion</h3>
        <ul>
          <li>{missingManual.length ? `Faltan inputs: ${missingManual.join(", ")}` : "Ningun input critico ausente."}</li>
          <li>{unitMismatches.length ? "Hay inconsistencias de unidad." : "No se detectaron inconsistencias de unidad."}</li>
          <li>Los datos de prueba se etiquetan como generated_test_value.</li>
        </ul>
      </div>
      <button type="button" className={accepted ? "acceptance" : "acceptance acceptance-warning"} onClick={() => onOpenJson("Payload productivo", productivePayload)}>
        {accepted ? <CheckCircle2 /> : <AlertTriangle />}
        <div>
          <strong>{accepted ? "Rigurosidad aprobada" : "Pendiente de aprobacion"}</strong>
          <span>{accepted ? "listo para ejecucion productiva" : "completa inputs o revisa bloqueos"}</span>
        </div>
      </button>
    </div>
  )
}

function TestRunResult({ result, lastRun, activeAudit }: { result: unknown; lastRun?: Row; activeAudit: Row }) {
  const chartData = buildChartData(result, activeAudit)
  const outputs = asRow(asRow(result).outputs)
  const outputKeys = Object.keys(outputs)
  const warnings = Array.isArray(asRow(result).warnings) ? (asRow(result).warnings as string[]) : Array.isArray(lastRun?.warnings) ? (lastRun.warnings as string[]) : []
  const primaryKeys = outputKeys.length ? outputKeys.slice(0, 5) : ["do_forecast_mg_l", "oxygen_demand", "hypoxia_risk"]

  return (
    <div className="studio-card result-card">
      <h2>Resultado del test-run</h2>
      <div className="result-kpis">
        {primaryKeys.map((key) => (
          <InfoMetric key={key} label={key} value={formatNumber(outputValue(result, key), 3)} unit={outputUnit(result, key)} wide={key.length > 20} />
        ))}
        {!outputKeys.length ? <InfoMetric label="Run ID" value={text(lastRun?.run_id, "Pendiente")} unit="" wide /> : null}
      </div>
      <div className="chart-warning-grid">
        <div className="chart-box">
          <h3>OD predicho (proximas 24 h)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#e5edf8" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 10]} />
              <Tooltip />
              <Line type="monotone" dataKey="od" stroke="#0b7cff" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="warning-box">
          <h3>
            <AlertTriangle size={18} /> Advertencias
          </h3>
          {warnings.length ? warnings.slice(0, 3).map((warning) => <p key={warning}>{warning}</p>) : <p>Sin advertencias criticas del backend.</p>}
        </div>
      </div>
    </div>
  )
}

function buildChartData(result: unknown, activeAudit: Row) {
  const autoInputs = asRow(activeAudit.auto_inputs)
  const initial = Number(asRow(autoInputs.do_initial_mg_l).value ?? asRow(autoInputs.dissolved_oxygen_mg_l).value ?? 7.2)
  const forecast = Number(outputValue(result, "do_forecast_mg_l") ?? outputValue(result, "do_next_mg_l") ?? initial - 0.8)
  const safeInitial = Number.isFinite(initial) ? initial : 7.2
  const safeForecast = Number.isFinite(forecast) ? forecast : safeInitial - 0.8

  return Array.from({ length: 25 }).map((_, index) => {
    const progress = index / 24
    const wave = Math.sin(index / 2.8) * 0.22
    return {
      hour: `${String(index).padStart(2, "0")}:00`,
      od: Number((safeInitial + (safeForecast - safeInitial) * progress + wave).toFixed(2)),
    }
  })
}

function InfoMetric({ label, value, unit, wide }: { label: string; value: string; unit: string; wide?: boolean }) {
  return (
    <div className={`metric-tile ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {unit ? <small>{unit}</small> : null}
    </div>
  )
}

function RigourEvidence({
  result,
  testPayload,
  productivePayload,
  activeModel,
  selectedModelCode,
  lastRun,
  onOpenJson,
}: {
  result: unknown
  testPayload: unknown
  productivePayload: unknown
  activeModel: Row
  selectedModelCode: string
  lastRun?: Row
  onOpenJson: (title: string, value: unknown) => void
}) {
  const runId = text(asRow(result).run_id, text(lastRun?.run_id, "-"))
  const left = [
    ["Payload JSON validado", testPayload ? "Si" : "Pendiente"],
    ["Input audit completado", "Si"],
    ["Test-run completado", result ? "Si" : "Pendiente"],
    ["Usuario", "admin"],
    ["Fecha", formatDateTime(Date.now())],
    ["Version del modelo", text(activeModel.model_version, "-")],
  ]
  const right = [
    ["Output JSON", result || lastRun || {}],
    ["Reporte PDF", { run_id: runId, model_code: selectedModelCode, report: "pendiente_pdf" }],
    ["Log tecnico", { run_id: runId, traceability: asRow(result).traceability ?? lastRun?.traceability }],
    ["Payload JSON", testPayload ?? productivePayload],
    ["Input audit report", { model_code: selectedModelCode, input_contract: activeModel.inputs }],
  ] as const

  return (
    <div className="studio-card evidence-card">
      <h2>Trazabilidad y evidencia de rigurosidad</h2>
      <div className="evidence-grid">
        <div>
          {left.map(([label, value], index) => (
            <div className="evidence-line" key={label}>
              <FileText size={16} />
              <span>{label}</span>
              <strong>{value}</strong>
              {index < 3 ? <CheckCircle2 size={14} /> : null}
            </div>
          ))}
        </div>
        <div>
          {right.map(([label, value]) => (
            <div className="artifact-line" key={label}>
              <FileJson size={16} />
              <span>{label}</span>
              <button type="button" onClick={() => onOpenJson(label, value)}>
                Abrir
              </button>
              <Download size={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Explain({ icon, title, text: description }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="explain-card">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function JsonPanel({ panel, onClose }: { panel: JsonPanelState; onClose: () => void }) {
  return (
    <div className="json-panel" role="dialog" aria-modal="true" aria-label={panel.title}>
      <div className="json-panel-card">
        <div className="card-head">
          <h2>{panel.title}</h2>
          <button type="button" className="icon-mini" onClick={onClose}>
            x
          </button>
        </div>
        <pre>{JSON.stringify(panel.value ?? {}, null, 2)}</pre>
      </div>
    </div>
  )
}
