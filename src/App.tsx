import { useState, type ReactNode } from "react"

import { AppShell } from "@/components/shell/AppShell"
import { navigationItems, type ViewId } from "@/config/navigation"
import { ActuationView } from "@/features/actuation/ActuationView"
import { AlertsView } from "@/features/alerts/AlertsView"
import { DigitalTwinView } from "@/features/digital-twin/DigitalTwinView"
import { IngestView } from "@/features/ingest/IngestView"
import { ManagementView } from "@/features/management/ManagementView"
import { ModelsView } from "@/features/models/ModelsView"
import { OperationView } from "@/features/operation/OperationView"

const initialView = navigationItems[0].id

export interface ViewContext {
  selectedFarmId: string
  selectedPondId: string
}

function getStored(key: string) {
  return localStorage.getItem(key) ?? ""
}

export function App() {
  const [selectedView, setSelectedView] = useState<ViewId>(initialView)
  const [selectedFarmId, setSelectedFarmId] = useState(() => getStored("selectedFarmId"))
  const [selectedPondId, setSelectedPondId] = useState(() => getStored("selectedPondId"))

  const changeFarm = (farmId: string) => {
    setSelectedFarmId(farmId)
    localStorage.setItem("selectedFarmId", farmId)
    if (!farmId) {
      setSelectedPondId("")
      localStorage.removeItem("selectedPondId")
    }
  }

  const changePond = (pondId: string) => {
    setSelectedPondId(pondId)
    localStorage.setItem("selectedPondId", pondId)
  }

  const context = { selectedFarmId, selectedPondId }
  const views: Record<ViewId, ReactNode> = {
    operation: <OperationView {...context} />,
    management: <ManagementView />,
    ingest: <IngestView {...context} />,
    digitalTwin: <DigitalTwinView {...context} />,
    models: <ModelsView {...context} />,
    alerts: <AlertsView {...context} />,
    actuation: <ActuationView {...context} />,
  }

  return (
    <AppShell
      selectedView={selectedView}
      selectedFarmId={selectedFarmId}
      selectedPondId={selectedPondId}
      onViewChange={setSelectedView}
      onFarmChange={changeFarm}
      onPondChange={changePond}
    >
      {views[selectedView]}
    </AppShell>
  )
}
