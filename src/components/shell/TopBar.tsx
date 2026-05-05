import { useQuery } from "@tanstack/react-query"

import { StatusBadge } from "@/components/common/StatusBadge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { APP_CONFIG } from "@/config/app"
import { apiGet } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { pickId, pickName, pickValue, unwrapList, unwrapObject } from "@/lib/normalize"

interface TopBarProps {
  selectedFarmId: string
  selectedPondId: string
  onFarmChange: (farmId: string) => void
  onPondChange: (pondId: string) => void
}

export function TopBar({ selectedFarmId, selectedPondId, onFarmChange, onPondChange }: TopBarProps) {
  const health = useQuery({ queryKey: ["health"], queryFn: () => apiGet<unknown>("/health"), refetchInterval: APP_CONFIG.refreshMs })
  const farmsQuery = useQuery({ queryKey: ["farms"], queryFn: () => apiGet<unknown>("/farms") })
  const pondsQuery = useQuery({ queryKey: ["ponds"], queryFn: () => apiGet<unknown>("/ponds") })
  const farms = unwrapList(farmsQuery.data)
  const ponds = unwrapList(pondsQuery.data).filter((pond) => !selectedFarmId || pickValue(pond, ["farm_id"]) === selectedFarmId)
  const healthObject = unwrapObject(health.data)
  const lastUpdated = pickValue(healthObject, ["timestamp"]) ?? health.dataUpdatedAt

  return (
    <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3">
      <div className="min-w-56 flex-1">
        <div className="text-sm font-semibold">{APP_CONFIG.name}</div>
        <div className="text-xs text-muted-foreground">ultima actualizacion: {formatDate(lastUpdated)}</div>
      </div>
      <StatusBadge value={health.isSuccess ? "ok" : health.isError ? "down" : "pending"} />
      <Select value={selectedFarmId || "none"} onValueChange={(value) => onFarmChange(value === "none" ? "" : value)}>
        <SelectTrigger className="h-9 w-56">
          <SelectValue placeholder="granja" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">sin datos</SelectItem>
          {farms.map((farm) => (
            <SelectItem key={pickId(farm)} value={pickId(farm)}>
              {pickName(farm)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedPondId || "none"} onValueChange={(value) => onPondChange(value === "none" ? "" : value)}>
        <SelectTrigger className="h-9 w-56">
          <SelectValue placeholder="estanque" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">sin datos</SelectItem>
          {ponds.map((pond) => (
            <SelectItem key={pickId(pond)} value={pickId(pond)}>
              {pickName(pond)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </header>
  )
}
