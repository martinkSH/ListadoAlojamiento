export const runtime = 'nodejs'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ── TourPlan SQL query ─────────────────────────────────────────────────────
const TP_RATES_QUERY = `
SELECT
  OPT.SUPPLIER    AS supplierCode,
  CRM.NAME        AS supplierName,
  OPT.LOCATION    AS locationCode,
  OPT.DESCRIPTION AS optionDesc,
  OPT.COMMENT     AS optionComment,
  OSR.PRICE_CODE  AS priceCode,
  OSR.DATE_FROM   AS dateFrom,
  OSR.DATE_TO     AS dateTo,
  tarifas.servItem AS roomType,
  tarifas.costFits AS fitsCost

FROM (
  -- Single
  SELECT OPD.OSR_ID, '1SS' AS servItem,
    ssFC.SS AS costFits
  FROM OPD
  JOIN OPD AS ssFC ON ssFC.RATE_TYPE='FC' AND ssFC.AGE_CATEGORY='AD'
  JOIN OSR ON OSR.OSR_ID = OPD.OSR_ID
  JOIN OPT ON OPT.OPT_ID = OSR.OPT_ID
  JOIN SOD ON SOD.SOD_ID = OPT.SOD_ID
  WHERE OPD.OSR_ID = ssFC.OSR_ID AND SOD.SINGLE_AVAIL = 1
  GROUP BY OPD.OSR_ID, ssFC.SS

  UNION ALL

  -- Double
  SELECT OPD.OSR_ID, '2DB' AS servItem,
    dbFC.TW AS costFits
  FROM OPD
  JOIN OPD AS dbFC ON dbFC.RATE_TYPE='FC' AND dbFC.AGE_CATEGORY='AD'
  JOIN OSR ON OSR.OSR_ID = OPD.OSR_ID
  JOIN OPT ON OPT.OPT_ID = OSR.OPT_ID
  JOIN SOD ON SOD.SOD_ID = OPT.SOD_ID
  WHERE OPD.OSR_ID = dbFC.OSR_ID AND SOD.DOUBLE_AVAIL = 1
  GROUP BY OPD.OSR_ID, dbFC.TW

  UNION ALL

  -- Triple
  SELECT OPD.OSR_ID, '3TR' AS servItem,
    trFC.TR AS costFits
  FROM OPD
  JOIN OPD AS trFC ON trFC.RATE_TYPE='FC' AND trFC.AGE_CATEGORY='AD'
  JOIN OSR ON OSR.OSR_ID = OPD.OSR_ID
  JOIN OPT ON OPT.OPT_ID = OSR.OPT_ID
  JOIN SOD ON SOD.SOD_ID = OPT.SOD_ID
  WHERE OPD.OSR_ID = trFC.OSR_ID AND SOD.TRIPLE_AVAIL = 1
  GROUP BY OPD.OSR_ID, trFC.TR

) AS tarifas

JOIN OSR ON OSR.OSR_ID = tarifas.OSR_ID
JOIN OPT ON OPT.OPT_ID = OSR.OPT_ID
JOIN CRM ON CRM.CODE   = OPT.SUPPLIER
JOIN LOC ON LOC.CODE   = OPT.LOCATION
JOIN SOD ON SOD.SOD_ID = OPT.SOD_ID

WHERE
  OPT.SERVICE    = 'AC'                   -- Solo alojamiento
  AND OPT.AC     IN ('Y','A')             -- Activo
  AND OSR.PRICE_CODE = 'NR'              -- Tarifa normal (excluye TD=festivos)
  AND tarifas.costFits > 0
  AND tarifas.costFits < 9000            -- Excluir 9999 (bloqueados)
  AND OSR.DATE_FROM >= '20260101'        -- Temporada 26-27 en adelante
`

