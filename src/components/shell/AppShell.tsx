import { useState, type ReactNode } from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import type { ViewId } from "@/config/navigation"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"

interface AppShellProps {
  children: ReactNode
  selectedView: ViewId
  selectedFarmId: string
  selectedPondId: string
  onViewChange: (view: ViewId) => void
  onFarmChange: (farmId: string) => void
  onPondChange: (pondId: string) => void
}

export function AppShell(props: AppShellProps) {
  const [open, setOpen] = useState(false)
  const changeView = (view: ViewId) => {
    props.onViewChange(view)
    setOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden lg:block">
        <Sidebar selectedView={props.selectedView} onViewChange={props.onViewChange} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-border lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="m-2">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <Sidebar selectedView={props.selectedView} onViewChange={changeView} />
            </SheetContent>
          </Sheet>
        </div>
        <TopBar
          selectedFarmId={props.selectedFarmId}
          selectedPondId={props.selectedPondId}
          onFarmChange={props.onFarmChange}
          onPondChange={props.onPondChange}
        />
        <main className="flex-1 overflow-auto p-4">{props.children}</main>
      </div>
    </div>
  )
}
