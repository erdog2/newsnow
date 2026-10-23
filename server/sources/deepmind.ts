import type { NewsItem } from "@shared/types"

export default defineSource(async () => {
  const data = await rss2json("https://deepmind.google/blog/rss.xml")
  if (!data?.items.length) throw new Error("Cannot fetch rss data")
  return data.items
    .map<NewsItem>(item => ({
      id: item.link,
      title: item.title,
      url: item.link,
      pubDate: item.created,
      extra: {
        hover: item.description || undefined,
      },
    }))
    .filter(item => item.title && item.url)
    .slice(0, 30)
})
