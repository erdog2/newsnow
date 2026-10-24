import type { NewsItem } from "@shared/types"
import { parquetReadObjects } from "hyparquet"

interface Row {
  model_name: string
  organization: string
  license: string
  score: number
  score_ci_lower: number
  score_ci_upper: number
  session_count: number | null
  rank: bigint
  leaderboard_publish_date: string
}

const orgNames: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "谷歌",
  meta: "Meta",
  xiaomi: "小米",
  xai: "xAI",
  deepseek: "深度求索",
  tencent: "腾讯",
  zai: "智谱",
  moonshot: "月之暗面",
  alibaba: "阿里巴巴",
  stepfun: "阶跃星辰",
  reflection: "Reflection AI",
  mistral: "Mistral",
  minimax: "MiniMax",
  nvidia: "英伟达",
  thinky: "Thinking Machines",
  upstage: "Upstage",
}

const percent = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`

// arena.ai is behind a Cloudflare challenge; this is the official dataset behind the same leaderboard
function leaderboard(config: string, metric: string) {
  return defineSource(async () => {
    const file: ArrayBuffer = await myFetch(`https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main/${config}/latest-00000-of-00001.parquet`, {
      responseType: "arrayBuffer",
    })
    const rows = await parquetReadObjects({ file }) as Row[]
    return rows
      .sort((a, b) => Number(a.rank) - Number(b.rank))
      .map<NewsItem>((row) => {
        const org = orgNames[row.organization] ?? row.organization
        const license = row.license === "Proprietary" ? "闭源" : `开源（${row.license}）`
        const ci = ((row.score_ci_upper - row.score_ci_lower) / 2 * 100).toFixed(2)
        return {
          id: row.model_name,
          title: row.model_name,
          url: "https://arena.ai/leaderboard/agent",
          extra: {
            info: `${org} · ${metric} ${percent(row.score)}`,
            hover: [
              `第 ${row.rank} 名：${row.model_name}`,
              `厂商：${org}`,
              `许可：${license}`,
              `${metric}：${percent(row.score)}（±${ci}%）`,
              row.session_count ? `会话数：${row.session_count.toLocaleString("zh-CN")}` : undefined,
              `榜单日期：${row.leaderboard_publish_date}`,
            ].filter(Boolean).join("\n"),
          },
        }
      })
  })
}

const overall = leaderboard("agent", "净提升")

export default defineSource({
  "arena": overall,
  "arena-overall": overall,
  "arena-steer": leaderboard("agent_steerability", "可控性"),
  "arena-tool": leaderboard("agent_tool_hallucination", "工具可靠"),
})
