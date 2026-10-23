import type { NewsItem } from "@shared/types"
import { load } from "cheerio"

const decode = (s: string) => load(s).text().trim()

export default defineSource(async () => {
  // cheerio misses most of the cards, so match the raw HTML; without browser headers the site returns 400
  const html: string = await myFetch("https://ai.meta.com/blog/", {
    responseType: "text",
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    },
  })
  const news: NewsItem[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/href="(https:\/\/ai\.meta\.com\/blog\/[^"?#]+)"[^>]*>\s*<span[^>]*>Learn More/g)) {
    const url = m[1]
    if (seen.has(url)) continue
    const before = html.slice(Math.max(0, m.index - 4000), m.index)
    const title = [...before.matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].pop()?.[1]
    const date = [...before.matchAll(/>([A-Z][a-z]+ \d{1,2}, \d{4})</g)].pop()?.[1]
    if (!title) continue
    seen.add(url)
    news.push({
      id: url,
      title: decode(title),
      url,
      pubDate: date ? new Date(date).valueOf() : undefined,
    })
  }
  if (!news.length) throw new Error("Cannot parse meta ai blog")
  return news.sort((a, b) => Number(b.pubDate ?? 0) - Number(a.pubDate ?? 0))
})
