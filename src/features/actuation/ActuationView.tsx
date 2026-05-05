import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { AutoTable } from "@/components/common/AutoTable"
import { DataState } from "@/components/common/DataState"
import { JsonBlock } from "@/components/common/JsonBlock"
import type { ViewContext } from "@/App"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiGet, apiPost } from "@/lib/api"
import type { Row } from "@/lib/normalize"
import { pickId, pickValue, unwrapList } from "@/lib/normalize"

function byPond(rows: Row[], pondId: string) {
  return rows.filter((row) => !pondId || !row.pond_id || row.pond_id === pondId)
}

export function ActuationView({ selectedPondId }: ViewContext) {
  const queryClient = useQueryClient()
  const [recommendationCode, setRecommendationCode] = useState("")
  const [actuatorId, setActuatorId] = useState("")
  const [approvedBy, setApprovedBy] = useState("operator-ui")
  const [approvalNote, setApprovalNote] = useState("")
  const [decision, setDecision] = useState<unknown>(null)
  const actuatorsQuery = useQuery({ queryKey: ["actuators"], queryFn: () => apiGet<unknown>("/actuators") })
  const recommendationsQuery = useQuery({ queryKey: ["recommendations"], queryFn: () => apiGet<unknown>("/recommendations") })
  const commandsQuery = useQuery({ queryKey: ["actuation-commands"], queryFn: () => apiGet<unknown>("/actuation-commands") })
  const actuators = byPond(unwrapList(actuatorsQuery.data), selectedPondId)
  const recommendations = byPond(unwrapList(recommendationsQuery.data), selectedPondId)
  const selectedActuator = actuators.find((row) => pickId(row) === actuatorId)
  const mutation = useMutation({
    mutationFn: () =>
      apiPost<unknown>("/actuation-commands/from-recommendation", {
        recommendation_code: recommendationCode,
        safety_policy: {
          allow_automatic_commands: true,
          allowed_actuator_types: selectedActuator ? [String(pickValue(selectedActuator, ["actuator_type"]))] : [],
          manual_approval_required: true,
          max_commands_per_recommendation: 1,
        },
        user_approval: {
          approved: true,
          approved_by: approvedBy,
          approval_note: approvalNote || null,
          approved_at: new Date().toISOString(),
        },
      }),
    onSuccess: (payload) => {
      setDecision(payload)
      queryClient.invalidateQueries({ queryKey: ["actuation-commands"] })
    },
  })
  const canApprove = Boolean(recommendationCode && actuatorId && approvedBy)

  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Aprobacion segura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedPondId ? <DataState status="incomplete" message="selecciona un estanque para filtrar la cola" /> : null}
          <Select value={recommendationCode || "none"} onValueChange={(value) => setRecommendationCode(value === "none" ? "" : value)}>
            <SelectTrigger><SelectValue placeholder="recomendacion" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">sin recomendaciones</SelectItem>
              {recommendations.map((row) => (
                <SelectItem key={String(row.recommendation_code)} value={String(row.recommendation_code)}>
                  {String(row.recommendation_code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actuatorId || "none"} onValueChange={(value) => setActuatorId(value === "none" ? "" : value)}>
            <SelectTrigger><SelectValue placeholder="actuador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">sin actuadores</SelectItem>
              {actuators.map((row) => (
                <SelectItem key={pickId(row)} value={pickId(row)}>
                  {String(pickValue(row, ["actuator_code", "actuator_type", "id"]) ?? "actuador")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={approvedBy} onChange={(event) => setApprovedBy(event.target.value)} placeholder="aprobado por" />
          <Input value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="nota de aprobacion" />
          <DataState status="blocked" message="politica: despacho fisico nunca se marca como ejecutado; solo pending_dispatch" />
          <Button className="w-full" disabled={!canApprove || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "generando" : "aprobar y generar comando pendiente"}
          </Button>
          {mutation.error ? <DataState status="error" message={mutation.error.message} /> : null}
          {decision ? <JsonBlock value={decision} title="decision de actuacion" /> : null}
        </CardContent>
      </Card>
      <section className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <AutoTable title="Recomendaciones pendientes" data={recommendations} columns={["recommendation_code", "priority", "recommended_action", "approval_required", "source_risk_code"]} isLoading={recommendationsQuery.isLoading} error={recommendationsQuery.error} emptyMessage="sin recomendaciones" />
          <AutoTable title="Actuadores disponibles" data={actuators} columns={["id", "actuator_code", "actuator_type", "status", "pond_id"]} isLoading={actuatorsQuery.isLoading} error={actuatorsQuery.error} emptyMessage="sin actuadores" />
        </div>
        <AutoTable title="Comandos pendientes" data={unwrapList(commandsQuery.data)} columns={["command_id", "actuator_id", "command_type", "execution_status", "requested_by", "requested_at", "audit_record"]} isLoading={commandsQuery.isLoading} error={commandsQuery.error} emptyMessage="sin comandos pendientes" />
      </section>
    </div>
  )
}
