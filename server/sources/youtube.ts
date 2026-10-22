import type { NewsItem } from "@shared/types"
import { load } from "cheerio"

interface PipedVideo {
  url: string
  type: string
  title: string
  uploaderName: string
  views: number
  isShort: boolean
}

// YouTube 官方「时下流行」已下线，热门视频走 Piped 公共实例
const pipedInstances = ["https://api.piped.private.coffee"]

function formatViews(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿次观看`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万次观看`
  return `${n}次观看`
}

async function kworb(): Promise<NewsItem[]> {
  const html: any = await myFetch("https://kworb.net/youtube/trending.html")
  const $ = load(html)
  const news: NewsItem[] = []
  $("tbody tr").each((_, el) => {
    const $a = $(el).find("td.text a").first()
    const title = $a.text().trim()
    const id = $a.attr("href")?.match(/video\/([\w-]+)\.html/)?.[1]
    if (!title || !id) return
    news.push({
      id,
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      extra: {
        info: $(el).find("td.mp").text().trim() || undefined,
      },
    })
  })
  if (!news.length) throw new Error("Cannot fetch kworb trending")
  return news.slice(0, 30)
}

function trending(region: string) {
  return defineSource(async () => {
    for (const base of pipedInstances) {
      try {
        const res = await myFetch<PipedVideo[]>(`${base}/trending?region=${region}`, { retry: 1 })
        const videos = res.filter(v => v.type === "stream" && v.url?.includes("v="))
        if (videos.length) {
          return videos.map((v) => {
            const id = v.url.split("v=")[1]
            return {
              id,
              title: v.title,
              url: `https://www.youtube.com/watch?v=${id}`,
              extra: {
                info: [v.uploaderName, v.views > 0 ? formatViews(v.views) : ""].filter(Boolean).join(" · "),
              },
            }
          })
        }
      } catch {
        // try next instance
      }
    }
    return kworb()
  })
}

const us = trending("US")

export default defineSource({
  "youtube": us,
  "youtube-us": us,
  "youtube-tw": trending("TW"),
  "youtube-music": defineSource(kworb),
})
