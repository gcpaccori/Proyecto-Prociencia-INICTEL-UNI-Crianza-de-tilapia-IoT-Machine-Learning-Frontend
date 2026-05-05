import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { AutoTable } from "@/components/common/AutoTable"
import { DataState } from "@/components/common/DataState"
import { JsonBlock } from "@/components/common/JsonBlock"
import { MetricCard } from "@/components/common/MetricCard"
import type { ViewContext } from "@/App"
import { Button } from "@/components/ui/button"
import { expectedModels } from "@/config/models"
import { apiGet, apiPost } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { objectList, pickValue, unwrapList, unwrapObject } from "@/lib/normalize"

export function DigitalTwinView({ selectedPondId }: ViewContext) {
  const queryClient = useQueryClient()
  const stateQuery = useQuery({
    queryKey: ["pond-state", selectedPondId],
    queryFn: () => apiGet<unknown>(`/ponds/${selectedPondId}/state`),
    enabled: Boolean(selectedPondId),
  })
  const latestQuery = useQuery({
    queryKey: ["digital-twin-latest", selectedPondId],
    queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/latest`),
    enabled: Boolean(selectedPondId),
  })
  const risksQuery = useQuery({
    queryKey: ["digital-twin-risks", selectedPondId],
    queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/risks`),
    enabled: Boolean(selectedPondId),
  })
  const recommendationsQuery = useQuery({
    queryKey: ["digital-twin-recommendations", selectedPondId],
    queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/recommendations`),
    enabled: Boolean(selectedPondId),
  })
  const snapshotMutation = useMutation({
    mutationFn: () => apiPost<unknown>(`/digital-twin/${selectedPondId}/snapshot`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-twin-latest", selectedPondId] })
      queryClient.invalidateQueries({ queryKey: ["digital-twin-risks", selectedPondId] })
      queryClient.invalidateQueries({ queryKey: ["digital-twin-recommendations", selectedPondId] })
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
      queryClient.invalidateQueries({ queryKey: ["recommendations"] })
    },
  })
  const latest = unwrapObject(latestQuery.data)
  const outputs = unwrapList(pickValue(latest, ["model_outputs"]))
  const executed = new Set(outputs.map((row) => String(row.model_code ?? "")))
  const omitted = expectedModels.filter((code) => !executed.has(code)).map((model_code) => ({ model_code, status: "modelo no ejecutable todavia" }))
  const missingData = objectList(pickValue(latest, ["missing_data_report"]) ?? pickValue(unwrapObject(stateQuery.data), ["missing_data"]))

  if (!selectedPondId) return <DataState status="blocked" message="selecciona un estanque para generar snapshots" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Gemelo Digital</h1>
          <p className="text-xs text-muted-foreground">estanque: {selectedPondId}</p>
        </div>
        <Button onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
          {snapshotMutation.isPending ? "generando" : "generar snapshot"}
        </Button>
      </div>
      {snapshotMutation.error ? <DataState status="error" message={snapshotMutation.error.message} /> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard title="Snapshot" value={pickValue(latest, ["snapshot_id"]) ?? "sin snapshot disponible"} status={latestQuery.error ? "incomplete" : "ok"} />
        <MetricCard title="Fecha" value={formatDate(pickValue(latest, ["timestamp"]))} />
        <MetricCard title="Modelos ejecutados" value={outputs.length} />
        <MetricCard title="Modelos omitidos" value={omitted.length} status={omitted.length ? "not_executable" : "ok"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <AutoTable title="Estado actual" data={stateQuery.data ? [unwrapObject(stateQuery.data)] : []} columns={["pond_id", "timestamp", "water_quality_current", "missing_data"]} isLoading={stateQuery.isLoading} error={stateQuery.error} />
        <AutoTable title="Salidas de modelos" data={outputs} columns={["model_code", "model_version", "outputs", "warnings", "run_id"]} isLoading={latestQuery.isLoading} error={latestQuery.error ? null : undefined} emptyMessage="sin snapshot disponible" />
        <AutoTable title="Riesgos" data={unwrapList(risksQuery.data)} columns={["risk_code", "risk_level", "risk_score", "explanation", "evidence"]} isLoading={risksQuery.isLoading} error={risksQuery.error} emptyMessage="sin riesgos" />
        <AutoTable title="Recomendaciones" data={unwrapList(recommendationsQuery.data)} columns={["recommendation_code", "priority", "recommended_action", "approval_required", "evidence"]} isLoading={recommendationsQuery.isLoading} error={recommendationsQuery.error} emptyMessage="sin recomendaciones" />
        <AutoTable title="Modelos omitidos" data={omitted} columns={["model_code", "status"]} emptyMessage="sin modelos omitidos" />
        <AutoTable title="Datos faltantes" data={missingData} columns={["key", "value"]} emptyMessage="dato faltante" />
      </div>
      <JsonBlock value={pickValue(latest, ["traceability"]) ?? latest} title="trazabilidad del snapshot" />
    </div>
  )
}
