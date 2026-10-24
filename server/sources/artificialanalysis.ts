import type { NewsItem } from "@shared/types"

const baseURL = "https://artificialanalysis.ai"

const creatorNames: Record<string, string> = {
  "Google": "谷歌",
  "Microsoft AI": "微软 AI",
  "Alibaba": "阿里巴巴",
  "ByteDance Seed": "字节跳动",
  "Kimi": "月之暗面",
  "DeepSeek": "深度求索",
  "Z AI": "智谱",
  "Xiaomi": "小米",
  "Tencent": "腾讯",
  "StepFun": "阶跃星辰",
  "China Mobile": "中国移动",
  "Baidu": "百度",
  "Kuaishou": "快手",
  "Meituan": "美团",
  "NVIDIA": "英伟达",
}
const creator = (name?: string) => (name && creatorNames[name]) ?? name ?? "未知"

// The leaderboard data is only available as the Next.js RSC payload embedded in the page.
// Pages are ~2MB, so only the chunks containing `marker` are decoded to stay within Workers CPU limits.
async function fetchPayload(path: string, marker: string, done?: (payload: string) => boolean) {
  const html: string = await myFetch(`${baseURL}${path}`, { responseType: "text" })
  const escaped = JSON.stringify(marker).slice(1, -1)
  let payload = ""
  for (const chunk of html.split("self.__next_f.push([1,\"").slice(1)) {
    if (!chunk.includes(escaped)) continue
    // Next.js escapes `<` inside the payload, so `"])</script>` only appears at the real end
    payload += JSON.parse(`"${chunk.slice(0, chunk.indexOf("\"])</script>"))}"`)
    if (done?.(payload)) break
  }
  return payload
}

function objectAt(s: string, start: number) {
  let depth = 0
  for (let j = start; j < s.length; j++) {
    if (s[j] === "{") {
      depth++
    } else if (s[j] === "}" && --depth === 0) {
      try {
        return { obj: JSON.parse(s.slice(start, j + 1)), end: j }
      } catch {
        return { obj: undefined, end: j }
      }
    }
  }
  return { obj: undefined, end: s.length }
}

interface LLM {
  slug: string
  name: string
  modelCreatorName: string
  intelligenceIndex: number
  intelligenceIndexIsEstimated: boolean
  deprecated: boolean
  isOpenWeights: boolean
  isReasoning: boolean
  contextWindowTokens: number | null
  price1mInputTokens: number | null
  price1mOutputTokens: number | null
}

const llm = defineSource(async () => {
  const s = await fetchPayload("/leaderboards/models", "\"intelligenceIndex\":")
  const models = new Map<string, LLM>()
  for (let i = s.indexOf("\"intelligenceIndex\":"); i !== -1; i = s.indexOf("\"intelligenceIndex\":", i + 1)) {
    let depth = 0
    let k = i
    for (; k > 0; k--) {
      if (s[k] === "}") depth++
      else if (s[k] === "{" && depth-- === 0) break
    }
    const { obj } = objectAt(s, k)
    if (obj?.slug && typeof obj.intelligenceIndex === "number") models.set(obj.slug, obj)
  }
  return [...models.values()]
    .filter(m => !m.deprecated && !m.intelligenceIndexIsEstimated)
    .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)
    .map<NewsItem>((m, i) => {
      const score = m.intelligenceIndex.toFixed(1)
      return {
        id: m.slug,
        title: m.name,
        url: `${baseURL}/models/${m.slug}`,
        extra: {
          info: `${creator(m.modelCreatorName)} · 智能指数 ${score}`,
          hover: [
            `第 ${i + 1} 名：${m.name}`,
            `厂商：${creator(m.modelCreatorName)}`,
            `智能指数：${score}`,
            `权重：${m.isOpenWeights ? "开源" : "闭源"}${m.isReasoning ? " · 推理模型" : ""}`,
            m.contextWindowTokens ? `上下文：${(m.contextWindowTokens / 1000).toLocaleString("zh-CN")}K tokens` : undefined,
            m.price1mInputTokens != null && m.price1mOutputTokens != null
              ? `价格：输入 $${m.price1mInputTokens} / 输出 $${m.price1mOutputTokens}（每百万 tokens）`
              : undefined,
          ].filter(Boolean).join("\n"),
        },
      }
    })
})

interface ArenaModel {
  id: string
  name: string
  url?: string
  rank: number
  elo: number
  appearances: number
  ciDelta?: number
  releaseDate?: string
  creator?: { name: string }
  openWeights?: boolean
}

function arena(path: string) {
  return defineSource(async () => {
    // stop once a second table (another rank 0) has started
    const s = await fetchPayload(path, "\"values\":{\"id\":", p => (p.match(/"values":\{"id":"[^"]*","name":"(?:[^"\\]|\\.)*",(?:"url":"[^"]*",)?"rank":0,/g)?.length ?? 0) > 1)
    // the page holds one table per category; the first one is the overall leaderboard
    const rows: ArenaModel[] = []
    for (let i = s.indexOf("\"values\":{\"id\":"); i !== -1; i = s.indexOf("\"values\":{\"id\":", i)) {
      const { obj, end } = objectAt(s, i + 9)
      i = end
      if (!obj) continue
      if (obj.rank === 0 && rows.length) break
      rows.push(obj)
    }
    if (!rows.length) throw new Error(`Cannot parse ${path}`)
    return rows
      .sort((a, b) => a.rank - b.rank)
      .map<NewsItem>(m => ({
        id: m.id,
        title: m.name,
        url: m.url ? new URL(m.url, baseURL).href : `${baseURL}${path}`,
        extra: {
          info: `${creator(m.creator?.name)} · Elo ${Math.round(m.elo)}`,
          hover: [
            `第 ${m.rank + 1} 名：${m.name}`,
            `厂商：${creator(m.creator?.name)}`,
            `Elo：${m.elo.toFixed(0)}${m.ciDelta ? `（±${m.ciDelta}）` : ""}`,
            `投票数：${m.appearances.toLocaleString("zh-CN")}`,
            m.openWeights === undefined ? undefined : `权重：${m.openWeights ? "开源" : "闭源"}`,
            m.releaseDate ? `发布：${m.releaseDate}` : undefined,
          ].filter(Boolean).join("\n"),
        },
      }))
  })
}

export default defineSource({
  "artificialanalysis": llm,
  "artificialanalysis-llm": llm,
  "artificialanalysis-image": arena("/image/leaderboard/text-to-image"),
  "artificialanalysis-video": arena("/video/leaderboard/text-to-video"),
  "artificialanalysis-speech": arena("/text-to-speech/leaderboard"),
})
