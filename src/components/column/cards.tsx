import type { NewsItem, SourceID } from "@shared/types"
import { motion } from "framer-motion"
import { useWindowSize } from "react-use"
import { OverlayScrollbar } from "../common/overlay-scrollbar"
import { DiffNumber, ExtraInfo, NewsUpdatedTime, UpdatedTime, useSourceQuery } from "./card"
import { currentColumnIDAtom, currentSourcesAtom } from "~/atoms"
import { hudColor } from "~/utils/hud"

const SUITS = ["gc-gold", "gc-blue", "gc-purple"]
const SWIPE_DISTANCE = 50
const WHEEL_DISTANCE = 60
const AUTO_TURN_SECONDS = 20
// 中间那张左右各露出几张
const VISIBLE_RANGE = 3

const autoTurnAtom = atomWithStorage("cards-auto-turn", false, undefined, { getOnInit: true })

function readSavedIndex(key: string) {
  const n = Number(localStorage.getItem(key))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function CardDeck() {
  const items = useAtomValue(currentSourcesAtom)
  const columnId = useAtomValue(currentColumnIDAtom)
  useEntireQuery(items)

  const { width } = useWindowSize()
  const mobile = width < 768
  const avail = width - (width >= 1024 ? 192 : width >= 768 ? 80 : 0)
  const cardW = mobile ? Math.min(width - 56, 440) : Math.round(Math.min(560, Math.max(340, avail / 2.6)))
  const spacing = cardW * 0.86
  const last = Math.max(0, items.length - 1)

  const storageKey = `cards-index-${columnId}`
  const [rawIndex, setIndex] = useState(() => readSavedIndex(storageKey))
  const index = Math.min(rawIndex, last)

  useEffect(() => {
    localStorage.setItem(storageKey, String(index))
  }, [storageKey, index])

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(i, last))), [last])
  const next = useCallback(() => go(index + 1), [go, index])
  const prev = useCallback(() => go(index - 1), [go, index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowRight" || e.key === "PageDown") next()
      else if (e.key === "ArrowLeft" || e.key === "PageUp") prev()
      else if (e.key === "Home") go(0)
      else if (e.key === "End") go(last)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev, go, last])

  // 触控板左右轻扫切牌；需要非 passive 监听才能阻止浏览器的前进/后退手势
  const stageRef = useRef<HTMLDivElement>(null)
  const wheel = useRef({ dx: 0, lock: 0 })
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      const now = Date.now()
      if (now < wheel.current.lock) return
      wheel.current.dx += e.deltaX
      if (Math.abs(wheel.current.dx) < WHEEL_DISTANCE) return
      if (wheel.current.dx > 0) next()
      else prev()
      wheel.current = { dx: 0, lock: now + 450 }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [next, prev])

  const touch = useRef<{ x: number, y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) next()
    else prev()
  }

  const [autoTurn, setAutoTurn] = useAtom(autoTurnAtom)
  const [hovering, setHovering] = useState(false)
  const autoNext = useCallback(() => (index >= last ? go(0) : next()), [index, last, go, next])

  const deckRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const deck = deckRef.current
    const chip = deck?.children[index] as HTMLElement | undefined
    if (!deck || !chip) return
    deck.scrollTo({ left: chip.offsetLeft - deck.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" })
  }, [index])

  if (!items.length) {
    return (
      <p className="gc-empty">
        牌库还是空的。
        <br />
        在「更多」里收藏新闻源，它们会变成你的卡牌。
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 pb-2">
      <div
        ref={stageRef}
        className="gc-stage relative w-full"
        style={{ height: mobile ? "clamp(440px, calc(100vh - 300px), 760px)" : "clamp(480px, calc(100vh - 270px), 880px)" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {items.map((id, i) => {
          const offset = i - index
          const dist = Math.abs(offset)
          if (dist > VISIBLE_RANGE) return null
          return (
            <motion.div
              key={id}
              className={$("gc-slot", offset !== 0 && "gc-side")}
              style={{ width: cardW, zIndex: 10 - dist, transformOrigin: "50% 120%" }}
              initial={{ x: -cardW / 2, y: 320, rotate: 0, scale: 0.9, opacity: 0 }}
              animate={{
                x: offset * spacing - cardW / 2,
                y: dist * 26,
                rotate: Math.max(-14, Math.min(14, offset * 6)),
                scale: 1 - dist * 0.06,
                opacity: dist >= VISIBLE_RANGE ? 0 : 1,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 30, delay: Math.min(dist * 0.04, 0.12) }}
              onClick={offset !== 0 ? () => go(i) : undefined}
            >
              <div className={$("gc-card", SUITS[i % SUITS.length])}>
                <div className="gc-content">
                  <span className="gc-watermark">{i + 1}</span>
                  <CardFace id={id} inert={offset !== 0} />
                </div>
              </div>
            </motion.div>
          )
        })}
        {autoTurn && last > 0 && (
          <div
            key={index}
            className="gc-progress"
            style={{ width: cardW * 0.9, animationDuration: `${AUTO_TURN_SECONDS}s`, animationPlayState: hovering ? "paused" : "running" }}
            onAnimationEnd={autoNext}
          />
        )}
      </div>

      <div className="gc-lines" style={{ width: Math.min(width - 32, cardW * 2.4) }}>
        <div className="gc-line" />
        <div className="gc-line" />
      </div>

      <div ref={deckRef} className="gc-deck">
        {items.map((id, i) => (
          <button
            key={id}
            type="button"
            className={$("gc-chip", SUITS[i % SUITS.length], i === index && "active")}
            onClick={() => go(i)}
          >
            <span className="gc-icon w-5 h-5 shrink-0 bg-cover" style={{ backgroundImage: `url(/icons/${id.split("-")[0]}.png)` }} />
            <span>{sources[id].name}</span>
            {sources[id].title && <span className="gc-dim">{sources[id].title}</span>}
          </button>
        ))}
      </div>

      <div className="gc-pager">
        <button type="button" className="gc-pill" disabled={index === 0} onClick={prev}>
          <span className="i-ph:caret-left-bold" />
          <span className="hidden sm:inline">上一张</span>
        </button>
        <span className="flex flex-col items-center min-w-0">
          <span className="gc-count">{`${index + 1} / ${items.length}`}</span>
          <span className="gc-hint">{mobile ? "左右滑动切牌" : "← → 键、轻扫或点击两侧卡牌切换"}</span>
        </span>
        <button type="button" className="gc-pill" disabled={index >= last} onClick={next}>
          <span className="hidden sm:inline">下一张</span>
          <span className="i-ph:caret-right-bold" />
        </button>
        <button
          type="button"
          className={$("gc-pill", autoTurn && "active")}
          title={`每 ${AUTO_TURN_SECONDS} 秒自动切牌，鼠标停在卡牌上时暂停`}
          onClick={() => setAutoTurn(!autoTurn)}
        >
          <span className={autoTurn ? "i-ph:pause-bold" : "i-ph:play-bold"} />
          <span className="hidden sm:inline">自动</span>
        </button>
      </div>
    </div>
  )
}

export function CardPreview({ id }: { id: SourceID }) {
  return (
    <div className="gc-card gc-blue relative h-full">
      <div className="gc-content">
        <CardFace id={id} />
      </div>
    </div>
  )
}

function CardFace({ id, inert }: { id: SourceID, inert?: boolean }) {
  const { data, isFetching, isError } = useSourceQuery(id)
  const { refresh } = useRefetch()
  const { isFocused, toggleFocus } = useFocusWith(id)
  const { width } = useWindowSize()
  const source = sources[id]
  const hottest = source.type === "hottest"

  return (
    <div
      className={$("relative flex-1 min-h-0 flex flex-col", inert && "pointer-events-none")}
      style={{ "--accent": hudColor(source.color) } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 items-center min-w-0">
          <a
            className="gc-icon w-10 h-10 shrink-0 bg-cover cursor-pointer"
            target="_blank"
            href={source.home}
            title={source.desc}
            style={{ backgroundImage: `url(/icons/${id.split("-")[0]}.png)` }}
          />
          <div className="min-w-0">
            <h2 className="gc-title truncate" title={source.desc}>
              {source.name}
              {source?.title && <small className="gc-tag">{source.title}</small>}
            </h2>
            <p className="gc-meta truncate">
              <UpdatedTime isError={isError} updatedTime={data?.updatedTime} />
              {` · ${hottest ? "热榜" : "快讯"} · ${data?.items?.length ?? 0} 条`}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" title="刷新" className="gc-btn" onClick={() => refresh(id)}>
            <span className={$("i-ph:arrow-counter-clockwise-bold", isFetching && "animate-spin i-ph:circle-dashed-bold")} />
          </button>
          <button type="button" title="收藏" className={$("gc-btn", isFocused && "active")} onClick={toggleFocus}>
            <span className={isFocused ? "i-ph:star-fill" : "i-ph:star-bold"} />
          </button>
        </div>
      </div>
      <div className="gc-divider" />
      <OverlayScrollbar
        className={$("flex-1 min-h-0 overflow-y-auto pr-2", isFetching && "animate-pulse")}
        options={{ overflow: { x: "hidden" } }}
        defer
      >
        <div className={$("transition-opacity-500", isFetching && "op-30")}>
          {data?.items?.length
            ? (hottest ? <HotList items={data.items} mobile={width < 768} /> : <TimelineList items={data.items} mobile={width < 768} />)
            : <p className="gc-empty small">{isError ? "这张牌暂时翻不开，稍后再试。" : "正在抽取…"}</p>}
        </div>
      </OverlayScrollbar>
    </div>
  )
}

function HotList({ items, mobile }: { items: NewsItem[], mobile: boolean }) {
  return (
    <ol>
      {items.map((item, i) => (
        <li key={item.id}>
          <a
            className="gc-item relative"
            href={mobile ? item.mobileUrl || item.url : item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={item.extra?.hover}
          >
            <span className={$("gc-rank", i < 3 && "top")}>{i + 1}</span>
            {!!item.extra?.diff && <DiffNumber diff={item.extra.diff} />}
            <span className="flex-1">
              <span className="gc-item-title">{item.title}</span>
              <span className="gc-extra"><ExtraInfo item={item} /></span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}

function TimelineList({ items, mobile }: { items: NewsItem[], mobile: boolean }) {
  return (
    <ol>
      {items.map((item) => {
        const date = item.pubDate || item.extra?.date
        return (
          <li key={`${item.id}-${date ?? ""}`}>
            <a
              className="gc-item flex-col"
              href={mobile ? item.mobileUrl || item.url : item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={item.extra?.hover}
            >
              <span className="gc-time">
                {date && <NewsUpdatedTime date={date} />}
                <ExtraInfo item={item} />
              </span>
              <span className="gc-item-title">{item.title}</span>
            </a>
          </li>
        )
      })}
    </ol>
  )
}
