import { useState } from "react"

import { MlopsApp } from "@/features/mlops/MlopsApp"

export interface ViewContext {
  selectedFarmId: string
  selectedPondId: string
  onFarmChange?: (farmId: string) => void
  onPondChange?: (pondId: string) => void
}

function getStored(key: string) {
  return localStorage.getItem(key) ?? ""
}

export function App() {
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

  const context = {
    selectedFarmId,
    selectedPondId,
    onFarmChange: changeFarm,
    onPondChange: changePond,
  }

  return <MlopsApp {...context} />
}
