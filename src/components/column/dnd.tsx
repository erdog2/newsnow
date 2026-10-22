import type { PropsWithChildren } from "react"
import type { SourceID } from "@shared/types"
import type { BaseEventPayload, ElementDragType } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types"
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge"
import { createPortal } from "react-dom"
import { useThrottleFn } from "ahooks"
import { useAutoAnimate } from "@formkit/auto-animate/react"
import { motion } from "framer-motion"
import { useWindowSize } from "react-use"
import { isMobile } from "react-device-detect"
import { DndContext } from "../common/dnd"
import { useSortable } from "../common/dnd/useSortable"
import { OverlayScrollbar } from "../common/overlay-scrollbar"
import type { ItemsProps } from "./card"
import { CardWrapper } from "./card"
import { currentColumnIDAtom, currentSourcesAtom } from "~/atoms"
import { hudColor } from "~/utils/hud"

const AnimationDuration = 200
const WIDTH = 350
export function Dnd() {
  const [items, setItems] = useAtom(currentSourcesAtom)
  const currentColumnID = useAtomValue(currentColumnIDAtom)
  const sortable = currentColumnID === "focus"
  const [parent] = useAutoAnimate({ duration: AnimationDuration })
  useEntireQuery(items)
  const { width } = useWindowSize()
  const minWidth = useMemo(() => {
    // double padding = 32
    return Math.min(width - 32, WIDTH)
  }, [width])

  if (!items.length) return null

  return (
    <DndWrapper items={items} setItems={setItems} isSingleColumn={isMobile} sortable={sortable}>
      <OverlayScrollbar defer className="overflow-x-auto">
        <motion.ol
          className={isMobile
            ? "flex px-2 gap-6 pb-4 scroll-smooth"
            : "grid w-full gap-6"}
          ref={parent}
          style={isMobile
            ? {
                // 横向滚动布局
              }
            : {
                gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
              }}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {
              opacity: 0,
            },
            visible: {
              opacity: 1,
              transition: {
                delayChildren: 0.1,
                staggerChildren: 0.1,
              },
            },
          }}
        >
          {items.map((id, index) => (
            <motion.li
              key={id}
              className={$(isMobile && "flex-shrink-0", isMobile && index === items.length - 1 && "mr-2")}
              style={isMobile ? { width: `${width - 16 > WIDTH ? WIDTH : width - 16}px` } : undefined}
              transition={{
                type: "tween",
                duration: AnimationDuration / 1000,
              }}
              variants={{
                hidden: {
                  y: 20,
                  opacity: 0,
                },
                visible: {
                  y: 0,
                  opacity: 1,
                },
              }}
            >
              <SortableCardWrapper id={id} sortable={sortable} />
            </motion.li>
          ))}
        </motion.ol>
      </OverlayScrollbar>
      {isMobile && (
        <div className="flex justify-center">
          <span className="font-hud text-xs color-[#22e4ff]/60 text-center">{"<< 左右滑动查看更多 >>"}</span>
        </div>
      )}
    </DndWrapper>
  )
}

function DndWrapper({ items, setItems, isSingleColumn, sortable, children }: PropsWithChildren<{
  items: SourceID[]
  setItems: (items: SourceID[]) => void
  isSingleColumn: boolean
  sortable: boolean
}>) {
  const onDropTargetChange = useCallback(({ location, source }: BaseEventPayload<ElementDragType>) => {
    const traget = location.current.dropTargets[0]
    if (!traget?.data || !source?.data) return
    const closestEdgeOfTarget = extractClosestEdge(traget.data)
    const fromIndex = items.indexOf(source.data.id as SourceID)
    const toIndex = items.indexOf(traget.data.id as SourceID)
    if (fromIndex === toIndex || fromIndex === -1 || toIndex === -1) return
    const update = reorderWithEdge({
      list: items,
      startIndex: fromIndex,
      indexOfTarget: toIndex,
      closestEdgeOfTarget,
      axis: isSingleColumn ? "horizontal" : "vertical",
    })
    setItems(update)
  }, [items, setItems, isSingleColumn])
  // 避免动画干扰
  const { run } = useThrottleFn(onDropTargetChange, {
    leading: true,
    trailing: true,
    wait: AnimationDuration,
  })
  const { el } = useAtomValue(goToTopAtom)
  if (!sortable) return children

  return (
    <DndContext onDropTargetChange={run} autoscroll={el ? { element: el } : undefined}>
      {children}
    </DndContext>
  )
}

function CardOverlay({ id }: { id: SourceID }) {
  return (
    <div
      className="hud-panel flex flex-col p-3"
      style={{ "--hud": hudColor(sources[id].color) } as React.CSSProperties}
    >
      <div className="flex justify-between mx-1 items-center">
        <div className="flex gap-2 items-center">
          <div
            className="hud-icon w-8 h-8 bg-cover"
            style={{
              backgroundImage: `url(/icons/${id.split("-")[0]}.png)`,
            }}
          />
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              <span className="hud-title text-xl font-bold">
                {sources[id].name}
              </span>
              {sources[id]?.title && <span className="hud-chip">{sources[id].title}</span>}
            </span>
            <span className="hud-status ok hud-blink">DRAGGING...</span>
          </span>
        </div>
        <div className="hud-btn cursor-grabbing">
          <span className="i-ph:dots-six-vertical-bold" />
        </div>
      </div>
    </div>
  )
}

function SortableCardWrapper({ id, sortable }: ItemsProps & { sortable: boolean }) {
  const {
    isDragging,
    setNodeRef,
    setHandleRef,
    OverlayContainer,
  } = useSortable({ id })

  useEffect(() => {
    if (OverlayContainer) {
      OverlayContainer!.className += " hud-overlay"
    }
  }, [OverlayContainer])

  return (
    <>
      <CardWrapper
        ref={setNodeRef}
        id={id}
        isDragging={isDragging}
        setHandleRef={sortable ? setHandleRef : undefined}
      />
      {OverlayContainer && createPortal(<CardOverlay id={id} />, OverlayContainer)}
    </>
  )
}
