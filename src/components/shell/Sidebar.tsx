import { Activity, Bell, Bot, Database, Fish, Gauge, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { navigationItems, type ViewId } from "@/config/navigation"
import { cn } from "@/lib/utils"

interface SidebarProps {
  selectedView: ViewId
  onViewChange: (view: ViewId) => void
}

const icons = {
  operation: Gauge,
  management: Fish,
  ingest: Database,
  digitalTwin: Activity,
  models: Bot,
  alerts: Bell,
  actuation: Settings2,
}

export function Sidebar({ selectedView, onViewChange }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar p-3">
      <div className="px-2 py-3">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">operacion</div>
        <div className="text-lg font-semibold">Acuicola IoT</div>
      </div>
      <nav className="mt-2 space-y-1">
        {navigationItems.map((item) => {
          const Icon = icons[item.id]
          return (
            <Button
              key={item.id}
              variant={selectedView === item.id ? "secondary" : "ghost"}
              className={cn("h-9 w-full justify-start gap-2 text-sm", selectedView === item.id && "bg-accent")}
              onClick={() => onViewChange(item.id)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
