import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { AutoTable } from "@/components/common/AutoTable"
import { JsonBlock } from "@/components/common/JsonBlock"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { resources, type ResourceConfig } from "@/config/resources"
import { apiGet, apiPost } from "@/lib/api"
import type { Row } from "@/lib/normalize"
import { pickId, unwrapList } from "@/lib/normalize"

function initialForm(resource: ResourceConfig) {
  return Object.fromEntries(resource.createFields.map((field) => [field.name, field.defaultValue ?? ""]))
}

function cleanBody(resource: ResourceConfig, form: Record<string, string>) {
  return Object.fromEntries(
    resource.createFields
      .map((field) => {
        const raw = form[field.name]?.trim()
        if (!raw && !field.required) return null
        return [field.name, field.type === "number" ? Number(raw) : raw]
      })
      .filter(Boolean) as [string, unknown][],
  )
}

function ResourcePanel({ resource }: { resource: ResourceConfig }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => initialForm(resource))
  const [detail, setDetail] = useState<Row | null>(null)
  const rowsQuery = useQuery({ queryKey: [resource.id], queryFn: () => apiGet<unknown>(resource.endpoint) })
  const createMutation = useMutation({
    mutationFn: () => apiPost<unknown>(resource.createEndpoint, cleanBody(resource, form)),
    onSuccess: () => {
      setForm(initialForm(resource))
      queryClient.invalidateQueries({ queryKey: [resource.id] })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Crear {resource.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resource.createFields.map((field) => (
            <Input
              key={field.name}
              type={field.type ?? "text"}
              placeholder={`${field.label}${field.required ? " *" : ""}`}
              value={form[field.name] ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
            />
          ))}
          <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "guardando" : "guardar"}
          </Button>
          {createMutation.error ? <div className="text-xs text-destructive">{createMutation.error.message}</div> : null}
        </CardContent>
      </Card>
      <AutoTable
        title={resource.label}
        data={unwrapList(rowsQuery.data)}
        columns={resource.columns}
        isLoading={rowsQuery.isLoading}
        error={rowsQuery.error}
        emptyMessage="sin datos"
        onRowClick={setDetail}
      />
      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{detail ? `${resource.label} ${pickId(detail)}` : resource.label}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <JsonBlock value={detail} title="detalle" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function ManagementView() {
  const [active, setActive] = useState(resources[0].id)
  const resource = resources.find((item) => item.id === active) ?? resources[0]

  return (
    <Tabs value={active} onValueChange={(value) => setActive(value as typeof active)} className="space-y-4">
      <TabsList className="flex w-full justify-start overflow-auto">
        {resources.map((item) => (
          <TabsTrigger key={item.id} value={item.id}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={resource.id}>
        <ResourcePanel key={resource.id} resource={resource} />
      </TabsContent>
    </Tabs>
  )
}
