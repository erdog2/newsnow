import type { NewsItem } from "@shared/types"

export default defineSource(async () => {
  // venturebeat.com sits behind a Vercel bot checkpoint, so go through Google News instead
  const data = await rss2json("https://news.google.com/rss/search?q=site:venturebeat.com+when:7d&hl=en-US&gl=US&ceid=US:en")
  if (!data?.items.length) throw new Error("Cannot fetch rss data")
  return data.items
    .map<NewsItem>(item => ({
      id: item.link,
      title: item.title.replace(/ - VentureBeat$/, ""),
      url: item.link,
      pubDate: item.created,
    }))
    .sort((a, b) => new Date(b.pubDate!).valueOf() - new Date(a.pubDate!).valueOf())
})
