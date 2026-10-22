import type { NewsItem } from "@shared/types"
import { load } from "cheerio"

export default defineSource(async () => {
  const baseURL = "https://www.aibase.com"
  const html: any = await myFetch(`${baseURL}/zh/news`)
  const $ = load(html)
  const news: NewsItem[] = []
  $("a[href^='/news/']").each((_, el) => {
    const $el = $(el)
    const id = $el.attr("href")?.split("/").pop()
    const title = $el.find("h3").text().trim()
    if (!id || !title) return
    const relativeDate = $el.find("h3").parent().prev().find("span").first().text().trim()
    news.push({
      id,
      title,
      url: `${baseURL}/zh/news/${id}`,
      extra: {
        hover: $el.find("h3").parent().next().text().trim() || undefined,
        date: relativeDate ? parseRelativeDate(relativeDate, "Asia/Shanghai").valueOf() : undefined,
      },
    })
  })
  return news
})
