import type { NewsItem } from "@shared/types"
import { load } from "cheerio"

// x.com 必须登录才能浏览，热门话题改用 trends24.in 每小时汇总的数据
function trends(region: string) {
  return defineSource(async () => {
    const html: any = await myFetch(`https://trends24.in/${region}`)
    const $ = load(html)
    const news: NewsItem[] = []
    $(".list-container").first().find("ol.trend-card__list li").each((_, el) => {
      const $a = $(el).find("a.trend-link")
      const title = $a.text().trim()
      if (!title) return
      const query = encodeURIComponent(title)
      const count = $(el).find(".tweet-count").attr("data-count")
      news.push({
        id: title,
        title,
        url: `https://x.com/search?q=${query}`,
        mobileUrl: `https://x.com/search?q=${query}`,
        extra: {
          info: count ? `${Number(count).toLocaleString("en-US")} posts` : undefined,
        },
      })
    })
    if (!news.length) throw new Error("Cannot fetch X trends")
    return news
  })
}

const global = trends("")

export default defineSource({
  "x": global,
  "x-global": global,
  "x-us": trends("united-states/"),
  "x-japan": trends("japan/"),
})
