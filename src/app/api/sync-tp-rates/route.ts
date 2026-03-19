export const runtime = 'nodejs'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ── Main handler ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // Auth: cron or admin
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabaseCheck = createClient()
    const { data: { user } } = await supabaseCheck.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const startedAt = new Date().toISOString()
  const today = new Date().toISOString().split('T')[0]
  const todayTP = today.replace(/-/g, '') // YYYYMMDD for TP

  try {
    const sql = require('mssql')
    const config: any = {
      server: 'LA-SAYHUE.data.tourplan.net',
      port: 50409,
      database: 'LA-SAYHUE',
      user: 'excelLA-SAYHUE',
      password: process.env.TP_PASSWORD ?? 'o6rmFv7$RJnp14NzqI18',
      options: { encrypt: true, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 120000 },
    }

    // ── Step 1: Get all supplier codes from our hotels ─────────────────────
    const { data: hotels } = await supabase
      .from('hotels')
      .select('id, tourplan_code, category, destination_id, destinations(code)')
      .eq('active', true)
      .not('tourplan_code', 'is', null) as any

    const supplierCodes = Array.from(new Set(
      (hotels ?? [])
        .map((h: any) => h.tourplan_code?.trim())
        .filter(Boolean)
    )) as string[]

    console.log(`[sync] ${supplierCodes.length} supplier codes to fetch`)

    // Build hotel lookup: supplierCode → [{ id, category, destCode }]
    const hotelBySupplier = new Map<string, any[]>()
    for (const h of (hotels ?? [])) {
      const code = h.tourplan_code?.trim()
      if (!code) continue
      if (!hotelBySupplier.has(code)) hotelBySupplier.set(code, [])
      hotelBySupplier.get(code)!.push({
        id: h.id,
        category: h.category,
        destCode: (h.destinations as any)?.code,
      })
    }

    // ── Step 2: Clean expired periods ──────────────────────────────────────
    await supabase.from('tp_rates').delete().lt('date_to', today)
    await supabase.from('tp_pc_rates').delete().lt('date_to', today)

    // ── Step 3: Fetch NT rates per supplier ────────────────────────────────
    const pool = await sql.connect(config)
    let ntInserted = 0
    let ntRows: any[] = []

    // Process in batches of 50 suppliers
    const BATCH = 50
    for (let i = 0; i < supplierCodes.length; i += BATCH) {
      const batch = supplierCodes.slice(i, i + BATCH)
      const inClause = batch.map((c: string) => `'${c}'`).join(',')

      const result = await pool.request().query(`
        SELECT
          OPT.SUPPLIER    AS supplierCode,
          OPT.DESCRIPTION AS optionDesc,
          OSR.DATE_FROM   AS dateFrom,
          OSR.DATE_TO     AS dateTo,
          OPD.SS          AS sgl,
          OPD.TW          AS dbl,
          OPD.TR          AS tpl
        FROM OPT
        JOIN OSR ON OSR.OPT_ID = OPT.OPT_ID
        JOIN OPD ON OPD.OSR_ID = OSR.OSR_ID
        WHERE
          OPT.SUPPLIER    IN (${inClause})
          AND OPT.SERVICE = 'AC'
          AND OPT.AC      IN ('Y', 'A')
          AND OSR.PRICE_CODE = 'NR'
          AND OPD.RATE_TYPE  = 'FC'
          AND OPD.AGE_CATEGORY = 'AD'
          AND OSR.DATE_TO >= '${todayTP}'
        ORDER BY OPT.SUPPLIER, OPT.DESCRIPTION, OSR.DATE_FROM
      `)
      ntRows = ntRows.concat(result.recordset)
    }

    console.log(`[sync] NT raw rows from TP: ${ntRows.length}`)

    // ── Step 4: Build tp_rates rows ────────────────────────────────────────
    const tpRatesRows: any[] = []
    for (const row of ntRows) {
      const supplierCode = String(row.supplierCode).trim()
      const hotelList = hotelBySupplier.get(supplierCode) ?? []
      if (!hotelList.length) continue

      const dateFrom = row.dateFrom instanceof Date
        ? row.dateFrom.toISOString().split('T')[0]
        : String(row.dateFrom).slice(0, 10)
      const dateTo = row.dateTo instanceof Date
        ? row.dateTo.toISOString().split('T')[0]
        : String(row.dateTo).slice(0, 10)

      for (const hotel of hotelList) {
        // SGL
        if (row.sgl > 0 && row.sgl < 9000) {
          tpRatesRows.push({
            hotel_id: hotel.id,
            supplier_code: parseInt(supplierCode),
            option_desc: row.optionDesc,
            room_base: 'SGL',
            tp_net_rate: row.sgl,
            date_from: dateFrom,
            date_to: dateTo,
            synced_at: startedAt,
          })
        }
        // DBL
        if (row.dbl > 0 && row.dbl < 9000) {
          tpRatesRows.push({
            hotel_id: hotel.id,
            supplier_code: parseInt(supplierCode),
            option_desc: row.optionDesc,
            room_base: 'DBL',
            tp_net_rate: row.dbl,
            date_from: dateFrom,
            date_to: dateTo,
            synced_at: startedAt,
          })
        }
        // TPL
        if (row.tpl > 0 && row.tpl < 9000) {
          tpRatesRows.push({
            hotel_id: hotel.id,
            supplier_code: parseInt(supplierCode),
            option_desc: row.optionDesc,
            room_base: 'TPL',
            tp_net_rate: row.tpl,
            date_from: dateFrom,
            date_to: dateTo,
            synced_at: startedAt,
          })
        }
      }
    }

    // Upsert tp_rates in batches
    const RATE_BATCH = 500
    for (let i = 0; i < tpRatesRows.length; i += RATE_BATCH) {
      const chunk = tpRatesRows.slice(i, i + RATE_BATCH)
      await supabase.from('tp_rates').upsert(chunk, {
        onConflict: 'hotel_id,option_desc,room_base,date_from'
      })
      ntInserted += chunk.length
    }

    console.log(`[sync] NT rows upserted: ${ntInserted}`)

    // ── Step 5: Fetch PC rates (supplier 1743) ─────────────────────────────
    const PC_SUPPLIER = '1743'
    const pcResult = await pool.request().query(`
      SELECT
        OPT.SUPPLIER    AS supplierCode,
        OPT.DESCRIPTION AS optionDesc,
        OSR.DATE_FROM   AS dateFrom,
        OSR.DATE_TO     AS dateTo,
        OPD.SS          AS sgl,
        OPD.TW          AS dbl,
        OPD.TR          AS tpl
      FROM OPT
      JOIN OSR ON OSR.OPT_ID = OPT.OPT_ID
      JOIN OPD ON OPD.OSR_ID = OSR.OSR_ID
      WHERE
        OPT.SUPPLIER    = '${PC_SUPPLIER}'
        AND OPT.SERVICE = 'AC'
        AND OPT.AC      IN ('Y', 'A')
        AND OSR.PRICE_CODE = 'NR'
        AND OPD.RATE_TYPE  = 'FC'
        AND OPD.AGE_CATEGORY = 'AD'
        AND OSR.DATE_TO >= '${todayTP}'
      ORDER BY OPT.DESCRIPTION, OSR.DATE_FROM
    `)

    await pool.close()

    const pcRows = pcResult.recordset as any[]
    console.log(`[sync] PC raw rows from TP: ${pcRows.length}`)

    // Parse "COMFORT BUE" → { cat, destCode }
    const CAT_MAP: Record<string, string> = {
      'INN': 'Inn', 'COMFORT': 'Comfort', 'SUPERIOR': 'Superior',
      'LUXURY': 'Luxury', 'APART': 'Inn/Apart', 'INN/APART': 'Inn/Apart',
      'INN/COMFORT': 'Inn/Comfort',
    }

    const parseOptionDesc = (desc: string): { cat: string; destCode: string } | null => {
      const parts = desc.trim().split(' ')
      if (parts.length < 2) return null
      const destCode = parts[parts.length - 1]
      const catRaw = parts.slice(0, parts.length - 1).join(' ').toUpperCase().trim()
      const cat = CAT_MAP[catRaw] ?? null
      if (!cat) return null
      return { cat, destCode }
    }

    // Build tp_pc_rates rows
    const pcPeriodMap = new Map<string, any>()
    for (const row of pcRows) {
      const parsed = parseOptionDesc(String(row.optionDesc ?? ''))
      if (!parsed) continue

      const dateFrom = row.dateFrom instanceof Date
        ? row.dateFrom.toISOString().split('T')[0]
        : String(row.dateFrom).slice(0, 10)
      const dateTo = row.dateTo instanceof Date
        ? row.dateTo.toISOString().split('T')[0]
        : String(row.dateTo).slice(0, 10)
      if (!dateFrom) continue

      for (const [base, val] of [['SGL', row.sgl], ['DBL', row.dbl], ['TPL', row.tpl]] as [string, number][]) {
        if (!val || val <= 0 || val >= 9000) continue
        const key = `${parsed.destCode}__${parsed.cat}__${base}__${dateFrom}`
        if (!pcPeriodMap.has(key)) {
          pcPeriodMap.set(key, {
            dest_code: parsed.destCode,
            category: parsed.cat,
            room_base: base,
            pc_rate: val,
            date_from: dateFrom,
            date_to: dateTo,
            season: '26-27',
            synced_at: startedAt,
          })
        }
      }
    }

    const pcRowsToInsert = Array.from(pcPeriodMap.values())
    let pcInserted = 0
    for (let i = 0; i < pcRowsToInsert.length; i += RATE_BATCH) {
      const chunk = pcRowsToInsert.slice(i, i + RATE_BATCH)
      await supabase.from('tp_pc_rates').upsert(chunk, {
        onConflict: 'dest_code,category,room_base,date_from'
      })
      pcInserted += chunk.length
    }

    console.log(`[sync] PC rows upserted: ${pcInserted}`)

    // ── Step 6: Log ────────────────────────────────────────────────────────
    await supabase.from('tp_sync_log').insert({
      synced_at: startedAt,
      rates_updated: ntInserted,
      hotels_matched: supplierCodes.length,
      status: 'ok',
    })

    return NextResponse.json({
      ok: true,
      msg: `Sync OK — ${supplierCodes.length} proveedores · ${ntInserted} NT · ${pcInserted} PC`,
      suppliers: supplierCodes.length,
      nt_rows: ntInserted,
      pc_rows: pcInserted,
    })

  } catch (err: any) {
    console.error('[sync] ERROR:', err)
    await supabase.from('tp_sync_log').insert({
      synced_at: startedAt,
      rates_updated: 0,
      hotels_matched: 0,
      status: 'error',
      error_msg: err.message,
    })
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
