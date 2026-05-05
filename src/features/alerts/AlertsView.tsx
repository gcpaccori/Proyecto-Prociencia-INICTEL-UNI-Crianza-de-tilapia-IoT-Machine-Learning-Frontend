import { useQuery } from "@tanstack/react-query"

import { AutoTable } from "@/components/common/AutoTable"
import { DataState } from "@/components/common/DataState"
import type { ViewContext } from "@/App"
import { apiGet } from "@/lib/api"
import type { Row } from "@/lib/normalize"
import { unwrapList } from "@/lib/normalize"

function byPond(rows: Row[], pondId: string) {
  return rows.filter((row) => !pondId || !row.pond_id || row.pond_id === pondId)
}

function groups(rows: Row[], key: string, defaults: string[]) {
  const seen = new Set([...defaults, ...rows.map((row) => String(row[key] ?? "sin prioridad"))])
  return [...seen].map((value) => ({ value, rows: rows.filter((row) => String(row[key] ?? "sin prioridad") === value) }))
}

export function AlertsView({ selectedPondId }: ViewContext) {
  const alertsQuery = useQuery({ queryKey: ["alerts"], queryFn: () => apiGet<unknown>("/alerts") })
  const recommendationsQuery = useQuery({ queryKey: ["recommendations"], queryFn: () => apiGet<unknown>("/recommendations") })
  const risksQuery = useQuery({
    queryKey: ["digital-twin-risks", selectedPondId],
    queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/risks`),
    enabled: Boolean(selectedPondId),
  })
  const twinRecommendationsQuery = useQuery({
    queryKey: ["digital-twin-recommendations", selectedPondId],
    queryFn: () => apiGet<unknown>(`/digital-twin/${selectedPondId}/recommendations`),
    enabled: Boolean(selectedPondId),
  })
  const alerts = byPond(unwrapList(alertsQuery.data), selectedPondId)
  const recommendations = byPond(unwrapList(recommendationsQuery.data), selectedPondId)
  const riskRows = unwrapList(risksQuery.data)
  const twinRecommendations = unwrapList(twinRecommendationsQuery.data)

  return (
    <div className="space-y-4">
      {!selectedPondId ? <DataState status="incomplete" message="sin estanque seleccionado; se muestra bandeja global" /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-4">
          {groups(alerts, "severity", ["critical", "high", "medium", "low"]).map((group) => (
            <AutoTable
              key={group.value}
              title={`Alertas ${group.value}`}
              data={group.rows}
              columns={["alert_code", "severity", "status", "message", "evidence", "snapshot_id"]}
              isLoading={alertsQuery.isLoading}
              error={alertsQuery.error}
              emptyMessage="sin alertas abiertas"
            />
          ))}
        </section>
        <section className="space-y-4">
          {groups(recommendations, "priority", ["critical", "high", "medium", "low"]).map((group) => (
            <AutoTable
              key={group.value}
              title={`Recomendaciones ${group.value}`}
              data={group.rows}
              columns={["recommendation_code", "priority", "recommended_action", "explanation", "approval_required", "evidence"]}
              isLoading={recommendationsQuery.isLoading}
              error={recommendationsQuery.error}
              emptyMessage="sin recomendaciones"
            />
          ))}
        </section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <AutoTable title="Riesgos del gemelo digital" data={riskRows} columns={["risk_code", "risk_level", "risk_score", "explanation", "evidence"]} isLoading={risksQuery.isLoading} error={risksQuery.error} emptyMessage="sin riesgos" />
        <AutoTable title="Recomendaciones del gemelo digital" data={twinRecommendations} columns={["recommendation_code", "priority", "recommended_action", "approval_required", "evidence"]} isLoading={twinRecommendationsQuery.isLoading} error={twinRecommendationsQuery.error} emptyMessage="sin recomendaciones" />
      </div>
    </div>
  )
}
