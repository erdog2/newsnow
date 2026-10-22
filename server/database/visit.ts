import process from "node:process"
import type { Database } from "db0"

export interface VisitStats {
  pv: number
  uv: number
  todayPv: number
  todayUv: number
}

// 按北京时间划分自然日
function today() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function rowsOf(res: any) {
  return (res?.results ?? res) as any[]
}

export class VisitTable {
  private db
  constructor(db: Database) {
    this.db = db
  }

  async init() {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS visit_daily (
        day TEXT PRIMARY KEY,
        pv INTEGER NOT NULL DEFAULT 0,
        uv INTEGER NOT NULL DEFAULT 0
      );
    `).run()
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS visitor (
        id TEXT PRIMARY KEY,
        first_seen INTEGER,
        last_day TEXT
      );
    `).run()
    logger.success(`init visit table`)
  }

  async record(vid?: string) {
    const day = today()
    let newToday = 0
    if (vid) {
      const row = await this.db.prepare(`SELECT last_day FROM visitor WHERE id = ?`).get(vid) as { last_day: string } | undefined
      if (!row) {
        await this.db.prepare(`INSERT INTO visitor (id, first_seen, last_day) VALUES (?, ?, ?)`).run(vid, Date.now(), day)
        newToday = 1
      } else if (row.last_day !== day) {
        await this.db.prepare(`UPDATE visitor SET last_day = ? WHERE id = ?`).run(day, vid)
        newToday = 1
      }
    }
    await this.db.prepare(`
      INSERT INTO visit_daily (day, pv, uv) VALUES (?, 1, ?)
      ON CONFLICT(day) DO UPDATE SET pv = pv + 1, uv = uv + excluded.uv
    `).run(day, newToday)
  }

  async stats(): Promise<VisitStats> {
    const day = today()
    const [total] = rowsOf(await this.db.prepare(`SELECT COALESCE(SUM(pv), 0) AS pv FROM visit_daily`).all())
    const [visitors] = rowsOf(await this.db.prepare(`SELECT COUNT(*) AS uv FROM visitor`).all())
    const t = await this.db.prepare(`SELECT pv, uv FROM visit_daily WHERE day = ?`).get(day) as { pv: number, uv: number } | undefined
    return {
      pv: Number(total?.pv ?? 0),
      uv: Number(visitors?.uv ?? 0),
      todayPv: Number(t?.pv ?? 0),
      todayUv: Number(t?.uv ?? 0),
    }
  }
}

export async function getVisitTable() {
  try {
    const db = useDatabase()
    const table = new VisitTable(db)
    if (process.env.INIT_TABLE !== "false") await table.init()
    return table
  } catch (e) {
    logger.error("failed to init visit table ", e)
  }
}
