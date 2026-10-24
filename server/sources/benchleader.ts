import type { NewsItem } from "@shared/types"

interface Row {
  rank: number
  model: string
  effort: string | null
  configuration_id: string
  provider: string
  open_weights: boolean
  index: number
  index_ci: number | null
  reasoning: number | null
  coding: number | null
  agentic: number | null
  math: number | null
  knowledge: number | null
  price_input_usd_per_mtok: number | null
  price_output_usd_per_mtok: number | null
  output_tokens_per_second: number | null
  as_of: string
  url: string
}

const providerNames: Record<string, string> = {
  "Google": "谷歌",
  "Alibaba": "阿里巴巴",
  "Moonshot AI": "月之暗面",
  "DeepSeek": "深度求索",
  "Zhipu AI": "智谱",
  "Xiaomi": "小米",
  "Tencent": "腾讯",
  "StepFun": "阶跃星辰",
  "ByteDance": "字节跳动",
  "Baidu": "百度",
  "Meituan": "美团",
  "Kuaishou": "快手",
  "Ant Group": "蚂蚁集团",
  "China Mobile": "中国移动",
  "NVIDIA": "英伟达",
  "Microsoft": "微软",
  "Amazon": "亚马逊",
}

const categories = [
  ["reasoning", "推理"],
  ["coding", "编程"],
  ["agentic", "Agent"],
  ["math", "数学"],
  ["knowledge", "知识"],
] as const

export default defineSource(async () => {
  const data: { rows: Row[] } = await myFetch("https://www.benchleader.com/data/leaderboard.json")
  // rows are per reasoning effort; keep each model's best configuration, like the site's standings
  const seen = new Set<string>()
  return data.rows
    .sort((a, b) => a.rank - b.rank)
    .filter(row => !seen.has(row.url) && seen.add(row.url))
    .map<NewsItem>((row, i) => {
      const provider = providerNames[row.provider] ?? row.provider
      const title = row.effort ? `${row.model} (${row.effort})` : row.model
      const price = row.price_input_usd_per_mtok != null && row.price_output_usd_per_mtok != null
        ? `价格：输入 $${row.price_input_usd_per_mtok} / 输出 $${row.price_output_usd_per_mtok}（每百万 tokens）`
        : undefined
      return {
        id: row.url,
        title,
        url: row.url,
        extra: {
          info: `${provider} · 评分 ${row.index.toFixed(1)}`,
          hover: [
            `第 ${i + 1} 名：${title}`,
            `厂商：${provider}${row.open_weights ? " · 开源" : ""}`,
            `综合评分：${row.index.toFixed(1)}${row.index_ci ? `（±${row.index_ci.toFixed(1)}）` : ""}`,
            categories
              .filter(([key]) => row[key] != null)
              .map(([key, label]) => `${label} ${row[key]!.toFixed(1)}`)
              .join(" · "),
            price,
            row.output_tokens_per_second ? `速度：${row.output_tokens_per_second} tokens/秒` : undefined,
            `数据日期：${row.as_of}`,
          ].filter(Boolean).join("\n"),
        },
      }
    })
})