// ── Room type mapping ───────────────────────────────────────────────────────
const ROOM_MAP: Record<string, string> = {
  '1SS': 'SGL',
  '2TW': 'DBL',
  '2DB': 'DBL',
  '3TR': 'TPL',
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // Auth: solo cron o admin
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    // Check session via cookie (browser calls)
    const { createClient } = await import('@/lib/supabase/server')
    const supabaseCheck = createClient()
    const { data: { user } } = await supabaseCheck.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const startedAt = new Date().toISOString()

  try {
    // Connect to TourPlan
    const sql = require('mssql')
    const config = {
      server:   'LA-SAYHUE.data.tourplan.net',
      port:     50409,
      database: 'LA-SAYHUE',
      user:     'excelLA-SAYHUE',
      password: process.env.TP_PASSWORD ?? 'o6rmFv7$RJnp14NzqI18',
      options: { encrypt: true, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 120000 },
    }

    const pool = await sql.connect(config)
    const result = await pool.request().query(TP_RATES_QUERY)
    const pool2 = await sql.connect(config)

    const TP_PC_QUERY = `
SELECT
  OPT.SUPPLIER    AS supplierCode,
  OPT.DESCRIPTION AS optionDesc,
  OSR.DATE_FROM   AS dateFrom,
  OSR.DATE_TO     AS dateTo,
  tarifas.servItem AS roomType,
  tarifas.costFits AS fitsCost
FROM (
  SELECT OPD.OSR_ID, '1SS' AS servItem, ssFC.SS AS costFits
  FROM OPD
  JOIN OPD AS ssFC ON ssFC.RATE_TYPE='FC' AND ssFC.AGE_CATEGORY='AD'
  JOIN OSR ON OSR.OSR_ID = OPD.OSR_ID
  JOIN OPT ON OPT.OPT_ID = OSR.OPT_ID
  JOIN SOD ON SOD.SOD_ID = OPT.SOD_ID
  WHERE OPD.OSR_ID = ssFC.OSR_ID AND SOD.SINGLE_AVAIL = 1
  GROUP BY OPD.OSR_ID, ssFC.SS
  UNION ALL
  SELECT OPD.OSR_ID, '2DB' AS servItem, dbFC.TW AS costFits
  FROM OPD
  JOIN OPD AS dbFC ON dbFC.RATE_TYPE='FC' AND dbFC.AGE_CATEGORY='AD'
  JOIN OSR ON OSR.OSR_ID = OPD.OSR_ID
  JOIN OPT ON OPT.OPT_ID = OSR.OPT_ID
  JOIN SOD ON SOD.SOD_ID = OPT.SOD_ID
  WHERE OPD.OSR_ID = dbFC.OSR_ID AND SOD.DOUBLE_AVAIL = 1
  GROUP BY OPD.OSR_ID, dbFC.TW
  UNION ALL
  SELECT OPD.OSR_ID, '3TR' AS servItem, trFC.TR AS costFits
  FROM OPD
  JOIN OPD AS trFC ON trFC.RATE_TYPE='FC' AND trFC.AGE_CATEGORY='AD'
  JOIN OSR ON OSR.OSR_ID = OPD.OSR_ID
  JOIN OPT ON OPT.OPT_ID = OSR.OPT_ID
  JOIN SOD ON SOD.SOD_ID = OPT.SOD_ID
  WHERE OPD.OSR_ID = trFC.OSR_ID AND SOD.TRIPLE_AVAIL = 1
  GROUP BY OPD.OSR_ID, trFC.TR
) AS tarifas
JOIN OSR ON OSR.OSR_ID = tarifas.OSR_ID
JOIN OPT ON OPT.OPT_ID = OSR.OPT_ID
JOIN SOD ON SOD.SOD_ID = OPT.SOD_ID
WHERE
  OPT.SUPPLIER       = '1743'
  AND OPT.AC         IN ('Y','A')
  AND OSR.PRICE_CODE = 'NR'
  AND tarifas.costFits > 0
  AND tarifas.costFits < 9000
  AND OSR.DATE_FROM  >= '20260401'
  AND OSR.DATE_TO    >= '20260401'
`


    const rows = result.recordset as any[]
    console.log(`[tp-rates] Raw rows from TP: ${rows.length}`)

    // Group and get max rate per supplier + option + room_base
    // Keep all periods — one row per supplier+option+room+date_from
    const rateMap = new Map<string, {
      supplier_code: number
      option_desc: string
      option_comment: string
      room_base: string
      tp_net_rate: number
      date_from: string
      date_to: string
    }>()

    for (const row of rows) {
      const roomBase = ROOM_MAP[row.roomType]
      if (!roomBase) continue

      const cost = Number(row.fitsCost)
      if (!cost || cost <= 0 || cost >= 9000) continue

      const dateFrom = row.dateFrom instanceof Date
        ? row.dateFrom.toISOString().split('T')[0]
        : String(row.dateFrom ?? '').slice(0, 10)
      const dateTo = row.dateTo instanceof Date
        ? row.dateTo.toISOString().split('T')[0]
        : String(row.dateTo ?? '').slice(0, 10)

      if (!dateFrom) continue

      const key = `${row.supplierCode}__${row.optionDesc}__${roomBase}__${dateFrom}`
      if (!rateMap.has(key)) {
        rateMap.set(key, {
          supplier_code: Number(row.supplierCode),
          option_desc: String(row.optionDesc ?? '').trim(),
          option_comment: String(row.optionComment ?? '').trim(),
          room_base: roomBase,
          tp_net_rate: cost,
          date_from: dateFrom,
          date_to: dateTo,
        })
      }
    }

    const rates = Array.from(rateMap.values())
    console.log(`[tp-rates] Unique rates after grouping: ${rates.length}`)

    // Get all hotels with their tourplan_code
    const { data: hotels } = await supabase
      .from('hotels')
      .select('id, tourplan_code')
      .eq('active', true)
      .not('tourplan_code', 'is', null) as any

    const hotelMap = new Map<number, string>()
    for (const h of (hotels ?? [])) {
      if (h.tourplan_code) hotelMap.set(Number(h.tourplan_code), h.id)
    }

    // Build upsert rows
    const upsertRows = rates.map(r => ({
      hotel_id: hotelMap.get(r.supplier_code) ?? null,
      supplier_code: r.supplier_code,
      option_desc: r.option_desc,
      option_comment: r.option_comment,
      room_base: r.room_base,
      tp_net_rate: r.tp_net_rate,
      date_from: r.date_from,
      date_to: r.date_to,
      season: '26-27',
      synced_at: startedAt,
    }))

    // Only keep rows with a matched hotel — no point storing unmatched
    const matchedRows = upsertRows.filter(r => r.hotel_id !== null)
    const matched = matchedRows.length
    console.log(`[tp-rates] Hotels matched: ${matched}/${rates.length}`)

    // Count existing before upsert
    const { count: countBefore } = await supabase
      .from('tp_rates')
      .select('*', { count: 'exact', head: true })
      .not('hotel_id', 'is', null) as any

    // Upsert in batches of 500
    const BATCH = 500
    for (let i = 0; i < matchedRows.length; i += BATCH) {
      const chunk = matchedRows.slice(i, i + BATCH)
      const { error } = await supabase
        .from('tp_rates')
        .upsert(chunk, { onConflict: 'supplier_code,option_desc,room_base,date_from' })
      if (error) throw new Error(`Upsert error: ${error.message}`)
    }

    // Count after upsert
    const { count: countAfter } = await supabase
      .from('tp_rates')
      .select('*', { count: 'exact', head: true })
      .not('hotel_id', 'is', null) as any

    const ratesNew = Math.max(0, (countAfter ?? 0) - (countBefore ?? 0))
    const ratesUnchanged = matchedRows.length - ratesNew
    const ratesUpdated = 0 // upsert doesn't distinguish updated from unchanged easily

    // Update NT rates using the highest rate for the season per mapped room
    const { data: roomMaps } = await supabase
      .from('hotel_tp_room_map')
      .select('hotel_id, option_desc') as any

    let ntUpdated = 0
    for (const map of (roomMaps ?? [])) {
      // Get max rate per room_base for this hotel+option across all periods
      const getMaxRate = (base: string) => {
        const matching = matchedRows.filter(r =>
          r.hotel_id === map.hotel_id &&
          r.option_desc === map.option_desc &&
          r.room_base === base
        )
        if (!matching.length) return null
        return matching.reduce((max, r) => r.tp_net_rate > max.tp_net_rate ? r : max)
      }

      const sgl = getMaxRate('SGL')
      const dbl = getMaxRate('DBL')
      const tpl = getMaxRate('TPL')

      if (!sgl && !dbl && !tpl) continue

      const rateRows = [
        sgl ? { hotel_id: map.hotel_id, room_base: 'SGL', season: '26-27', net_rate: sgl.tp_net_rate } : null,
        dbl ? { hotel_id: map.hotel_id, room_base: 'DBL', season: '26-27', net_rate: dbl.tp_net_rate } : null,
        tpl ? { hotel_id: map.hotel_id, room_base: 'TPL', season: '26-27', net_rate: tpl.tp_net_rate } : null,
      ].filter(Boolean)

      for (const rateRow of rateRows) {
        const { error } = await supabase
          .from('rates')
          .upsert(rateRow, { onConflict: 'hotel_id,season,room_base' })
        if (error) {
          console.error(`[tp-rates] rates upsert error:`, error.message, JSON.stringify(rateRow))
        } else {
          ntUpdated++
        }
      }
    }

    console.log(`[tp-rates] NT rates updated: ${ntUpdated}`)

    // ── Fetch and process PC rates ──────────────────────────────────────────
    const pcResult = await pool2.request().query(TP_PC_QUERY)
    const pcRows = pcResult.recordset as any[]
    console.log(`[tp-rates] PC rows from TP: ${pcRows.length}`)

    // Build category map: 'INN' → 'Inn', 'COMFORT' → 'Comfort', etc.
    const CAT_MAP: Record<string, string> = {
      'INN': 'Inn', 'COMFORT': 'Comfort', 'SUPERIOR': 'Superior',
      'LUXURY': 'Luxury', 'APART': 'Inn/Apart',
    }

    // Parse option_desc: "COMFORT BUE" → { cat: 'Comfort', destCode: 'BUE' }
    const parseOptionDesc = (desc: string): { cat: string; destCode: string } | null => {
      const parts = desc.trim().split(' ')
      if (parts.length < 2) return null
      const destCode = parts[parts.length - 1]
      const catRaw = parts.slice(0, parts.length - 1).join(' ').replace('/ ', '/').trim()
      const cat = CAT_MAP[catRaw] ?? CAT_MAP[parts[0]] ?? null
      if (!cat) return null
      return { cat, destCode }
    }

    // Get all destinations
    const { data: allDests } = await supabase.from('destinations').select('id, code') as any
    const destMap = new Map<string, string>()
    for (const d of (allDests ?? [])) destMap.set(d.code, d.id)

    // Get all hotels with category and destination
    const { data: allHotels } = await supabase
      .from('hotels')
      .select('id, category, destination_id')
      .eq('active', true) as any

    // Build PC rate map: destCode+cat+roomBase+dateFrom → rate
    const pcRateMap = new Map<string, any>()
    for (const row of pcRows) {
      const roomBase = ROOM_MAP[row.roomType]
      if (!roomBase) continue
      const cost = Number(row.fitsCost)
      if (!cost || cost <= 0) continue
      const parsed = parseOptionDesc(String(row.optionDesc ?? ''))
      if (!parsed) continue
      const dateFrom = row.dateFrom instanceof Date
        ? row.dateFrom.toISOString().split('T')[0]
        : String(row.dateFrom ?? '').slice(0, 10)
      const dateTo = row.dateTo instanceof Date
        ? row.dateTo.toISOString().split('T')[0]
        : String(row.dateTo ?? '').slice(0, 10)
      const key = `${parsed.destCode}__${parsed.cat}__${roomBase}__${dateFrom}`
      pcRateMap.set(key, { ...parsed, roomBase, cost, dateFrom, dateTo })
    }

    // Update pc_rate in rates table for each hotel
    let pcUpdated = 0
    for (const hotel of (allHotels ?? [])) {
      const destCode = destMap.get(hotel.destination_id) 
      // Need dest code from id - rebuild reverse map
      const destCodeForHotel = Array.from(destMap.entries()).find(([code, id]) => id === hotel.destination_id)?.[0]
      if (!destCodeForHotel || !hotel.category) continue

      // Find max PC rate for this dest+category across all periods for season
      for (const base of ['SGL', 'DBL', 'TPL']) {
        let maxRate = 0
        let maxDateFrom = ''
        let maxDateTo = ''
        for (const [key, val] of pcRateMap.entries()) {
          if (val.destCode === destCodeForHotel && val.cat === hotel.category && val.roomBase === base) {
            if (val.cost > maxRate) {
              maxRate = val.cost
              maxDateFrom = val.dateFrom
              maxDateTo = val.dateTo
            }
          }
        }
        if (!maxRate) continue

        const { error } = await supabase
          .from('rates')
          .upsert({
            hotel_id: hotel.id,
            room_base: base,
            season: '26-27',
            pc_rate: maxRate,
          }, { onConflict: 'hotel_id,season,room_base' })
        if (!error) pcUpdated++
      }
    }

    console.log(`[tp-rates] PC rates updated: ${pcUpdated}`)

    // Log sync
    await supabase.from('tp_sync_log').insert({
      rates_updated: matchedRows.length,
      hotels_matched: matched,
      status: 'ok',
    })

    return NextResponse.json({
      ok: true,
      synced_at: startedAt,
      rates_total: matchedRows.length,
      hotels_matched: matched,
      hotels_unique: new Set(matchedRows.map((r: any) => r.hotel_id)).size,
      nt_updated: ntUpdated,
      pc_updated: pcUpdated,
    })

  } catch (err: any) {
    console.error('[tp-rates]', err)
    await supabase.from('tp_sync_log').insert({
      status: 'error',
      error_msg: err.message,
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET = mismo que POST (para testing manual)
export async function GET(req: Request) {
  return POST(req)
}
