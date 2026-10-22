import process from "node:process"
import type { NewsItem } from "@shared/types"

const ORIGIN = "https://linux.do"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

const isWorkers = globalThis.navigator?.userAgent === "Cloudflare-Workers"

// linux.do 的 Cloudflare 会拦截 HTTP/1.1 请求（403），Node 下可以直接走 HTTP/2
async function viaHttp2(path: string, timeout = 15000) {
  const { connect } = await import("node:http2")
  return new Promise<string>((resolve, reject) => {
    const client = connect(ORIGIN)
    const timer = setTimeout(() => {
      client.destroy()
      reject(new Error(`linux.do ${path}: timeout`))
    }, timeout)
    const done = (fn: () => void) => {
      clearTimeout(timer)
      client.close()
      fn()
    }
    client.on("error", e => done(() => reject(e)))
    const req = client.request({
      ":path": path,
      "user-agent": UA,
      "accept": "application/rss+xml, application/xml, text/xml, */*",
    })
    let status = 0
    let body = ""
    req.setEncoding("utf8")
    req.on("response", (headers) => {
      status = Number(headers[":status"])
    })
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => done(() => (status === 200 ? resolve(body) : reject(new Error(`linux.do ${path}: ${status}`)))))
    req.on("error", e => done(() => reject(e)))
    req.end()
  })
}

async function viaFetch(path: string) {
  return await myFetch<string>(`${ORIGIN}${path}`, { responseType: "text", retry: 0 })
}

// Cloudflare Workers 等无法使用 HTTP/2 客户端的环境，经 r.jina.ai 中转；X-Return-Format: html 时原样返回 RSS
async function viaJina(path: string) {
  const headers: Record<string, string> = { "X-Return-Format": "html" }
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
  return await myFetch<string>(`https://r.jina.ai/${ORIGIN}${path}`, { responseType: "text", headers, retry: 1, timeout: 20000 })
}

// 自建中转，例如 LINUXDO_PROXY=https://my-relay.example.com/?url={url}
async function viaProxy(path: string) {
  const tpl = process.env.LINUXDO_PROXY!
  const target = `${ORIGIN}${path}`
  const url = tpl.includes("{url}") ? tpl.replace("{url}", encodeURIComponent(target)) : `${tpl.replace(/\/$/, "")}${path}`
  return await myFetch<string>(url, { responseType: "text", retry: 1 })
}

async function getFeed(path: string) {
  const strategies = [
    process.env.LINUXDO_PROXY && viaProxy,
    !isWorkers && viaHttp2,
    isWorkers && viaFetch,
    viaJina,
  ].filter(Boolean) as ((path: string) => Promise<string>)[]

  let lastError: unknown
  for (const fn of strategies) {
    try {
      const text = await fn(path)
      if (typeof text === "string" && text.includes("<item>")) return text
      lastError = new Error(`linux.do ${path}: ${fn.name} returned no items`)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

async function fetchFeed(path: string, withDate: boolean): Promise<NewsItem[]> {
  const data = parseRSS(await getFeed(path))
  if (!data.items.length) throw new Error("Cannot fetch linux.do feed")
  return data.items.map((item: any) => {
    const category = Array.isArray(item.category) ? item.category[0] : item.category
    return {
      id: item.link,
      title: item.title,
      url: item.link,
      pubDate: withDate ? item.created : undefined,
      extra: {
        info: typeof category === "string" ? category : undefined,
      },
    }
  })
}

const hot = defineSource(() => fetchFeed("/top.rss?period=daily", false))
const latest = defineSource(() => fetchFeed("/latest.rss", true))

export default defineSource({
  "linuxdo": latest,
  "linuxdo-latest": latest,
  "linuxdo-hot": hot,
})
