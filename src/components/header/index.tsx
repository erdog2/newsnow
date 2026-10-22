import { Link } from "@tanstack/react-router"
import { useIsFetching } from "@tanstack/react-query"
import type { SourceID } from "@shared/types"
import { NavBar } from "../navbar"
import { currentSourcesAtom, goToTopAtom } from "~/atoms"
import type { Theme } from "~/hooks/useTheme"
import { useTheme } from "~/hooks/useTheme"

function GoTop() {
  const { ok, fn: goToTop } = useAtomValue(goToTopAtom)
  return (
    <button
      type="button"
      title="Go To Top"
      className={$("i-ph:arrow-fat-up-duotone", ok ? "op-50 btn" : "op-0")}
      onClick={goToTop}
    />
  )
}

function Refresh() {
  const currentSources = useAtomValue(currentSourcesAtom)
  const { refresh } = useRefetch()
  const refreshAll = useCallback(() => refresh(...currentSources), [refresh, currentSources])

  const isFetching = useIsFetching({
    predicate: (query) => {
      const [type, id] = query.queryKey as ["source" | "entire", SourceID]
      return (type === "source" && currentSources.includes(id)) || type === "entire"
    },
  })

  return (
    <button type="button" title="Refresh" className="hud-ring cursor-pointer" onClick={refreshAll}>
      <span className={$("text-xl i-ph:arrow-counter-clockwise-bold", isFetching && "animate-spin i-ph:circle-dashed-bold")} />
    </button>
  )
}

function ThemeSwitch() {
  const { nextTheme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      title={`切换到${nextTheme.name}`}
      className="hud-ring cursor-pointer"
      onClick={toggleTheme}
    >
      <span className={$("text-xl", nextTheme.icon)} />
    </button>
  )
}

const brand: Record<Theme, { logo: string, tagline: string, text: string, dot: string, tools: string }> = {
  hud: {
    logo: "drop-shadow-[0_0_8px_rgba(34,228,255,0.6)]",
    tagline: "LIVE SYSTEM ONLINE",
    text: "color-[#22e4ff]/80",
    dot: "color-[#3dff8f]",
    tools: "color-[#22e4ff]",
  },
  book: {
    logo: "sepia-30",
    tagline: "THE DAILY NEWS BOOK",
    text: "color-[#d6b36a]/80",
    dot: "color-[#e0a458]",
    tools: "color-[#d6b36a]",
  },
  cards: {
    logo: "drop-shadow-[0_0_10px_rgba(132,204,252,0.55)]",
    tagline: "DRAW YOUR NEWS",
    text: "color-[#a5b4fc]/85",
    dot: "color-[#f6ad20]",
    tools: "color-[#c7d2fe]",
  },
}

const waveHeights = [6, 12, 18, 9, 22, 14, 7, 16, 20, 10, 5, 13, 19, 8, 15, 11]

function Wave() {
  return (
    <span className="hud-wave hidden lg:flex ml-3">
      {waveHeights.map((h, i) => (
        <i key={i} style={{ height: `${h}px`, animationDelay: `${(i % 5) * -0.2}s` }} />
      ))}
    </span>
  )
}

export function Header() {
  const { theme, isHud } = useTheme()
  const b = brand[theme]
  return (
    <>
      <span className="flex items-center justify-self-start min-w-0">
        <Link to="/" className="flex gap-2 items-center">
          <div
            className={$("h-9 w-9 md:(h-10 w-10) bg-cover shrink-0", b.logo)}
            title="logo"
            style={{ backgroundImage: "url(/icon.svg)" }}
          />
          <span className="flex flex-col">
            <span className="hud-logo-text text-2xl md:text-3xl font-brand line-height-none!">News</span>
            <span className={$("font-hud text-[9px] md:text-[10px] whitespace-nowrap", b.text)}>
              <span className={$("hud-blink", b.dot)}>● </span>
              {b.tagline}
            </span>
          </span>
        </Link>
        <Wave />
      </span>
      <span className="justify-self-center">
        <span className="hidden md:(inline-block)">
          <NavBar />
        </span>
      </span>
      <span className={$("justify-self-end flex gap-3 items-center text-xl", b.tools)}>
        {isHud && <GoTop />}
        <ThemeSwitch />
        <Refresh />
      </span>
    </>
  )
}
