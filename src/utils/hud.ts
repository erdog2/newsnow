import type { Color } from "@shared/types"

const neon: Partial<Record<Color, string>> = {
  primary: "#ff3b5c",
  red: "#ff3b5c",
  rose: "#ff4d8d",
  pink: "#ff5bd1",
  fuchsia: "#e879f9",
  purple: "#b98cff",
  violet: "#a78bfa",
  indigo: "#8b9bff",
  blue: "#38c6ff",
  sky: "#38bdf8",
  cyan: "#22e4ff",
  teal: "#2df5d2",
  emerald: "#1ff5a6",
  green: "#3dff8f",
  lime: "#b5ff3d",
  yellow: "#ffe14d",
  amber: "#ffb020",
  orange: "#ff9a1f",
  gray: "#8fb8d6",
  slate: "#9fb4ff",
  zinc: "#a8c4d8",
  neutral: "#a8c4d8",
  stone: "#c8b8a8",
}

export function hudColor(color?: Color) {
  return (color && neon[color]) || "#22e4ff"
}

export function hudHex(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xFFF
  return `0x${h.toString(16).toUpperCase().padStart(3, "0")}`
}
