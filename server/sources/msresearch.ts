import type { NewsItem } from "@shared/types"

export default defineSource(async () => {
  const data = await rss2json("https://www.microsoft.com/en-us/research/feed/")
  if (!data?.items.length) throw new Error("Cannot fetch rss data")
  return data.items
    .map<NewsItem>(item => ({
      id: item.link,
      title: item.title,
      url: item.link,
      pubDate: item.created,
    }))
    .filter(item => item.title && item.url)
})
