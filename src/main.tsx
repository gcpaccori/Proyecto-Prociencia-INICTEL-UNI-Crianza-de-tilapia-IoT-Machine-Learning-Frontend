import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"

import { App } from "./App"
import "./index.css"
import { queryClient } from "./lib/query-client"

document.documentElement.classList.remove("dark")
document.documentElement.style.colorScheme = "light"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
