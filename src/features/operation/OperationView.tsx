import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { AutoTable } from "@/components/common/AutoTable"
import { DataState } from "@/components/common/DataState"
import { MetricCard } from "@/components/common/MetricCard"
import { TimeSeriesChart } from "@/components/common/TimeSeriesChart"
import type { ViewContext } from "@/App"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { APP_CONFIG } from "@/config/app"
import { defaultWaterVariable, variableMeta, waterVariables } from "@/config/variables"
import { apiGet } from "@/lib/api"
import { formatDate, formatValue } from "@/lib/format"
import { pickValue, query, unwrapList, unwrapObject } from "@/lib/normalize"

function nestedMetric(source: unknown, keys: string[]) {
  const row = unwrapObject(source)
  const value = pickValue(row, keys)
  if (value && typeof value === "object") {
    const metric = unwrapObject(value)
    return { value: pickValue(metric, ["value", "clean_value", "raw_value"]), unit: String(pickValue(metric, ["unit", "standard_unit", "raw_unit"]) ?? "") }
  }
  return { value, unit: "" }
}

function samePond(row: Record<string, unknown>, pondId: string) {
  return !pondId || !row.pond_id || row.pond_id === pondId
}

export function OperationView({ selectedPondId }: ViewContext) {
  const [selectedVariable, setSelectedVariable] = useState(defaultWaterVariable)
  const health = useQuery({ queryKey: ["health"], queryFn: () => apiGet<unknown>("/health"), refetchInterval: APP_CONFIG.refreshMs })
  const sensorsQuery = useQuery({ queryKey: ["sensors"], queryFn: () => apiGet<unknown>("/sensors") })
  const stateQuery = useQuery({
    queryKey: ["pond-state", selectedPondId],
    queryFn: () => apiGet<unknown>(`/ponds/${selectedPondId}/state`),
    enabled: Boolean(selectedPondId),
    refetchInterval: APP_CONFIG.refreshMs,
  })
  const timeseriesQuery = useQuery({
    queryKey: ["pond-timeseries", selectedPondId, selectedVariable],
    queryFn: () => apiGet<unknown>(query(`/ponds/${selectedPondId}/timeseries`, { variable_code: selectedVariable })),
    enabled: Boolean(selectedPondId),
  })
  const latestQuery = useQuery({
    queryKey: ["digital-twin-latest", selectedPondId],
    queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/latest`),
    enabled: Boolean(selectedPondId),
  })
  const alertsQuery = useQuery({ queryKey: ["alerts"], queryFn: () => apiGet<unknown>("/alerts") })
  const recommendationsQuery = useQuery({ queryKey: ["recommendations"], queryFn: () => apiGet<unknown>("/recommendations") })

  const state = unwrapObject(stateQuery.data)
  const waterQuality = unwrapObject(state.water_quality_current)
  const biomass = unwrapObject(state.biomass_current)
  const feeding = unwrapObject(state.feeding_current)
  const sensors = unwrapList(sensorsQuery.data).filter((row) => samePond(row, selectedPondId))
  const activeSensors = sensors.filter((row) => String(row.status ?? "").toLowerCase() === "active")
  const alerts = unwrapList(alertsQuery.data).filter((row) => samePond(row, selectedPondId))
  const openAlerts = alerts.filter((row) => String(row.status ?? "open").toLowerCase() === "open")
  const recommendations = unwrapList(recommendationsQuery.data).filter((row) => samePond(row, selectedPondId))
  const latest = unwrapObject(latestQuery.data)
  const oxygen = nestedMetric(waterQuality, ["dissolved_oxygen_mg_l", "dissolved_oxygen", "oxygen", "do"])
  const temperature = nestedMetric(waterQuality, ["water_temperature_c", "temperature", "temp"])
  const ph = nestedMetric(waterQuality, ["ph", "pH"])
  const nitrate = nestedMetric(waterQuality, ["nitrate_ion", "nitrate_ion_mg_l", "nitrate", "ion_nitrato"])
  const biomassMetric = nestedMetric(biomass, ["biomass_kg", "biomass", "fish_biomass"])
  const feedingMetric = nestedMetric(feeding, ["daily_feed_kg", "feed_kg", "ration", "feeding"])
  const selectedMeta = variableMeta(selectedVariable)
  const chartRows = unwrapList(timeseriesQuery.data)
  const lastPoint = chartRows.at(-1)
  const lastValue = pickValue(lastPoint ?? {}, ["clean_value", "raw_value", "value"])

  if (!selectedPondId) return <DataState status="blocked" message="selecciona un estanque para ver la operacion" />

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <MetricCard title="Temperatura" value={temperature.value} unit={temperature.unit} status={temperature.value ? "valid" : "incomplete"} />
          <MetricCard title="pH" value={ph.value} unit={ph.unit} status={ph.value ? "valid" : "incomplete"} />
          <MetricCard title="Oxigeno disuelto" value={oxygen.value} unit={oxygen.unit} status={oxygen.value ? "valid" : "incomplete"} />
          <MetricCard title="Ion nitrato" value={nitrate.value} unit={nitrate.unit} status={nitrate.value ? "valid" : "incomplete"} />
          <MetricCard title="Biomasa" value={biomassMetric.value} unit={biomassMetric.unit} status={biomassMetric.value ? "valid" : "incomplete"} />
          <MetricCard title="Alimentacion" value={feedingMetric.value} unit={feedingMetric.unit} status={feedingMetric.value ? "valid" : "incomplete"} />
          <MetricCard title="Sensores activos" value={activeSensors.length} description={`${sensors.length} sensores registrados`} status="active" />
          <MetricCard title="Alertas abiertas" value={openAlerts.length} status={openAlerts.length ? "open" : "closed"} />
          <MetricCard title="Ultimo snapshot" value={formatDate(pickValue(latest, ["timestamp", "created_at"]))} status={latestQuery.error ? "incomplete" : "ok"} />
          <MetricCard title="Estado API" value={health.isSuccess ? "conectada" : "caida"} status={health.isSuccess ? "ok" : "down"} />
        </div>
        <div className="space-y-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Mediciones recientes</div>
              <div className="text-xs text-muted-foreground">
                {selectedMeta.label}: {formatValue(lastValue)} {selectedMeta.unit}
              </div>
            </div>
            <Select value={selectedVariable} onValueChange={setSelectedVariable}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="variable" />
              </SelectTrigger>
              <SelectContent>
                {waterVariables.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TimeSeriesChart data={timeseriesQuery.data} title={`${selectedMeta.label} (${selectedMeta.unit})`} />
        </div>
        <AutoTable
          title="Estado actual del estanque"
          data={stateQuery.data ? [state] : []}
          columns={["pond_id", "timestamp", "water_quality_current", "missing_data"]}
          isLoading={stateQuery.isLoading}
          error={stateQuery.error}
          emptyMessage="dato faltante"
        />
      </section>
      <aside className="space-y-4">
        <AutoTable
          title="Alertas abiertas"
          data={openAlerts.slice(0, 8)}
          columns={["alert_code", "severity", "message", "snapshot_id"]}
          isLoading={alertsQuery.isLoading}
          error={alertsQuery.error}
          emptyMessage="sin alertas abiertas"
        />
        <AutoTable
          title="Recomendaciones"
          data={recommendations.slice(0, 8)}
          columns={["recommendation_code", "priority", "recommended_action", "approval_required"]}
          isLoading={recommendationsQuery.isLoading}
          error={recommendationsQuery.error}
          emptyMessage="sin recomendaciones"
        />
        <AutoTable title="Sensores" data={sensors} columns={["sensor_code", "variable_code", "status"]} isLoading={sensorsQuery.isLoading} error={sensorsQuery.error} />
      </aside>
    </div>
  )
}
