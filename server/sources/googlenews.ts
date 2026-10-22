function feed(query: string) {
  return defineSource(async () => {
    const data = await rss2json(`https://news.google.com/rss?${query}`)
    if (!data?.items.length) throw new Error("Cannot fetch google news")
    return data.items.map((item: any) => {
      const title = String(item.title ?? "")
      const i = title.lastIndexOf(" - ")
      return {
        id: item.link,
        title: i > 0 ? title.slice(0, i) : title,
        url: item.link,
        pubDate: item.created,
        extra: {
          info: i > 0 ? title.slice(i + 3) : undefined,
        },
      }
    })
  })
}

const zh = feed("hl=zh-CN&gl=CN&ceid=CN:zh-Hans")

export default defineSource({
  "googlenews": zh,
  "googlenews-zh": zh,
  "googlenews-us": feed("hl=en-US&gl=US&ceid=US:en"),
})
