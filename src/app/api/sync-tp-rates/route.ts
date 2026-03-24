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
    // FIXED: Paginate to get ALL hotels (not just 1000)
    let hotels: any[] = []
    let page = 0
    const pageSize = 1000
    
    while (true) {
      const { data, error } = await supabase
        .from('hotels')
        .select('id, tourplan_code, category, destination_id, destinations(code)')
        .eq('active', true)
        .not('tourplan_code', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (error || !data || data.length === 0) break
      hotels = hotels.concat(data)
      if (data.length < pageSize) break
      page++
    }

    const supplierCodes = Array.from(new Set(
      (hotels ?? [])
        .map((h: any) => h.tourplan_code?.trim())
        .filter(Boolean)
    )) as string[]

    console.log(`[sync] ${hotels.length} active hotels, ${supplierCodes.length} unique supplier codes to fetch`)

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
          OPT.CODE        AS optionCode,
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
            option_code: row.optionCode?.trim() ?? null,
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
            option_code: row.optionCode?.trim() ?? null,
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
            option_code: row.optionCode?.trim() ?? null,
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

    // Delete existing tp_rates for these hotels and reinsert fresh with option_code
    // Get all hotel_ids we're about to sync
    const hotelIdsToSync = Array.from(new Set(tpRatesRows.map((r: any) => r.hotel_id)))
    const DELETE_BATCH = 100
    for (let i = 0; i < hotelIdsToSync.length; i += DELETE_BATCH) {
      const chunk = hotelIdsToSync.slice(i, i + DELETE_BATCH)
      await supabase.from('tp_rates').delete().in('hotel_id', chunk)
    }

    // Insert fresh rows with option_code
    const RATE_BATCH = 500
    for (let i = 0; i < tpRatesRows.length; i += RATE_BATCH) {
      const chunk = tpRatesRows.slice(i, i + RATE_BATCH)
      await supabase.from('tp_rates').insert(chunk)
      ntInserted += chunk.length
    }

    console.log(`[sync] NT rows upserted: ${ntInserted}`)

    // ── Step 4b: Update option_code in hotel_tp_room_map AND tp_rates ────────
    // Build map: hotel_id + option_desc → option_code (from TP data)
    const optCodeMap = new Map<string, string>()
    for (const row of tpRatesRows) {
      if (row.option_code) {
        const key = `${row.hotel_id}__${row.option_desc}`
        if (!optCodeMap.has(key)) optCodeMap.set(key, row.option_code)
      }
    }

    // Update hotel_tp_room_map with option_code
    // FIXED: Paginate to get ALL mappings
    let mappings2: any[] = []
    page = 0
    
    while (true) {
      const { data, error } = await supabase
        .from('hotel_tp_room_map')
        .select('id, hotel_id, option_desc')
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (error || !data || data.length === 0) break
      mappings2 = mappings2.concat(data)
      if (data.length < pageSize) break
      page++
    }
    
    console.log(`[sync] Updating option_code for ${mappings2.length} mappings`)
    
    for (const m of mappings2) {
      const key = `${m.hotel_id}__${m.option_desc}`
      const code = optCodeMap.get(key)
      if (code) {
        await supabase.from('hotel_tp_room_map')
          .update({ option_code: code }).eq('id', m.id)
      }
    }

    // Update tp_rates option_code for existing null rows using TP data
    // Build map: hotel_id + option_desc → option_code
    const hotelDescToCode = new Map<string, string>()
    for (const row of tpRatesRows) {
      if (row.option_code && row.hotel_id && row.option_desc) {
        const key = `${row.hotel_id}|||${row.option_desc}`
        if (!hotelDescToCode.has(key)) hotelDescToCode.set(key, row.option_code)
      }
    }
    // Update tp_rates rows that still have null option_code
    // FIXED: Paginate to get ALL null rates
    let nullRates: any[] = []
    page = 0
    
    while (true) {
      const { data, error } = await supabase
        .from('tp_rates')
        .select('id, hotel_id, option_desc')
        .is('option_code', null)
        .not('hotel_id', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (error || !data || data.length === 0) break
      nullRates = nullRates.concat(data)
      if (data.length < pageSize) break
      page++
    }
    
    console.log(`[sync] Updating option_code for ${nullRates.length} null rates`)
    
    for (const r of nullRates) {
      const key = `${r.hotel_id}|||${r.option_desc}`
      const code = hotelDescToCode.get(key)
      if (code) {
        await supabase.from('tp_rates').update({ option_code: code }).eq('id', r.id)
      }
    }

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
