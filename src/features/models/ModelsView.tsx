import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { DataState } from "@/components/common/DataState"
import { JsonBlock } from "@/components/common/JsonBlock"
import { StatusBadge } from "@/components/common/StatusBadge"
import type { ViewContext } from "@/App"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { expectedModels } from "@/config/models"
import { apiGet, apiPost } from "@/lib/api"
import { pickValue, unwrapList, unwrapObject, type Row } from "@/lib/normalize"
import { cn } from "@/lib/utils"

function mergeCatalog(apiRows: Row[]): Row[] {
  const byCode = new Map(apiRows.map((row) => [String(row.model_code ?? row.code ?? ""), row]))
  const expected: Row[] = expectedModels.map((model_code) => ({
    model_code,
    name: model_code,
    readiness_status: "modelo no ejecutable todavia",
    ...byCode.get(model_code),
  }))
  const extras = apiRows.filter((row) => !expectedModels.includes(String(row.model_code ?? row.code ?? "")))
  return [...expected, ...extras]
}

function canRun(model: Row) {
  const status = String(pickValue(model, ["readiness_status", "status"]) ?? "").toLowerCase()
  if (/(not|pend|missing|blocked|stub|no ejecutable)/.test(status)) return false
  return /(ready|available|implemented|executable)/.test(status)
}

export function ModelsView({ selectedFarmId, selectedPondId }: ViewContext) {
  const catalogQuery = useQuery({ queryKey: ["models"], queryFn: () => apiGet<unknown>("/models") })
  const catalog = mergeCatalog(unwrapList(catalogQuery.data))
  const [modelCode, setModelCode] = useState(expectedModels[0])
  const [body, setBody] = useState(() =>
    JSON.stringify(
      {
        farm_id: selectedFarmId || null,
        pond_id: selectedPondId || null,
        inputs: {},
        parameters: {},
      },
      null,
      2,
    ),
  )
  const detailQuery = useQuery({
    queryKey: ["model", modelCode],
    queryFn: () => apiGet<unknown>(`/models/${modelCode}`),
    enabled: Boolean(modelCode),
  })
  const active = { ...(catalog.find((row) => String(pickValue(row, ["model_code", "code"])) === modelCode) ?? {}), ...unwrapObject(detailQuery.data) }
  const runMutation = useMutation({
    mutationFn: () => apiPost<unknown>(`/models/${modelCode}/run`, JSON.parse(body) as unknown),
  })
  const ready = canRun(active)

  return (
    <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Catalogo de modelos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-12rem)] pr-3">
            <div className="space-y-2">
              {catalogQuery.isLoading ? <DataState status="loading" /> : null}
              {catalog.map((model) => {
                const code = String(pickValue(model, ["model_code", "code"]))
                return (
                  <button
                    key={code}
                    className={cn("w-full rounded-md border border-border p-3 text-left text-sm hover:bg-accent", modelCode === code && "bg-accent")}
                    onClick={() => setModelCode(code)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{code}</span>
                      <StatusBadge value={pickValue(model, ["readiness_status", "status"])} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{String(model.name ?? "modelo")}</div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <section className="space-y-4">
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              {modelCode}
              <StatusBadge value={ready ? "ready" : "modelo no ejecutable"} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <JsonBlock value={active} title="metadata" />
            <div className="space-y-3">
              <Textarea className="min-h-56 font-mono text-xs" value={body} onChange={(event) => setBody(event.target.value)} disabled={!ready} />
              {ready ? null : <DataState status="blocked" message="modelo no ejecutable todavia" />}
              <Button disabled={!ready || runMutation.isPending} onClick={() => runMutation.mutate()}>
                {runMutation.isPending ? "ejecutando" : "ejecutar modelo"}
              </Button>
              {runMutation.error ? <DataState status="error" message={runMutation.error.message} /> : null}
            </div>
          </CardContent>
        </Card>
        {runMutation.data ? <JsonBlock value={runMutation.data} title="resultado de modelo" /> : null}
      </section>
    </div>
  )
}
