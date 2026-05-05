import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { DataState } from "@/components/common/DataState"
import { JsonBlock } from "@/components/common/JsonBlock"
import { StatusBadge } from "@/components/common/StatusBadge"
import type { ViewContext } from "@/App"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { expectedModels } from "@/config/models"
import { apiGet, apiPost } from "@/lib/api"
import { pickValue, query, unwrapList, unwrapObject, type Row } from "@/lib/normalize"
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
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({})
  const detailQuery = useQuery({
    queryKey: ["model", modelCode],
    queryFn: () => apiGet<unknown>(`/models/${modelCode}`),
    enabled: Boolean(modelCode),
  })
  const auditQuery = useQuery({
    queryKey: ["model-input-audit", modelCode, selectedPondId],
    queryFn: () => apiGet<unknown>(query(`/models/${modelCode}/input-audit`, { pond_id: selectedPondId })),
    enabled: Boolean(modelCode),
  })
  const active = { ...(catalog.find((row) => String(pickValue(row, ["model_code", "code"])) === modelCode) ?? {}), ...unwrapObject(detailQuery.data) }
  const audit = unwrapObject(auditQuery.data)
  const autoInputs = unwrapObject(pickValue(audit, ["auto_inputs"]))
  const fields = unwrapList(pickValue(audit, ["form_fields"]))
  const blockedBy = Array.isArray(audit.blocked_by) ? audit.blocked_by.map(String) : []
  const missingInputs = Array.isArray(audit.missing_inputs) ? audit.missing_inputs.map(String) : []
  const getFieldValue = (field: Row) => {
    const inputName = String(field.input_name ?? "")
    return manualInputs[`${modelCode}.${inputName}`] ?? (field.value_preview === null || field.value_preview === undefined ? "" : String(field.value_preview))
  }
  const setFieldValue = (field: Row, value: string) => {
    const inputName = String(field.input_name ?? "")
    setManualInputs((current) => ({ ...current, [`${modelCode}.${inputName}`]: value }))
  }
  const toInputValue = (field: Row) => {
    const raw = getFieldValue(field)
    if (field.control === "checkbox") return raw === "true"
    if (field.control === "number") return Number(raw)
    return raw
  }
  const payload = {
    farm_id: selectedFarmId || null,
    pond_id: selectedPondId || null,
    inputs: {
      ...autoInputs,
      ...Object.fromEntries(
        fields
          .filter((field) => getFieldValue(field) !== "")
          .map((field) => [
            String(field.input_name),
            {
              value: toInputValue(field),
              unit: String(field.unit ?? "unit"),
            },
          ]),
      ),
    },
    parameters: {},
  }
  const missingManual = fields.filter((field) => field.status === "form_required" && getFieldValue(field) === "").map((field) => String(field.input_name))
  const auditCanRun = Boolean(pickValue(audit, ["can_run_now"]))
  const runMutation = useMutation({
    mutationFn: () => apiPost<unknown>(`/models/${modelCode}/run`, payload),
  })
  const ready = canRun(active)
  const executable = (auditCanRun || ready) && blockedBy.length === 0 && missingManual.length === 0
  const status = String(pickValue(audit, ["frontend_status"]) ?? pickValue(active, ["readiness_status"]) ?? "modelo no ejecutable")

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
              <StatusBadge value={status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
            <JsonBlock value={active} title="metadata" />
            <div className="space-y-3">
              {auditQuery.isLoading ? <DataState status="loading" /> : null}
              {Object.keys(autoInputs).length ? (
                <div className="rounded-md border border-border p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Autocompletado desde sensores/MySQL</div>
                  <JsonBlock value={autoInputs} compact />
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                {fields.map((field) => {
                  const inputName = String(field.input_name)
                  const options = Array.isArray(field.options) ? field.options.map(String) : []
                  return (
                    <div key={inputName} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs text-muted-foreground">{inputName}</label>
                        <StatusBadge value={field.status} />
                      </div>
                      {field.control === "select" ? (
                        <Select value={getFieldValue(field) || "none"} onValueChange={(value) => setFieldValue(field, value === "none" ? "" : value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={String(field.unit ?? "valor")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">dato faltante</SelectItem>
                            {options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.control === "checkbox" ? (
                        <Select value={getFieldValue(field) || "none"} onValueChange={(value) => setFieldValue(field, value === "none" ? "" : value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="si/no" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">dato faltante</SelectItem>
                            <SelectItem value="true">si</SelectItem>
                            <SelectItem value="false">no</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={field.control === "number" ? "number" : "text"}
                          value={getFieldValue(field)}
                          onChange={(event) => setFieldValue(field, event.target.value)}
                          placeholder={`${String(field.unit ?? "valor")}${missingInputs.includes(inputName) ? " requerido" : ""}`}
                        />
                      )}
                      {field.note ? <p className="text-xs text-muted-foreground">{String(field.note)}</p> : null}
                    </div>
                  )
                })}
              </div>
              {blockedBy.length ? <DataState status="blocked" message={`modelo no ejecutable todavia: ${blockedBy.join(", ")}`} /> : null}
              {!blockedBy.length && missingManual.length ? <DataState status="incomplete" message={`faltan inputs: ${missingManual.join(", ")}`} /> : null}
              {!ready && !auditCanRun && !blockedBy.length && !missingManual.length ? <DataState status="blocked" message="modelo no ejecutable todavia" /> : null}
              <JsonBlock value={payload} title="payload de ejecucion" />
              <Button disabled={!executable || runMutation.isPending} onClick={() => runMutation.mutate()}>
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
