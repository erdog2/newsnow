import type { NewsItem, SourceID } from "@shared/types"
import type { PropsWithChildren, ReactNode } from "react"
import { motion } from "framer-motion"
import { useWindowSize } from "react-use"
import { OverlayScrollbar } from "../common/overlay-scrollbar"
import { DiffNumber, ExtraInfo, NewsUpdatedTime, UpdatedTime, useSourceQuery } from "./card"
import { currentColumnIDAtom, currentSourcesAtom } from "~/atoms"
import { hudColor } from "~/utils/hud"

type Side = "left" | "right"

interface Flip {
  from: number
  to: number
}

interface LeafProps {
  className: string
  origin: "left" | "right"
  from: number
  to: number
  front: ReactNode
  back: ReactNode
  onDone: () => void
}

const FLIP_DURATION = 0.7
const SWIPE_DISTANCE = 50
const WHEEL_DISTANCE = 60
const AUTO_TURN_SECONDS = 20

const autoTurnAtom = atomWithStorage("book-auto-turn", false, undefined, { getOnInit: true })

function readSavedPage(key: string) {
  const n = Number(localStorage.getItem(key))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function Book() {
  const items = useAtomValue(currentSourcesAtom)
  const columnId = useAtomValue(currentColumnIDAtom)
  useEntireQuery(items)

  const { width } = useWindowSize()
  const spread = width >= 1024
  // 宽屏时每页并排放两个新闻源，一次展开能看 4 个
  const perPage = width >= 1600 ? 2 : 1
  const step = spread ? 2 : 1

  const chunks = useMemo(() => {
    const res: SourceID[][] = []
    for (let i = 0; i < items.length; i += perPage) res.push(items.slice(i, i + perPage))
    return res
  }, [items, perPage])

  // 第 0 页是目录，之后每页放 perPage 个新闻源
  const total = chunks.length + 1
  const align = useCallback((i: number) => (spread ? i - (i % 2) : i), [spread])
  const lastPage = align(total - 1)

  const storageKey = `book-page-${columnId}`
  const [rawPage, setRawPage] = useState(() => readSavedPage(storageKey))
  const [flip, setFlip] = useState<Flip | null>(null)
  const page = Math.min(align(rawPage), lastPage)

  useEffect(() => {
    localStorage.setItem(storageKey, String(rawPage))
  }, [storageKey, rawPage])

  const turnTo = useCallback((target: number) => {
    const to = Math.max(0, Math.min(align(target), lastPage))
    if (flip || to === page) return
    setFlip({ from: page, to })
  }, [align, flip, lastPage, page])

  const next = useCallback(() => turnTo(page + step), [turnTo, page, step])
  const prev = useCallback(() => turnTo(page - step), [turnTo, page, step])
  const jumpToSource = useCallback((index: number) => turnTo(1 + Math.floor(index / perPage)), [turnTo, perPage])

  const finishFlip = useCallback(() => {
    if (!flip) return
    setRawPage(flip.to)
    setFlip(null)
  }, [flip])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowRight" || e.key === "PageDown") next()
      else if (e.key === "ArrowLeft" || e.key === "PageUp") prev()
      else if (e.key === "Home") turnTo(0)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev, turnTo])

  // 触控板左右轻扫翻页；需要非 passive 监听才能阻止浏览器的前进/后退手势
  const bookRef = useRef<HTMLDivElement>(null)
  const wheel = useRef({ dx: 0, lock: 0 })
  useEffect(() => {
    const el = bookRef.current
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
      wheel.current = { dx: 0, lock: now + FLIP_DURATION * 1000 + 300 }
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
  const autoNext = useCallback(() => (page >= lastPage ? turnTo(0) : next()), [page, lastPage, turnTo, next])

  const renderPage = (i: number, side: Side) => {
    if (i === 0) return <TocPage side={side} items={items} perPage={perPage} title={metadata[columnId].name} onJump={jumpToSource} />
    const ids = chunks[i - 1]
    if (ids) return <SourcePage side={side} ids={ids} pageNo={i} />
    return <EndPage side={side} />
  }

  let staticPages: ReactNode
  let leaf: ReactNode = null

  if (spread) {
    let left = page
    let right = page + 1
    if (flip && flip.to > flip.from) {
      left = flip.from
      right = flip.to + 1
      leaf = (
        <Leaf
          className="left-1/2 w-1/2"
          origin="left"
          from={0}
          to={-180}
          front={renderPage(flip.from + 1, "right")}
          back={renderPage(flip.to, "left")}
          onDone={finishFlip}
        />
      )
    } else if (flip) {
      left = flip.to
      right = flip.from + 1
      leaf = (
        <Leaf
          className="left-0 w-1/2"
          origin="right"
          from={0}
          to={180}
          front={renderPage(flip.from, "left")}
          back={renderPage(flip.to + 1, "right")}
          onDone={finishFlip}
        />
      )
    }
    staticPages = (
      <>
        <div className="relative">{renderPage(left, "left")}</div>
        <div className="relative">{renderPage(right, "right")}</div>
        <div className="book-spine" />
      </>
    )
  } else {
    const forward = !!flip && flip.to > flip.from
    staticPages = <div className="relative">{renderPage(flip ? (forward ? flip.to : flip.from) : page, "right")}</div>
    if (flip) {
      leaf = (
        <Leaf
          className="inset-x-0"
          origin="left"
          from={forward ? 0 : -180}
          to={forward ? -180 : 0}
          front={renderPage(forward ? flip.from : flip.to, "right")}
          back={<div className="paper paper-left absolute inset-0" />}
          onDone={finishFlip}
        />
      )
    }
  }

  const pageNumbers = (spread ? [page, page + 1] : [page]).filter(i => i >= 1 && i <= chunks.length)
  const label = [
    page === 0 && "目录",
    pageNumbers.length && `第 ${pageNumbers.join("–")} 页`,
  ].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col items-center gap-4 px-4 md:px-0 pb-2">
      <div
        ref={bookRef}
        className={$("book relative w-full", spread ? (perPage > 1 ? "max-w-[1840px]" : "max-w-[1240px]") : "max-w-[560px]")}
        style={{ height: spread ? "clamp(520px, calc(100vh - 210px), 960px)" : "clamp(460px, calc(100vh - 240px), 820px)" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className={$("book-cover", !spread && "single")} />
        <div
          className="relative h-full grid"
          style={{ gridTemplateColumns: spread ? "1fr 1fr" : "1fr", perspective: "2600px" }}
        >
          {staticPages}
          {leaf}
        </div>
        {page > 0 && <button type="button" title="上一页" className="book-edge prev" onClick={prev} />}
        {page < lastPage && <button type="button" title="下一页" className="book-edge next" onClick={next} />}
        {page > 0 && <button type="button" title="上一页" className="book-corner prev" onClick={prev} />}
        {page < lastPage && <button type="button" title="下一页" className="book-corner next" onClick={next} />}
        {autoTurn && !flip && lastPage > 0 && (
          <div
            key={page}
            className="book-progress"
            style={{ animationDuration: `${AUTO_TURN_SECONDS}s`, animationPlayState: hovering ? "paused" : "running" }}
            onAnimationEnd={autoNext}
          />
        )}
      </div>

      <div className="book-pager">
        <button type="button" className="book-pager-btn" disabled={page === 0} onClick={prev}>
          <span className="i-ph:caret-left-bold" />
          <span className="hidden sm:inline">上一页</span>
        </button>
        <span className="flex flex-col items-center min-w-0">
          <span>{label}</span>
          <span className="book-hint">
            {spread ? `${items.length} 个新闻源 · 共 ${chunks.length} 页 · ← → 键、轻扫或点击页边翻页` : `共 ${chunks.length} 页 · 左右滑动翻页`}
          </span>
        </span>
        <button type="button" className="book-pager-btn" disabled={page >= lastPage} onClick={next}>
          <span className="hidden sm:inline">下一页</span>
          <span className="i-ph:caret-right-bold" />
        </button>
        <button
          type="button"
          className={$("book-pager-btn", autoTurn && "active")}
          title={`每 ${AUTO_TURN_SECONDS} 秒自动翻页，鼠标停在书上时暂停`}
          onClick={() => setAutoTurn(!autoTurn)}
        >
          <span className={autoTurn ? "i-ph:pause-bold" : "i-ph:play-bold"} />
          <span className="hidden sm:inline">自动</span>
        </button>
      </div>
    </div>
  )
}

function Leaf({ className, origin, from, to, front, back, onDone }: LeafProps) {
  const transition = { duration: FLIP_DURATION, ease: [0.645, 0.045, 0.355, 1] as const }
  const lighting = from === 0 ? [0, 0.3] : [0.3, 0]
  return (
    <motion.div
      className={$("book-leaf", className)}
      style={{ transformOrigin: `${origin} center` }}
      initial={{ rotateY: from }}
      animate={{ rotateY: to }}
      transition={transition}
      onAnimationComplete={onDone}
    >
      <div className="book-face">
        {front}
        <motion.div className="book-shade" initial={{ opacity: lighting[0] }} animate={{ opacity: lighting[1] }} transition={transition} />
      </div>
      <div className="book-face back">
        {back}
        <motion.div className="book-shade" initial={{ opacity: lighting[1] }} animate={{ opacity: lighting[0] }} transition={transition} />
      </div>
    </motion.div>
  )
}

function PaperPage({ side, pageNo, running, accent, children }: PropsWithChildren<{
  side: Side
  pageNo?: number
  running: string
  accent?: string
}>) {
  return (
    <div
      className={$("paper absolute inset-0 flex flex-col", side === "left" ? "paper-left" : "paper-right")}
      style={accent ? { "--accent": accent } as React.CSSProperties : undefined}
    >
      <div className={$("paper-running", side === "right" && "flex-row-reverse")}>
        <span className="truncate">{running}</span>
        <span className="shrink-0">NEWS · 新闻</span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col px-5 md:px-8">{children}</div>
      <div className="paper-folio">{pageNo ? `— ${pageNo} —` : "\u00A0"}</div>
    </div>
  )
}

function TocPage({ side, items, perPage, title, onJump }: {
  side: Side
  items: SourceID[]
  perPage: number
  title: string
  onJump: (index: number) => void
}) {
  const today = useMemo(() => new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }), [])

  return (
    <PaperPage side={side} running={title}>
      <div className="text-center pt-1">
        <div className="book-eyebrow">{today}</div>
        <h1 className="book-toc-title">目录</h1>
        <p className="book-meta">{`${title} · 共 ${items.length} 篇 · 点击标题直达`}</p>
      </div>
      <div className="book-rule" />
      <OverlayScrollbar className="flex-1 min-h-0 overflow-y-auto pr-2" options={{ overflow: { x: "hidden" } }} defer>
        {items.length
          ? (
              <ol>
                {items.map((id, i) => (
                  <li key={id}>
                    <TocEntry id={id} pageNo={1 + Math.floor(i / perPage)} onClick={() => onJump(i)} />
                  </li>
                ))}
              </ol>
            )
          : (
              <p className="book-empty">
                这一卷还是空白的。
                <br />
                在「更多」里收藏新闻源，它们会出现在这里。
              </p>
            )}
      </OverlayScrollbar>
    </PaperPage>
  )
}

