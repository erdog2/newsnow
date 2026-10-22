import { useQuery } from "@tanstack/react-query"

interface Stats {
  pv: number
  uv: number
  todayPv: number
  todayUv: number
}

function visitorId() {
  const key = "visitor-id"
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    localStorage.setItem(key, id)
  }
  return id
}

export function useVisitStats() {
  return useQuery({
    queryKey: ["visit"],
    queryFn: async () => await myFetch<Stats>("/visit", {
      method: "POST",
      body: { vid: visitorId() },
    }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

const fmt = (n: number) => n.toLocaleString("en-US")

export function VisitStats({ className }: { className?: string }) {
  const { data } = useVisitStats()
  if (!data) return null
  return (
    <span className={$("font-hud whitespace-nowrap", className)} title={`今日访问 ${data.todayPv} 次 · 今日访客 ${data.todayUv} 人 · 累计访问 ${data.pv} 次 · 累计访客 ${data.uv} 人`}>
      <span className="color-[#3dff8f] hud-blink">● </span>
      {`VISITS ${fmt(data.pv)} · TODAY ${fmt(data.todayPv)} · USERS ${fmt(data.uv)}`}
    </span>
  )
}
