import type { NewsItem, SourceID, SourceResponse } from "@shared/types"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion, useInView } from "framer-motion"
import { useWindowSize } from "react-use"
import { forwardRef, useImperativeHandle } from "react"
import { OverlayScrollbar } from "../common/overlay-scrollbar"
import { safeParseString } from "~/utils"
import { hudColor, hudHex } from "~/utils/hud"

export interface ItemsProps extends React.HTMLAttributes<HTMLDivElement> {
  id: SourceID
  /**
   * 是否显示透明度，拖动时原卡片的样式
   */
  isDragging?: boolean
  setHandleRef?: (ref: HTMLElement | null) => void
}

interface NewsCardProps {
  id: SourceID
  setHandleRef?: (ref: HTMLElement | null) => void
}

export const CardWrapper = forwardRef<HTMLElement, ItemsProps>(({ id, isDragging, setHandleRef, style, ...props }, dndRef) => {
  const ref = useRef<HTMLDivElement>(null)

  const inView = useInView(ref, {
    once: true,
  })

  useImperativeHandle(dndRef, () => ref.current! as HTMLDivElement)

  return (
    <div
      ref={ref}
      className={$(
        "hud-panel flex flex-col h-500px cursor-default",
        "transition-opacity-300",
        isDragging && "op-50",
      )}
      style={{
        "transformOrigin": "50% 50%",
        "--hud": hudColor(sources[id].color),
        ...style,
      } as React.CSSProperties}
      {...props}
    >
      {inView && <NewsCard id={id} setHandleRef={setHandleRef} />}
    </div>
  )
})

