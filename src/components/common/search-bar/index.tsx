import { Command } from "cmdk"
import { useMount } from "react-use"
import type { NewsItem, SourceID, SourceResponse } from "@shared/types"
import { useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import pinyin from "@shared/pinyin.json"
import { OverlayScrollbar } from "../overlay-scrollbar"
import { CardWrapper } from "~/components/column/card"
import { focusSourcesAtom } from "~/atoms"
import { hudColor } from "~/utils/hud"

import "./cmdk.css"

type Mode = "source" | "news" | "web"

const modes: { id: Mode, label: string, prefix: string, icon: string }[] = [
  { id: "source", label: "信息源", prefix: "@", icon: "i-ph:broadcast-bold" },
  { id: "news", label: "新闻", prefix: "#", icon: "i-ph:newspaper-bold" },
  { id: "web", label: "全网", prefix: "?", icon: "i-ph:globe-hemisphere-east-bold" },
]

const prefixMap: Record<string, Mode> = { "@": "source", "#": "news", "＃": "news", "?": "web", "？": "web" }

const engines = [
  { id: "google", name: "Google", url: "https://www.google.com/search?q=%s", icon: "i-ph:google-logo-bold" },
  { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=%s", icon: "i-ph:magnifying-glass-bold" },
  { id: "baidu", name: "百度", url: "https://www.baidu.com/s?wd=%s", icon: "i-ph:paw-print-bold" },
  { id: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/search?q=%s", icon: "i-ph:sparkle-bold" },
  { id: "x", name: "X", url: "https://x.com/search?q=%s", icon: "i-ph:x-logo-bold" },
  { id: "github", name: "GitHub", url: "https://github.com/search?q=%s&type=repositories", icon: "i-ph:github-logo-bold" },
  { id: "zhihu", name: "知乎", url: "https://www.zhihu.com/search?q=%s", icon: "i-ph:chats-circle-bold" },
  { id: "bilibili", name: "哔哩哔哩", url: "https://search.bilibili.com/all?keyword=%s", icon: "i-ph:television-simple-bold" },
  { id: "weixin", name: "微信文章", url: "https://weixin.sogou.com/weixin?type=2&query=%s", icon: "i-ph:wechat-logo-bold" },
]

interface SourceItemProps {
  id: SourceID
  name: string
  title?: string
  column: any
  pinyin: string
}

interface NewsHit {
  key: string
  sourceId: SourceID
  item: NewsItem
  score: number
  time: number
}

function groupByColumn(items: SourceItemProps[]) {
  return items.reduce((acc, item) => {
    const k = acc.find(i => i.column === item.column)
    if (k) k.sources = [...k.sources, item]
    else acc.push({ column: item.column, sources: [item] })
    return acc
  }, [] as {
    column: string
    sources: SourceItemProps[]
  }[]).sort((m, n) => {
    if (m.column === "科技") return -1
    if (n.column === "科技") return 1

    if (m.column === "未分类") return 1
    if (n.column === "未分类") return -1

    return m.column < n.column ? -1 : 1
  })
}

function tokenize(q: string) {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// 纯英文/数字关键词不匹配单词中间（"ai" 不命中 "thai"），中文照常子串匹配
function tokenPattern(t: string) {
  const e = escapeRegExp(t)
  return /^[a-z0-9]+$/i.test(t) ? `(?<![a-z0-9])${e}` : e
}

function matchToken(text: string, t: string) {
  return new RegExp(tokenPattern(t), "i").test(text)
}

function sourceFilter(_: string, search: string, keywords?: string[]) {
  const tokens = tokenize(search)
  if (!tokens.length) return 1
  const [name = "", title = "", py = ""] = keywords ?? []
  let score = 0
  for (const t of tokens) {
    if (name.toLowerCase().startsWith(t)) score += 4
    else if (matchToken(name, t)) score += 3
    else if (matchToken(title, t)) score += 2
    else if (py.toLowerCase().startsWith(t) || (t.length >= 3 && py.toLowerCase().includes(t))) score += 1
    else return 0
  }
  return score / (tokens.length * 4)
}

function isURL(q: string) {
  return /^(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?$/i.test(q.trim()) && !/\s/.test(q.trim())
}

function openURL(url: string) {
  window.open(url, "_blank", "noopener")
}

function toMs(t?: string | number) {
  const v = typeof t === "number" ? t : t ? new Date(t).valueOf() : Number.NaN
  return Number.isNaN(v) ? 0 : v
}

function itemTime(item: NewsItem, fallback: string | number) {
  return toMs(item.pubDate ?? item.extra?.date) || toMs(fallback)
}

function Highlight({ text, tokens }: { text: string, tokens: string[] }) {
  if (!tokens.length) return <>{text}</>
  const parts = text.split(new RegExp(`(${tokens.map(tokenPattern).join("|")})`, "gi"))
  return (
    <>
      {parts.map((p, i) => tokens.includes(p.toLowerCase())
        ? <mark key={i} className="hud-hl">{p}</mark>
        : <span key={i}>{p}</span>)}
    </>
  )
}

function useAllNews(enabled: boolean) {
  const ids = useMemo(() => typeSafeObjectEntries(sources).filter(([_, s]) => !s.redirect).map(([k]) => k), [])
  return useQuery({
    queryKey: ["search-entire"],
    enabled,
    staleTime: 1000 * 60 * 3,
    retry: false,
    queryFn: async () => {
      const res: SourceResponse[] | undefined = await myFetch("/s/entire", {
        method: "POST",
        body: { sources: ids },
      }).catch(() => undefined)
      const map = new Map<SourceID, SourceResponse>()
      res?.forEach(r => map.set(r.id, r))
      cacheSources.forEach((v, k) => {
        if (!map.has(k) || toMs(map.get(k)!.updatedTime) < toMs(v.updatedTime)) map.set(k, v)
      })
      return [...map.values()]
    },
  })
}

function searchNews(data: SourceResponse[] | undefined, tokens: string[]): NewsHit[] {
  if (!data) return []
  const hits: NewsHit[] = []
  const seen = new Set<string>()
  for (const res of data) {
    if (!sources[res.id]) continue
    for (const item of res.items ?? []) {
      const title = item.title ?? ""
      const hover = item.extra?.hover ?? ""
      let score = 0
      let ok = true
      for (const t of tokens) {
        if (matchToken(title, t)) {
          score += 3
        } else if (matchToken(hover, t)) {
          score += 1
        } else {
          ok = false
          break
        }
      }
      if (!ok) continue
      const dedupe = item.title.trim()
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      hits.push({ key: `${res.id}::${item.id}`, sourceId: res.id, item, score, time: itemTime(item, res.updatedTime) })
    }
  }
  return hits.sort((a, b) => b.score - a.score || b.time - a.time).slice(0, 100)
}

function hotDigest(data: SourceResponse[] | undefined): NewsHit[] {
  if (!data) return []
  return data
    .filter(r => sources[r.id]?.type === "hottest" && r.items?.length)
    .map(r => ({ key: `${r.id}::${r.items[0].id}`, sourceId: r.id, item: r.items[0], score: 0, time: toMs(r.updatedTime) }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 30)
}

export function SearchBar() {
  const { opened, toggle } = useSearchBar()
  const focusSources = useAtomValue(focusSourcesAtom)
  const allSourceItems = useMemo(
    () =>
      typeSafeObjectEntries(sources)
        .filter(([_, source]) => !source.redirect)
        .map(([k, source]) => ({
          id: k,
          title: source.title,
          column: source.column ? columns[source.column].zh : "未分类",
          name: source.name,
          pinyin: pinyin?.[k as keyof typeof pinyin] ?? "",
        })),
    [],
  )
  const columnNames = useMemo(() => groupByColumn(allSourceItems).map(g => g.column), [allSourceItems])

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [mode, setMode] = useState<Mode>("source")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<string>("all")
  const [value, setValue] = useState<string>("github-trending-today")
  const [preview, setPreview] = useState<SourceID>("github-trending-today")

  const sourceGroups = useMemo(() => groupByColumn(allSourceItems.filter((s) => {
    if (filter === "all") return true
    if (filter === "focus") return focusSources.includes(s.id)
    return s.column === filter
  })), [allSourceItems, filter, focusSources])

  const { data: allNews, isFetching: newsLoading } = useAllNews(opened && mode === "news")
  const tokens = useMemo(() => tokenize(query), [query])
  const newsHits = useMemo(
    () => mode === "news" ? (tokens.length ? searchNews(allNews, tokens) : hotDigest(allNews)) : [],
    [mode, tokens, allNews],
  )
  const totalNews = useMemo(() => allNews?.reduce((n, r) => n + (r.items?.length ?? 0), 0) ?? 0, [allNews])

  const switchMode = useCallback((m: Mode) => {
    setMode(m)
    setValue("")
    inputRef.current?.focus()
  }, [])

  useMount(() => {
    inputRef?.current?.focus()
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }
    document.addEventListener("keydown", keydown)
    return () => {
      document.removeEventListener("keydown", keydown)
    }
  })

  const onInput = (v: string) => {
    const m = prefixMap[v[0]]
    if (m) {
      setMode(m)
      setQuery(v.slice(1).trimStart())
    } else {
      setQuery(v)
    }
  }

  const q = query.trim()
  const currentMode = modes.find(m => m.id === mode)!

  return (
    <Command.Dialog
      open={opened}
      onOpenChange={toggle}
      label="搜索"
      shouldFilter={mode === "source"}
      filter={sourceFilter}
      value={value}
      onValueChange={(v) => {
        setValue(v)
        if (v in sources) setPreview(v as SourceID)
      }}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault()
          const i = modes.findIndex(m => m.id === mode)
          switchMode(modes[(i + (e.shiftKey ? modes.length - 1 : 1)) % modes.length].id)
        }
      }}
    >
      <div className="hud-search-tag">
        <span>{`QUERY.TERMINAL // ${mode.toUpperCase()}_SCAN`}</span>
        <span className="flex items-center gap-3">
          <span className="hud-blink color-[#3dff8f]">● LINK</span>
          <span className="max-md:hidden">ESC 关闭</span>
        </span>
      </div>

      <div className="hud-search-input">
        <span className={$("hud-search-glyph", currentMode.icon)} />
        <Command.Input
          ref={inputRef}
          autoFocus
          value={query}
          onValueChange={onInput}
          placeholder={mode === "source" ? "搜索信息源，支持拼音…" : mode === "news" ? "搜索全部新闻标题，空格分隔多个关键词…" : "输入关键词或网址，跳转全网搜索…"}
        />
        {q && (
          <button type="button" className="hud-search-clear i-ph:x-bold" title="清空" onClick={() => onInput("")} />
        )}
      </div>

      <div className="hud-search-modes">
        {modes.map(m => (
          <button
            key={m.id}
            type="button"
            className={$("hud-search-mode", mode === m.id && "active")}
            onClick={() => switchMode(m.id)}
          >
            <span className={m.icon} />
            <span>{m.label}</span>
            <kbd>{m.prefix}</kbd>
          </button>
        ))}
        <span className="hud-search-hint max-md:hidden">Tab 切换 · 输入前缀 @ # ? 快速切换</span>
      </div>

      {mode === "source" && (
        <div className="hud-search-filters">
          {["all", "focus", ...columnNames].map(f => (
            <button
              key={f}
              type="button"
              className={$("hud-search-chip", filter === f && "active")}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "全部" : f === "focus" ? `★ 已关注 ${focusSources.length}` : f}
            </button>
          ))}
        </div>
      )}

      <div className="md:flex pt-2">
        <OverlayScrollbar defer className={$("overflow-y-auto", mode === "source" ? "md:min-w-275px" : "flex-1")}>
          <Command.List>
            {mode === "source" && (
              <>
                <Command.Empty>NO SIGNAL · 没有匹配的信息源</Command.Empty>
                {sourceGroups.map(({ column, sources }) => (
                  <Command.Group heading={column} key={column}>
                    {sources.map(item => <SourceItem item={item} key={item.id} />)}
                  </Command.Group>
                ))}
                {q && (
                  <Command.Group heading="智能建议" forceMount>
                    <Command.Item forceMount value="__to-news" onSelect={() => switchMode("news")} className="hud-search-suggest">
                      <span className="i-ph:newspaper-bold" />
                      <span>
                        在全部新闻中搜索「
                        {q}
                        」
                      </span>
                    </Command.Item>
                    <Command.Item forceMount value="__to-web" onSelect={() => switchMode("web")} className="hud-search-suggest">
                      <span className="i-ph:globe-hemisphere-east-bold" />
                      <span>
                        全网搜索「
                        {q}
                        」
                      </span>
                    </Command.Item>
                  </Command.Group>
                )}
              </>
            )}

            {mode === "news" && (
              <>
                <div className="hud-search-stat">
                  {newsLoading && !allNews
                    ? <span className="hud-blink">SCANNING DATA MATRIX…</span>
                    : tokens.length
                      ? `扫描 ${allNews?.length ?? 0} 个源 / ${totalNews} 条 · 命中 ${newsHits.length >= 100 ? "100+" : newsHits.length} 条`
                      : `热点速览 · 各热榜 TOP1（共 ${allNews?.length ?? 0} 个源已缓存）`}
                </div>
                {!newsLoading && !newsHits.length && tokens.length > 0 && (
                  <Command.Item value="__news-web" onSelect={() => switchMode("web")} className="hud-search-suggest">
                    <span className="i-ph:globe-hemisphere-east-bold" />
                    <span>
                      本地没有命中，去全网搜索「
                      {q}
                      」
                    </span>
                  </Command.Item>
                )}
                {newsHits.map(hit => <NewsHitItem key={hit.key} hit={hit} tokens={tokens} />)}
              </>
            )}

            {mode === "web" && (
              <>
                {!q && <div className="hud-search-stat">输入关键词后选择搜索引擎，回车直接使用第一个</div>}
                {q && isURL(q) && (
                  <Command.Item value="__open-url" onSelect={() => openURL(/^https?:\/\//.test(q) ? q : `https://${q}`)} className="hud-search-engine">
                    <span className="hud-search-engine-icon i-ph:arrow-square-out-bold" />
                    <span className="flex-1 truncate">
                      打开链接
                      <span className="hud-search-dim ml-2">{q}</span>
                    </span>
                    <kbd>↵</kbd>
                  </Command.Item>
                )}
                {q && engines.map(e => (
                  <Command.Item
                    key={e.id}
                    value={`__engine-${e.id}`}
                    onSelect={() => openURL(e.url.replace("%s", encodeURIComponent(q)))}
                    className="hud-search-engine"
                  >
                    <span className={$("hud-search-engine-icon", e.icon)} />
                    <span className="flex-1 truncate">
                      {e.name}
                      <span className="hud-search-dim ml-2">
                        搜索「
                        {q}
                        」
                      </span>
                    </span>
                    <kbd>↵</kbd>
                  </Command.Item>
                ))}
              </>
            )}
          </Command.List>
        </OverlayScrollbar>
        {mode === "source" && (
          <div className="flex-1 pt-2 px-4 min-w-350px max-md:hidden">
            <CardWrapper id={preview} />
          </div>
        )}
      </div>

      <div className="hud-search-footer">
        <span>
          <kbd>↑↓</kbd>
          {" 选择 "}
          <kbd>↵</kbd>
          {mode === "source" ? " 关注" : " 打开"}
          <span className="max-md:hidden">
            {" "}
            <kbd>Tab</kbd>
            {" 模式 "}
            <kbd>⌘K</kbd>
            {" 唤起"}
          </span>
        </span>
        <span>SECURE CHANNEL</span>
      </div>
    </Command.Dialog>
  )
}

function SourceItem({ item }: {
  item: SourceItemProps
}) {
  const { isFocused, toggleFocus } = useFocusWith(item.id)
  return (
    <Command.Item
      keywords={[item.name, item.title ?? "", item.pinyin]}
      value={item.id}
      className="flex justify-between items-center p-2"
      style={{ "--hud": hudColor(sources[item.id].color) } as React.CSSProperties}
      onSelect={toggleFocus}
    >
      <span className="flex gap-2 items-center min-w-0">
        <span
          className="hud-search-icon w-5 h-5 shrink-0 bg-cover"
          style={{
            backgroundImage: `url(/icons/${item.id.split("-")[0]}.png)`,
          }}
        />
        <span className="truncate">{item.name}</span>
        {item.title && <span className="hud-search-dim text-xs truncate">{item.title}</span>}
      </span>
      <span className={$("shrink-0", isFocused ? "i-ph:star-fill color-[#ffe14d]" : "i-ph:star-bold op-40")}></span>
    </Command.Item>
  )
}

function NewsHitItem({ hit, tokens }: { hit: NewsHit, tokens: string[] }) {
  const source = sources[hit.sourceId]
  const time = useRelativeTime(hit.time)
  return (
    <Command.Item
      value={hit.key}
      onSelect={() => openURL(hit.item.url)}
      className="hud-search-news"
      style={{ "--hud": hudColor(source.color) } as React.CSSProperties}
    >
      <span
        className="hud-search-icon w-5 h-5 mt-0.5 shrink-0 bg-cover"
        style={{ backgroundImage: `url(/icons/${hit.sourceId.split("-")[0]}.png)` }}
      />
      <span className="flex flex-col min-w-0 flex-1">
        <span className="leading-snug">
          <Highlight text={hit.item.title} tokens={tokens} />
        </span>
        <span className="hud-search-meta">
          <span className="hud-search-src">{source.name}</span>
          {source.title && <span>{source.title}</span>}
          {time && <span>{`[${time}]`}</span>}
        </span>
      </span>
      <span className="i-ph:arrow-up-right-bold shrink-0 op-50" />
    </Command.Item>
  )
}
