const categoryNames: Record<string, string> = {
  daily: "日常",
  tech: "技术",
  info: "情报",
  review: "测评",
  trade: "交易",
  carpool: "拼车",
  promotion: "推广",
  life: "生活",
  dev: "Dev",
  photo: "贴图",
  expose: "曝光",
  sandbox: "沙盒",
}

export default defineSource(async () => {
  const data = await rss2json("https://rss.nodeseek.com/")
  if (!data?.items.length) throw new Error("Cannot fetch nodeseek feed")
  return data.items.map((item: any) => {
    const category = Array.isArray(item.category) ? item.category[0] : item.category
    return {
      id: item.link,
      title: item.title,
      url: item.link,
      pubDate: item.created,
      extra: {
        info: typeof category === "string" ? categoryNames[category] ?? category : undefined,
        hover: typeof item.description === "string" ? item.description : undefined,
      },
    }
  })
})
