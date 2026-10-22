import { fixedColumnIds, metadata } from "@shared/metadata"
import { Link } from "@tanstack/react-router"
import { currentColumnIDAtom } from "~/atoms"

export function NavBar() {
  const currentId = useAtomValue(currentColumnIDAtom)
  const { toggle } = useSearchBar()
  return (
    <span className="hud-nav-wrap inline-block max-w-full">
      <span className="hud-nav overflow-x-auto">
        <button
          type="button"
          onClick={() => toggle(true)}
          className="hud-nav-item"
        >
          更多
        </button>
        {fixedColumnIds.map(columnId => (
          <Link
            key={columnId}
            to="/c/$column"
            params={{ column: columnId }}
            className={$("hud-nav-item", currentId === columnId && "active")}
          >
            {metadata[columnId].name}
          </Link>
        ))}
      </span>
    </span>
  )
}