function TocEntry({ id, pageNo, onClick }: { id: SourceID, pageNo: number, onClick: () => void }) {
  const { data } = useSourceQuery(id)
  const source = sources[id]
  const headline = data?.items?.[0]?.title
  return (
    <button
      type="button"
      className="book-toc-item"
      style={{ "--accent": hudColor(source.color) } as React.CSSProperties}
      onClick={onClick}
    >
      <span
        className="book-icon w-5 h-5 shrink-0 bg-cover self-center"
        style={{ backgroundImage: `url(/icons/${id.split("-")[0]}.png)` }}
      />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="flex items-baseline gap-2">
          <span className="book-toc-name truncate">
            {source.name}
            {source?.title && <small className="book-extra">{source.title}</small>}
          </span>
          <span className="book-toc-dots" />
          <span className="book-toc-no">{pageNo}</span>
        </span>
        <span className="book-toc-headline truncate">{headline ?? "\u00A0"}</span>
      </span>
    </button>
  )
}

function EndPage({ side }: { side: Side }) {
  return (
    <PaperPage side={side} running="终">
      <div className="book-empty flex-1 flex flex-col items-center justify-center">
        <span className="text-3xl">❦</span>
        <span>— 全书完 —</span>
      </div>
    </PaperPage>
  )
}

