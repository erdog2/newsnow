import type { NewsItem } from "@shared/types"
import { load } from "cheerio"

export default defineSource(async () => {
  const baseURL = "https://www.anthropic.com"
  const html: any = await myFetch(`${baseURL}/news`)
  const $ = load(html)
  const news: NewsItem[] = []
  $("[class*='TableView'][class*='__summary']").each((_, el) => {
    const $el = $(el)
    const href = $el.find("a[class*='__title-link']").attr("href")
    const title = $el.find("a[class*='__title-link'] h3").text().trim()
    if (!href || !title) return
    const date = $el.find("[class*='__date'] time").text().trim()
    news.push({
      id: href,
      title,
      url: new URL(href, baseURL).href,
      pubDate: date ? new Date(date).valueOf() : undefined,
      extra: {
        hover: $el.find("[class*='__description'] p").text().trim() || undefined,
        info: $el.find("[class*='__category'] a").text().trim() || undefined,
      },
    })
  })
  return news
})
