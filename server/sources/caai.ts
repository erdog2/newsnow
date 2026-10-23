import type { NewsItem } from "@shared/types"
import { load } from "cheerio"

export default defineSource(async () => {
  const baseURL = "https://www.caai.cn"
  const html: any = await myFetch(`${baseURL}/site/term/13.html`)
  const $ = load(html)
  const news: NewsItem[] = []
  $(".news-list-page li a").each((_, el) => {
    const $el = $(el)
    const href = $el.attr("href")
    const title = $el.find("h4").text().trim()
    if (!href || !title) return
    const date = $el.find(".date").text().trim()
    news.push({
      id: href,
      title,
      url: new URL(href, baseURL).href,
      pubDate: date ? parseRelativeDate(date, "Asia/Shanghai").valueOf() : undefined,
    })
  })
  return news
})
