import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { AutoTable } from "@/components/common/AutoTable"
import { JsonBlock } from "@/components/common/JsonBlock"
import { TimeSeriesChart } from "@/components/common/TimeSeriesChart"
import type { ViewContext } from "@/App"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiGet, apiPost } from "@/lib/api"
import { pickId, pickName, pickValue, unwrapList } from "@/lib/normalize"

const variables = ["water_temperature_c", "dissolved_oxygen_mg_l", "ph", "ammonia_mg_l", "biomass_kg", "feed_kg"]

export function IngestView({ selectedFarmId, selectedPondId }: ViewContext) {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<unknown>(null)
  const [form, setForm] = useState({
    farm_id: selectedFarmId,
    pond_id: selectedPondId,
    sensor_id: "",
    variable_code: "water_temperature_c",
    raw_value: "",
    raw_unit: "degC",
    source_type: "manual",
  })
  const farmsQuery = useQuery({ queryKey: ["farms"], queryFn: () => apiGet<unknown>("/farms") })
  const pondsQuery = useQuery({ queryKey: ["ponds"], queryFn: () => apiGet<unknown>("/ponds") })
  const sensorsQuery = useQuery({ queryKey: ["sensors"], queryFn: () => apiGet<unknown>("/sensors") })
  const rawQuery = useQuery({ queryKey: ["measurements-raw"], queryFn: () => apiGet<unknown>("/measurements/raw?limit=100") })
  const cleanQuery = useQuery({ queryKey: ["measurements-clean"], queryFn: () => apiGet<unknown>("/measurements/clean?limit=100") })
  const timeseriesQuery = useQuery({
    queryKey: ["pond-timeseries", form.pond_id || selectedPondId],
    queryFn: () => apiGet<unknown>(`/ponds/${form.pond_id || selectedPondId}/timeseries`),
    enabled: Boolean(form.pond_id || selectedPondId),
  })
  const mutation = useMutation({
    mutationFn: () =>
      apiPost<unknown>("/measurements/ingest", {
        time: new Date().toISOString(),
        farm_id: form.farm_id || selectedFarmId,
        pond_id: form.pond_id || selectedPondId || null,
        sensor_id: form.sensor_id || null,
        variable_code: form.variable_code,
        raw_value: form.raw_value === "" ? null : Number(form.raw_value),
        raw_unit: form.raw_unit || null,
        source_type: form.source_type,
      }),
    onSuccess: (payload) => {
      setResult(payload)
      queryClient.invalidateQueries({ queryKey: ["measurements-raw"] })
      queryClient.invalidateQueries({ queryKey: ["measurements-clean"] })
      queryClient.invalidateQueries({ queryKey: ["pond-timeseries", form.pond_id || selectedPondId] })
      queryClient.invalidateQueries({ queryKey: ["pond-state", form.pond_id || selectedPondId] })
    },
  })
  const ponds = unwrapList(pondsQuery.data).filter((pond) => !(form.farm_id || selectedFarmId) || pond.farm_id === (form.farm_id || selectedFarmId))
  const sensors = unwrapList(sensorsQuery.data).filter((sensor) => !(form.pond_id || selectedPondId) || sensor.pond_id === (form.pond_id || selectedPondId))
  const rawRows = unwrapList(rawQuery.data).filter((row) => !selectedPondId || row.pond_id === selectedPondId)
  const cleanRows = unwrapList(cleanQuery.data).filter((row) => !selectedPondId || row.pond_id === selectedPondId)
  const invalidValue = form.raw_value !== "" && !Number.isFinite(Number(form.raw_value))
  const setField = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }))

  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ingesta manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={form.farm_id || selectedFarmId || "none"} onValueChange={(value) => setField("farm_id", value === "none" ? "" : value)}>
            <SelectTrigger><SelectValue placeholder="granja" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">sin datos</SelectItem>
              {unwrapList(farmsQuery.data).map((farm) => <SelectItem key={pickId(farm)} value={pickId(farm)}>{pickName(farm)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.pond_id || selectedPondId || "none"} onValueChange={(value) => setField("pond_id", value === "none" ? "" : value)}>
            <SelectTrigger><SelectValue placeholder="estanque" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">sin datos</SelectItem>
              {ponds.map((pond) => <SelectItem key={pickId(pond)} value={pickId(pond)}>{pickName(pond)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.sensor_id || "none"} onValueChange={(value) => setField("sensor_id", value === "none" ? "" : value)}>
            <SelectTrigger><SelectValue placeholder="sensor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">sin sensor</SelectItem>
              {sensors.map((sensor) => <SelectItem key={pickId(sensor)} value={pickId(sensor)}>{String(pickValue(sensor, ["sensor_code", "variable_code", "id"]) ?? "sensor")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.variable_code} onValueChange={(value) => setField("variable_code", value)}>
            <SelectTrigger><SelectValue placeholder="variable" /></SelectTrigger>
            <SelectContent>{variables.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={form.raw_value} onChange={(event) => setField("raw_value", event.target.value)} placeholder="valor" />
          <Input value={form.raw_unit} onChange={(event) => setField("raw_unit", event.target.value)} placeholder="unidad" />
          <Input value={form.source_type} onChange={(event) => setField("source_type", event.target.value)} placeholder="fuente" />
          {invalidValue ? <div className="text-xs text-destructive">valor invalido</div> : null}
          <Button className="w-full" disabled={invalidValue || mutation.isPending || !(form.farm_id || selectedFarmId) || !form.variable_code} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "guardando" : "registrar medicion"}
          </Button>
          {mutation.error ? <div className="text-xs text-destructive">{mutation.error.message}</div> : null}
          {result ? <JsonBlock value={result} title="respuesta API" /> : null}
        </CardContent>
      </Card>
      <section className="space-y-4">
        <TimeSeriesChart data={timeseriesQuery.data} title="Serie temporal del estanque" />
        <div className="grid gap-4 xl:grid-cols-2">
          <AutoTable title="Mediciones raw" data={rawRows} columns={["time", "variable_code", "raw_value", "raw_unit", "source_type"]} isLoading={rawQuery.isLoading} error={rawQuery.error} />
          <AutoTable title="Mediciones clean" data={cleanRows} columns={["time", "variable_code", "clean_value", "standard_unit", "quality_flag"]} isLoading={cleanQuery.isLoading} error={cleanQuery.error} />
        </div>
      </section>
    </div>
  )
}
