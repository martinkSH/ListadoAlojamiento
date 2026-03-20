import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
// xlsx loaded dynamically

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createAdminClient()
  const supabaseAuth = createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const XLSX = require('xlsx')
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets['Product Tariff Room']
  if (!ws) return NextResponse.json({ error: 'Sheet "Product Tariff Room" not found' }, { status: 400 })

  const raw: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Find header row
  const headerIdx = raw.findIndex(r => r && r.includes('supplierCode'))
  if (headerIdx === -1) return NextResponse.json({ error: 'Header row not found' }, { status: 400 })

  const headers: string[] = raw[headerIdx]
  const iSupplier = headers.indexOf('supplierCode')
  const iOptCode = headers.indexOf('optionCode')
  const iOptDesc = headers.indexOf('optionDescription')
  const iServItem = headers.indexOf('servItem')
  const iDateFrom = headers.indexOf('dateFrom')
  const iDateTo = headers.indexOf('dateTo')
  const iFitsCost = headers.indexOf('Fits Cost')

  const ROOM_MAP: Record<string, string> = { Single: 'SGL', Double: 'DBL', Twin: 'DBL', Triple: 'TPL' }
  const today = new Date(); today.setHours(0,0,0,0)

  // Forward-fill supplier/optCode/optDesc
  let lastSupplier = '', lastOptCode = '', lastOptDesc = ''
  const rows: any[] = []

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    if (r[iSupplier]) lastSupplier = String(r[iSupplier]).trim()
    if (r[iOptCode]) lastOptCode = String(r[iOptCode]).trim()
    if (r[iOptDesc]) lastOptDesc = String(r[iOptDesc]).trim()

    const servItem = r[iServItem] ? String(r[iServItem]).trim() : ''
    const roomBase = ROOM_MAP[servItem]
    if (!roomBase) continue

    const dateFrom = r[iDateFrom] instanceof Date ? r[iDateFrom] : new Date(r[iDateFrom])
    const dateTo = r[iDateTo] instanceof Date ? r[iDateTo] : new Date(r[iDateTo])
    if (!dateTo || dateTo < today) continue

    const fitsCost = parseFloat(r[iFitsCost])
    if (!fitsCost || fitsCost <= 0 || fitsCost >= 9000) continue

    const supplierInt = parseInt(lastSupplier)
    if (isNaN(supplierInt)) continue

    const dateFromStr = dateFrom.toISOString().split('T')[0]
    const dateToStr = dateTo.toISOString().split('T')[0]

    rows.push({
      supplierCode: supplierInt,
      optionCode: lastOptCode,
      optionDesc: lastOptDesc,
      roomBase,
      fitsCost,
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      key: `${supplierInt}|${lastOptDesc}|${roomBase}|${dateFromStr}`
    })
  }

  // Dedup on constraint key
  const seen = new Map<string, any>()
  for (const r of rows) {
    if (!seen.has(r.key) || r.fitsCost > seen.get(r.key).fitsCost) {
      seen.set(r.key, r)
    }
  }
  const deduped = Array.from(seen.values())

  // Truncate and reinsert
  await supabase.from('tp_rates').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Get hotel lookup
  const { data: hotels } = await supabase.from('hotels')
    .select('id, tourplan_code').eq('active', true).not('tourplan_code', 'is', null) as any
  const hotelMap = new Map<string, string>()
  for (const h of (hotels ?? [])) hotelMap.set(h.tourplan_code.trim(), h.id)

  const now = new Date().toISOString()
  const toInsert = deduped
    .map(r => {
      const hotelId = hotelMap.get(String(r.supplierCode))
      if (!hotelId) return null
      return {
        hotel_id: hotelId,
        supplier_code: r.supplierCode,
        option_code: r.optionCode || null,
        option_desc: r.optionDesc,
        room_base: r.roomBase,
        tp_net_rate: r.fitsCost,
        date_from: r.dateFrom,
        date_to: r.dateTo,
        synced_at: now,
      }
    })
    .filter(Boolean)

  let inserted = 0
  const BATCH = 500
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH)
    const { error } = await supabase.from('tp_rates').insert(chunk)
    if (error) console.error('Insert error:', error.message)
    else inserted += chunk.length
  }

  return NextResponse.json({
    ok: true,
    processed: deduped.length,
    inserted,
    skipped: deduped.length - inserted,
  })
}
