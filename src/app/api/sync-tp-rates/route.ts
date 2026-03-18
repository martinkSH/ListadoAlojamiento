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
  AND OSR.DATE_FROM >= '20260501'        -- Temporada 26-27 en adelante
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
    const supabaseCheck = createAdminClient()
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
    await pool.close()

    const rows = result.recordset as any[]
    console.log(`[tp-rates] Raw rows from TP: ${rows.length}`)

    // Group and get max rate per supplier + option + room_base
    const rateMap = new Map<string, {
      supplier_code: number
      option_desc: string
      option_comment: string
      room_base: string
      tp_net_rate: number
    }>()

    for (const row of rows) {
      const roomBase = ROOM_MAP[row.roomType]
      if (!roomBase) continue

      const cost = Number(row.fitsCost)
      if (!cost || cost <= 0 || cost >= 9000) continue

      const key = `${row.supplierCode}__${row.optionDesc}__${roomBase}`
      const existing = rateMap.get(key)

      // Keep the highest rate (tarifa más alta no festiva)
      if (!existing || cost > existing.tp_net_rate) {
        rateMap.set(key, {
          supplier_code: Number(row.supplierCode),
          option_desc: String(row.optionDesc ?? '').trim(),
          option_comment: String(row.optionComment ?? '').trim(),
          room_base: roomBase,
          tp_net_rate: cost,
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
      season: '26-27',
      synced_at: startedAt,
    }))

    const matched = upsertRows.filter(r => r.hotel_id !== null).length
    console.log(`[tp-rates] Hotels matched: ${matched}/${rates.length}`)

    // Upsert in batches of 500
    const BATCH = 500
    for (let i = 0; i < upsertRows.length; i += BATCH) {
      const chunk = upsertRows.slice(i, i + BATCH)
      const { error } = await supabase
        .from('tp_rates')
        .upsert(chunk, { onConflict: 'supplier_code,option_desc,room_base,season' })
      if (error) throw new Error(`Upsert error: ${error.message}`)
    }

    // Log sync
    await supabase.from('tp_sync_log').insert({
      rates_updated: upsertRows.length,
      hotels_matched: matched,
      status: 'ok',
    })

    return NextResponse.json({
      ok: true,
      synced_at: startedAt,
      rates_updated: upsertRows.length,
      hotels_matched: matched,
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
