import { useEffect } from "react"

export type Theme = "hud" | "book" | "cards"

export const themes: { id: Theme, name: string, icon: string }[] = [
  { id: "hud", name: "科技风", icon: "i-ph:squares-four-bold" },
  { id: "book", name: "书本风", icon: "i-ph:book-open-text-bold" },
  { id: "cards", name: "抽卡风", icon: "i-ph:cards-bold" },
]

const themeAtom = atomWithStorage<Theme>("theme", "hud", undefined, { getOnInit: true })

export function useTheme() {
  const [stored, setTheme] = useAtom(themeAtom)
  const theme: Theme = themes.some(t => t.id === stored) ? stored : "hud"
  const nextTheme = themes[(themes.findIndex(t => t.id === theme) + 1) % themes.length]
  const toggleTheme = () => setTheme(nextTheme.id)
  return { theme, isBook: theme === "book", isCards: theme === "cards", isHud: theme === "hud", nextTheme, setTheme, toggleTheme }
}

export function useApplyTheme() {
  const { theme } = useTheme()
  useEffect(() => {
    const cl = document.documentElement.classList
    cl.toggle("theme-book", theme === "book")
    cl.toggle("theme-cards", theme === "cards")
  }, [theme])
}
