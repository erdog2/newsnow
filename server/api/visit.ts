import { getVisitTable } from "#/database/visit"

export default defineEventHandler(async (event) => {
  const table = await getVisitTable()
  if (!table) throw createError({ statusCode: 503, message: "visit stats unavailable" })
  if (event.method === "POST") {
    const body = await readBody<{ vid?: string }>(event).catch(() => undefined)
    const vid = typeof body?.vid === "string" && /^[\w-]{8,64}$/.test(body.vid) ? body.vid : undefined
    await table.record(vid)
  }
  return await table.stats()
})