export function useSourceQuery(id: SourceID) {
  return useQuery({
    queryKey: ["source", id],
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1] as SourceID
      let url = `/s?id=${id}`
      const headers: Record<string, any> = {}
      if (refetchSources.has(id)) {
        url = `/s?id=${id}&latest`
        const jwt = safeParseString(localStorage.getItem("jwt"))
        if (jwt) headers.Authorization = `Bearer ${jwt}`
        refetchSources.delete(id)
      } else if (cacheSources.has(id)) {
        // wait animation
        await delay(200)
        return cacheSources.get(id)
      }

      const response: SourceResponse = await myFetch(url, {
        headers,
      })

      function diff() {
        try {
          if (response.items && sources[id].type === "hottest" && cacheSources.has(id)) {
            response.items.forEach((item, i) => {
              const o = cacheSources.get(id)!.items.findIndex(k => k.id === item.id)
              item.extra = {
                ...item?.extra,
                diff: o === -1 ? undefined : o - i,
              }
            })
          }
        } catch (e) {
          console.error(e)
        }
      }

      diff()

      cacheSources.set(id, response)
      return response
    },
    placeholderData: prev => prev,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

function NewsCard({ id, setHandleRef }: NewsCardProps) {
  const { refresh } = useRefetch()
  const { data, isFetching, isError } = useSourceQuery(id)
  const { isFocused, toggleFocus } = useFocusWith(id)

  const status = isError ? "err" : isFetching ? "sync" : "ok"

  return (
    <>
      <div className="hud-tag">
        <span className="hud-tag-label">
          {`${id.toUpperCase()} // ${sources[id].type === "hottest" ? "HOT_RANK" : "LIVE_FEED"}`}
        </span>
        <span className="flex items-center gap-2">
          <span className={$("hud-status", status, status !== "ok" && "hud-blink")}>
            {status === "err" ? "OFFLINE" : status === "sync" ? "SYNCING" : "ONLINE"}
          </span>
          <span className="hud-signal">
            {[4, 6, 8, 10].map((h, i) => <i key={h} className={$(isError && i > 0 && "off")} style={{ height: `${h}px` }} />)}
          </span>
        </span>
      </div>

      <div className="flex justify-between gap-2 px-3 pt-3 pb-2 items-center">
        <div className="flex gap-2 items-center min-w-0">
          <a
            className="hud-icon w-8 h-8 shrink-0 bg-cover"
            target="_blank"
            href={sources[id].home}
            title={sources[id].desc}
            style={{
              backgroundImage: `url(/icons/${id.split("-")[0]}.png)`,
            }}
          />
          <span className="flex flex-col min-w-0">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="hud-title text-xl font-bold truncate"
                title={sources[id].desc}
              >
                {sources[id].name}
              </span>
              {sources[id]?.title && <span className="hud-chip shrink-0">{sources[id].title}</span>}
            </span>
            <span className="font-hud text-xs color-[#8fb8d6]"><UpdatedTime isError={isError} updatedTime={data?.updatedTime} /></span>
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            title="刷新"
            className="hud-btn"
            onClick={() => refresh(id)}
          >
            <span className={$("i-ph:arrow-counter-clockwise-bold", isFetching && "animate-spin i-ph:circle-dashed-bold")} />
          </button>
          <button
            type="button"
            title="收藏"
            className={$("hud-btn", isFocused && "active")}
            onClick={toggleFocus}
          >
            <span className={isFocused ? "i-ph:star-fill" : "i-ph:star-bold"} />
          </button>
          {/* firefox cannot drag a button */}
          {setHandleRef && (
            <div
              ref={setHandleRef}
              title="拖动排序"
              className="hud-btn cursor-grab"
            >
              <span className="i-ph:dots-six-vertical-bold cursor-grab" />
            </div>
          )}
        </div>
      </div>

      <OverlayScrollbar
        className={$([
          "hud-screen h-full mx-3 p-2 overflow-y-auto",
          isFetching && `animate-pulse`,
        ])}
        options={{
          overflow: { x: "hidden" },
        }}
        defer
      >
        <div className={$("transition-opacity-500", isFetching && "op-20")}>
          {!!data?.items?.length && (sources[id].type === "hottest" ? <NewsListHot items={data.items} /> : <NewsListTimeLine items={data.items} />)}
        </div>
      </OverlayScrollbar>

      <div className="hud-footer px-3 py-1.5">
        <span className="truncate">{`FEED ${hudHex(id)} · ${data?.items?.length ?? 0} ITEMS`}</span>
        <span className="shrink-0">SECURE</span>
      </div>
    </>
  )
}

export function UpdatedTime({ isError, updatedTime }: { updatedTime: any, isError: boolean }) {
  const relativeTime = useRelativeTime(updatedTime ?? "")
  if (relativeTime) return `${relativeTime}更新`
  if (isError) return "获取失败"
  return "加载中..."
}

export function DiffNumber({ diff }: { diff: number }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    setShown(true)
    const timer = setTimeout(() => {
      setShown(false)
    }, 5000)
    return () => clearTimeout(timer)
  }, [setShown, diff])

  return (
    <AnimatePresence>
      { shown && (
        <motion.span
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 0.5, y: -7 }}
          exit={{ opacity: 0, y: -15 }}
          className={$("absolute left-0 text-xs", diff < 0 ? "text-green" : "text-red")}
        >
          {diff > 0 ? `+${diff}` : diff}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
export function ExtraInfo({ item }: { item: NewsItem }) {
  if (item?.extra?.info) {
    return <>{item.extra.info}</>
  }
  if (item?.extra?.icon) {
    const { url, scale } = typeof item.extra.icon === "string" ? { url: item.extra.icon, scale: undefined } : item.extra.icon
    return (
      <img
        src={url}
        style={{
          transform: `scale(${scale ?? 1})`,
        }}
        className="h-4 inline mt--1"
        referrerPolicy="no-referrer"
        onError={e => e.currentTarget.style.display = "none"}
      />
    )
  }
}

export function NewsUpdatedTime({ date }: { date: string | number }) {
  const relativeTime = useRelativeTime(date)
  return <>{relativeTime}</>
}
function NewsListHot({ items }: { items: NewsItem[] }) {
  const { width } = useWindowSize()
  return (
    <ol className="flex flex-col gap-1.5">
      {items?.map((item, i) => (
        <a
          href={width < 768 ? item.mobileUrl || item.url : item.url}
          target="_blank"
          key={item.id}
          title={item.extra?.hover}
          className="hud-row flex gap-2 items-stretch relative p-1 cursor-pointer [&_*]:cursor-pointer"
        >
          <span className={$("hud-rank", i < 3 && "top")}>
            {String(i + 1).padStart(2, "0")}
          </span>
          {!!item.extra?.diff && <DiffNumber diff={item.extra.diff} />}
          <span className="flex-1 self-center leading-snug">
            <span className="mr-2 text-[15px]">
              {item.title}
            </span>
            <span className="font-hud text-xs color-[#8fb8d6] truncate align-middle">
              <ExtraInfo item={item} />
            </span>
          </span>
          <span className="hud-meter">
            {[3, 5, 7, 9, 10].map((h, k) => (
              <i key={h} className={$(k >= 5 - Math.floor(i / 6) && "off")} style={{ height: `${h}px` }} />
            ))}
          </span>
        </a>
      ))}
    </ol>
  )
}

function NewsListTimeLine({ items }: { items: NewsItem[] }) {
  const { width } = useWindowSize()
  return (
    <ol className="hud-timeline flex flex-col gap-1">
      {items?.map(item => (
        <li key={`${item.id}-${item.pubDate || item?.extra?.date || ""}`} className="flex flex-col">
          <span className="flex items-center gap-2">
            <span className="hud-node" />
            <span className="hud-time">
              {(item.pubDate || item?.extra?.date) && (
                <>
                  [
                  <NewsUpdatedTime date={(item.pubDate || item?.extra?.date)!} />
                  ]
                </>
              )}
            </span>
            <span className="font-hud text-xs color-[#8fb8d6] truncate">
              <ExtraInfo item={item} />
            </span>
          </span>
          <a
            className="hud-row ml-3 px-1.5 py-0.5 text-[15px] leading-snug cursor-pointer [&_*]:cursor-pointer"
            href={width < 768 ? item.mobileUrl || item.url : item.url}
            title={item.extra?.hover}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.title}
          </a>
        </li>
      ))}
    </ol>
  )
}
