import type { NewsItem } from "@shared/types"
import { load } from "cheerio"

// 小红书官方热榜需要登录和签名，改用今日热榜（tophub）转载的数据
export default defineSource(async () => {
  const html: any = await myFetch("https://tophub.today/n/L4MdA5ldxD")
  const $ = load(html)
  const news: NewsItem[] = []
  $("table.table").first().find("tr").each((_, el) => {
    const $a = $(el).find("td").eq(1).find("a")
    const title = $a.text().trim()
    if (!title) return
    news.push({
      id: title,
      title,
      url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(title)}`,
      extra: {
        info: $(el).find("td.ws").text().trim() || undefined,
      },
    })
  })
  if (!news.length) throw new Error("Cannot fetch xiaohongshu hot list")
  return news
})
