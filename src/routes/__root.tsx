import "~/styles/globals.css"
import "~/styles/cards.css"
import "virtual:uno.css"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { isMobile } from "react-device-detect"
import { Header } from "~/components/header"
import { GlobalOverlayScrollbar } from "~/components/common/overlay-scrollbar"
import { Toast } from "~/components/common/toast"
import { SearchBar } from "~/components/common/search-bar"
import { HudBackground } from "~/components/common/hud-background"
import { VisitStats } from "~/components/common/visit-stats"
import { useApplyTheme, useTheme } from "~/hooks/useTheme"

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
})

function NotFoundComponent() {
  const nav = Route.useNavigate()
  nav({
    to: "/",
  })
}

function RootComponent() {
  useOnReload()
  useSync()
  usePWA()
  useApplyTheme()
  const { theme, isHud } = useTheme()
  return (
    <>
      {isHud && <HudBackground />}
      <GlobalOverlayScrollbar
        className={$([
          !isMobile && "px-4",
          "relative z-1 h-full overflow-x-auto",
          "md:(px-10)",
          "lg:(px-24)",
        ])}
      >
        <header
          className={$([
            "hud-header grid items-center gap-2 py-3 px-3 mb-4",
            "md:(px-5) lg:(py-4)",
            "sticky top-0 z-10 backdrop-blur-md",
          ])}
          style={{
            gridTemplateColumns: "1fr auto 1fr",
          }}
        >
          <Header />
        </header>
        <main className={$([
          "mt-2",
          "min-h-[calc(100vh-180px)]",
          "md:(min-h-[calc(100vh-175px)])",
          "lg:(min-h-[calc(100vh-194px)])",
        ])}
        >
          <Outlet />
        </main>
        <div className={$("flex justify-center py-4 md:py-6 text-[10px] md:text-[11px] tracking-wider", theme === "book" ? "color-[#d6b36a]/70" : theme === "cards" ? "color-[#a5b4fc]/70" : "color-[#22e4ff]/70")}>
          <VisitStats />
        </div>
      </GlobalOverlayScrollbar>
      <Toast />
      <SearchBar />
      {import.meta.env.DEV && (
        <>
          <ReactQueryDevtools buttonPosition="bottom-left" />
          <TanStackRouterDevtools position="bottom-right" />
        </>
      )}
    </>
  )
}
