import { NextRequest, NextResponse } from 'next/server'
import * as sql from 'mssql'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const { data: { user } } = await (await import('@/lib/supabase/server')).createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const config: sql.config = {
    server: 'LA-SAYHUE.data.tourplan.net',
    port: 50409,
    database: 'LA-SAYHUE',
    user: 'excelLA-SAYHUE',
    password: process.env.TP_PASSWORD ?? 'o6rmFv7$RJnp14NzqI18',
    options: { encrypt: true, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 120000 },
  }

  // Get hotels with mapping but no option_code
  const { data: missing } = await supabase
    .from('hotel_tp_room_map')
    .select('id, hotel_id, option_desc, hotels(tourplan_code)')
    .is('option_code', null) as any

  if (!missing?.length) return NextResponse.json({ ok: true, updated: 0 })

  // Get unique supplier codes
  const supplierCodes = Array.from(new Set(
    missing.map((m: any) => (m.hotels as any)?.tourplan_code?.trim()).filter(Boolean)
  )) as string[]

  const pool = await sql.connect(config)
  let updated = 0

  const BATCH = 50
  for (let i = 0; i < supplierCodes.length; i += BATCH) {
    const batch = supplierCodes.slice(i, i + BATCH)
    const inClause = batch.map(c => `'${c}'`).join(',')

    const result = await pool.request().query(`
      SELECT DISTINCT
        OPT.SUPPLIER  AS supplierCode,
        OPT.CODE      AS optionCode,
        OPT.DESCRIPTION AS optionDesc
      FROM OPT
      WHERE OPT.SUPPLIER IN (${inClause})
        AND OPT.SERVICE = 'AC'
        AND OPT.AC IN ('Y','A')
    `)

    // Build map: supplierCode + optionDesc → optionCode
    const codeMap = new Map<string, string>()
    for (const row of result.recordset) {
      const key = `${String(row.supplierCode).trim()}__${String(row.optionDesc).trim()}`
      codeMap.set(key, String(row.optionCode).trim())
    }

    // Update hotel_tp_room_map
    for (const m of missing) {
      const supplierCode = (m.hotels as any)?.tourplan_code?.trim()
      if (!supplierCode || !batch.includes(supplierCode)) continue
      const key = `${supplierCode}__${m.option_desc?.trim()}`
      const code = codeMap.get(key)
      if (code) {
        await supabase.from('hotel_tp_room_map')
          .update({ option_code: code }).eq('id', m.id)
        updated++
      }
    }
  }

  await pool.close()
  return NextResponse.json({ ok: true, updated, total: missing.length })
}
