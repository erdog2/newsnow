import type { NewsItem } from "@shared/types"

interface DailyPaper {
  title: string
  publishedAt: string
  numComments: number
  paper: {
    id: string
    upvotes: number
    ai_summary?: string
  }
}

export default defineSource(async () => {
  const data: DailyPaper[] = await myFetch("https://huggingface.co/api/daily_papers")
  return data
    .sort((a, b) => b.paper.upvotes - a.paper.upvotes)
    .map<NewsItem>(item => ({
      id: item.paper.id,
      title: item.title,
      url: `https://huggingface.co/papers/${item.paper.id}`,
      extra: {
        info: `${item.paper.upvotes} upvotes`,
        hover: item.paper.ai_summary,
      },
    }))
})
