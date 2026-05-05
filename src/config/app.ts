export const APP_CONFIG = {
  name: "Centro de Operacion Acuicola",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://37.60.226.53:8000/api/v1",
  apiTargetUrl: import.meta.env.VITE_API_TARGET_URL || "http://37.60.226.53:8000",
  refreshMs: 30_000,
}