function SourcePage({ side, ids, pageNo }: { side: Side, ids: SourceID[], pageNo: number }) {
  return (
    <PaperPage
      side={side}
      pageNo={pageNo}
      running={ids.map(id => sources[id].name).join(" · ")}
      accent={ids.length === 1 ? hudColor(sources[ids[0]].color) : undefined}
    >
      <div className={$("flex-1 min-h-0 grid", ids.length > 1 && "book-columns")} style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))` }}>
        {ids.map(id => <SourceSection key={id} id={id} compact={ids.length > 1} />)}
      </div>
    </PaperPage>
  )
}

export function BookPreview({ id }: { id: SourceID }) {
  return (
    <div className="book relative h-full">
      <div
        className="paper paper-right absolute inset-0 flex flex-col px-5 pt-4 pb-2"
        style={{ "--accent": hudColor(sources[id].color) } as React.CSSProperties}
      >
        <SourceSection id={id} compact={false} />
      </div>
    </div>
  )
}

function SourceSection({ id, compact }: { id: SourceID, compact: boolean }) {
  const { data, isFetching, isError } = useSourceQuery(id)
  const { refresh } = useRefetch()
  const { isFocused, toggleFocus } = useFocusWith(id)
  const { width } = useWindowSize()
  const source = sources[id]
  const hottest = source.type === "hottest"

  return (
    <section className="book-section min-h-0 flex flex-col" style={{ "--accent": hudColor(source.color) } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 items-center min-w-0">
          <a
            className={$("book-icon shrink-0 bg-cover cursor-pointer", compact ? "w-8 h-8" : "w-10 h-10")}
            target="_blank"
            href={source.home}
            title={source.desc}
            style={{ backgroundImage: `url(/icons/${id.split("-")[0]}.png)` }}
          />
          <div className="min-w-0">
            <h2 className={$("book-title truncate", compact && "compact")} title={source.desc}>
              {source.name}
              {source?.title && <small className="book-subtitle">{source.title}</small>}
            </h2>
            <p className="book-meta truncate">
              <UpdatedTime isError={isError} updatedTime={data?.updatedTime} />
              {` · ${hottest ? "热榜" : "快讯"} · ${data?.items?.length ?? 0} 条`}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" title="刷新" className="book-btn" onClick={() => refresh(id)}>
            <span className={$("i-ph:arrow-counter-clockwise-bold", isFetching && "animate-spin i-ph:circle-dashed-bold")} />
          </button>
          <button type="button" title="收藏" className={$("book-btn", isFocused && "active")} onClick={toggleFocus}>
            <span className={isFocused ? "i-ph:star-fill" : "i-ph:star-bold"} />
          </button>
        </div>
      </div>
      <div className="book-rule" />
      <OverlayScrollbar
        className={$("flex-1 min-h-0 overflow-y-auto pr-2", isFetching && "animate-pulse")}
        options={{ overflow: { x: "hidden" } }}
        defer
      >
        <div className={$("transition-opacity-500", isFetching && "op-30")}>
          {data?.items?.length
            ? (hottest ? <HotList items={data.items} mobile={width < 768} /> : <TimelineList items={data.items} mobile={width < 768} />)
            : <p className="book-empty">{isError ? "这一页暂时无法印刷，稍后再试。" : "正在排版…"}</p>}
        </div>
      </OverlayScrollbar>
    </section>
  )
}

function HotList({ items, mobile }: { items: NewsItem[], mobile: boolean }) {
  return (
    <ol className="book-list">
      {items.map((item, i) => (
        <li key={item.id}>
          <a
            className="book-item relative"
            href={mobile ? item.mobileUrl || item.url : item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={item.extra?.hover}
          >
            <span className={$("book-rank", i < 3 && "top")}>{i + 1}</span>
            {!!item.extra?.diff && <DiffNumber diff={item.extra.diff} />}
            <span className="flex-1">
              <span className="book-item-title">{item.title}</span>
              <span className="book-extra"><ExtraInfo item={item} /></span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}

function TimelineList({ items, mobile }: { items: NewsItem[], mobile: boolean }) {
  return (
    <ol className="book-list">
      {items.map((item) => {
        const date = item.pubDate || item.extra?.date
        return (
          <li key={`${item.id}-${date ?? ""}`}>
            <a
              className="book-item flex-col"
              href={mobile ? item.mobileUrl || item.url : item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={item.extra?.hover}
            >
              <span className="book-time">
                {date && <NewsUpdatedTime date={date} />}
                <ExtraInfo item={item} />
              </span>
              <span>
                <span className="book-item-title">{item.title}</span>
              </span>
            </a>
          </li>
        )
      })}
    </ol>
  )
}
