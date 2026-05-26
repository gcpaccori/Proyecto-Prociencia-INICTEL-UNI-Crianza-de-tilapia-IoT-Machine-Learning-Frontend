const DEFAULT_TARGET = "http://37.60.226.53:8000"

function targetBaseUrl() {
  return (process.env.API_TARGET_URL || process.env.VITE_API_TARGET_URL || DEFAULT_TARGET).replace(/\/$/, "")
}

function cleanHeaders(requestHeaders) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(requestHeaders)) {
    if (!value) continue
    const lower = key.toLowerCase()
    if (["host", "connection", "content-length", "origin", "referer", "user-agent"].includes(lower)) continue
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "))
    } else {
      headers.set(key, String(value))
    }
  }
  headers.set("user-agent", "")
  return headers
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on("data", (chunk) => chunks.push(chunk))
    request.on("end", () => resolve(Buffer.concat(chunks)))
    request.on("error", reject)
  })
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204
    response.setHeader("Access-Control-Allow-Origin", "*")
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    response.end()
    return
  }

  const rawPath = Array.isArray(request.query.path) ? request.query.path.join("/") : request.query.path || ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(request.query)) {
    if (key === "path") continue
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item))
    } else if (value !== undefined) {
      search.set(key, String(value))
    }
  }

  const suffix = search.toString() ? `?${search.toString()}` : ""
  const upstreamUrl = `${targetBaseUrl()}/api/v1/${rawPath}${suffix}`
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readBody(request)
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: cleanHeaders(request.headers),
    body,
    redirect: "manual",
  })

  response.statusCode = upstream.status
  upstream.headers.forEach((value, key) => {
    if (["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) return
    response.setHeader(key, value)
  })
  response.setHeader("Access-Control-Allow-Origin", "*")

  const buffer = Buffer.from(await upstream.arrayBuffer())
  response.end(buffer)
}
