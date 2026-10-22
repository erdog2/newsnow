import type { FixedColumnID } from "@shared/types"
import { useTitle } from "react-use"
import { NavBar } from "../navbar"
import { Book } from "./book"
import { Dnd } from "./dnd"
import { CardDeck } from "./cards"
import { currentColumnIDAtom } from "~/atoms"
import { useTheme } from "~/hooks/useTheme"

export function Column({ id }: { id: FixedColumnID }) {
  const [currentColumnID, setCurrentColumnID] = useAtom(currentColumnIDAtom)
  const { theme } = useTheme()
  useEffect(() => {
    setCurrentColumnID(id)
  }, [id, setCurrentColumnID])

  useTitle(`News | ${metadata[id].name}`)

  return (
    <>
      <div className="flex justify-center md:hidden mb-6">
        <NavBar />
      </div>
      {id === currentColumnID && (
        theme === "book"
          ? <Book key={id} />
          : theme === "cards" ? <CardDeck key={id} /> : <Dnd />
      )}
    </>
  )
}
