import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

function readRequestBody(request: import("node:http").IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    request.on("end", () => resolve(Buffer.concat(chunks)))
    request.on("error", reject)
  })
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, init: RequestInit, retryable: boolean) {
  let lastError: unknown
  const attempts = retryable ? 3 : 1
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, init)
    } catch (error) {
      lastError = error
      if (attempt < attempts) await wait(180 * attempt)
    }
  }
  throw lastError
}

function apiDevProxy(targetUrl: string) {
  const target = targetUrl.replace(/\/$/, "")
  return {
    name: "aquatwin-api-dev-proxy",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/v1", async (request, response) => {
        try {
          const method = request.method ?? "GET"
          const upstreamUrl = `${target}/api/v1${request.url ?? ""}`
          const headers = new Headers()
          Object.entries(request.headers).forEach(([key, value]) => {
            const lower = key.toLowerCase()
            if (["host", "connection", "content-length", "origin", "referer", "user-agent"].includes(lower)) return
            if (Array.isArray(value)) headers.set(key, value.join(", "))
            else if (value) headers.set(key, value)
          })
          headers.set("user-agent", "")
          const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(request)
          const upstream = await fetchWithRetry(upstreamUrl, { method, headers, body, redirect: "manual" }, method === "GET" || method === "HEAD")
          response.statusCode = upstream.status
          upstream.headers.forEach((value, key) => {
            if (["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) return
            response.setHeader(key, value)
          })
          response.end(Buffer.from(await upstream.arrayBuffer()))
        } catch (error) {
          console.error("[aquatwin-api-dev-proxy]", error)
          response.statusCode = 502
          response.setHeader("content-type", "application/json; charset=utf-8")
          response.end(JSON.stringify({ detail: "API proxy error", upstream: target }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiTargetUrl = env.VITE_API_TARGET_URL || "http://37.60.226.53:8000"
  return {
    plugins: [react(), tailwindcss(), apiDevProxy(apiTargetUrl)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
