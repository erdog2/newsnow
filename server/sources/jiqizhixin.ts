import type { NewsItem } from "@shared/types"

interface Res {
  articles: {
    id: string
    title: string
    slug: string
    publishedAt: string
    content?: string
  }[]
}

export default defineSource(async () => {
  const res: Res = await myFetch("https://www.jiqizhixin.com/api/article_library/articles.json?sort=time&page=1&per=30")
  // article pages on jiqizhixin.com now only show a landing page, so link to the WeChat copy via Sogou search
  return res.articles.map<NewsItem>(article => ({
    id: article.id,
    title: article.title,
    url: `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(article.title)}`,
    pubDate: parseRelativeDate(article.publishedAt, "Asia/Shanghai").valueOf(),
    extra: {
      hover: article.content?.slice(0, 120) || undefined,
    },
  }))
})
