import axios from "axios"

import { APP_CONFIG } from "@/config/app"

const client = axios.create({
  baseURL: APP_CONFIG.apiBaseUrl,
  timeout: 60_000,
})

function getMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail)) return detail.map((item) => item.msg ?? "error de validacion").join(", ")
    if (error.response?.status) return `error de API ${error.response.status}`
    return "API caida o sin respuesta"
  }
  return error instanceof Error ? error.message : "error inesperado"
}

async function request<T>(promise: Promise<{ data: T }>) {
  if (!APP_CONFIG.apiBaseUrl) throw new Error("VITE_API_BASE_URL no configurada")
  try {
    const response = await promise
    return response.data
  } catch (error) {
    throw new Error(getMessage(error))
  }
}

export function apiGet<T>(endpoint: string): Promise<T> {
  return request(client.get<T>(endpoint))
}

export function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  return request(client.post<T>(endpoint, body))
}

export function apiPut<T>(endpoint: string, body?: unknown): Promise<T> {
  return request(client.put<T>(endpoint, body))
}

export function apiDelete<T>(endpoint: string): Promise<T> {
  return request(client.delete<T>(endpoint))
}
