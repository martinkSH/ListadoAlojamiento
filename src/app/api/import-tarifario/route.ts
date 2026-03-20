import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabaseAuth = (await import('@/lib/supabase/server')).createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { rows, truncate } = await req.json()
  if (!rows?.length) return NextResponse.json({ error: 'No rows' }, { status: 400 })

  // Get hotel lookup
  const { data: hotels } = await supabase
    .from('hotels').select('id, tourplan_code').eq('active', true).not('tourplan_code', 'is', null) as any
  const hotelMap = new Map<string, string>()
  for (const h of (hotels ?? [])) hotelMap.set(String(h.tourplan_code).trim(), h.id)

  // Only truncate on first batch
  if (truncate) {
    await supabase.from('tp_rates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  const now = new Date().toISOString()
  const toInsert = rows
    .map((r: any) => {
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
    if (!error) inserted += chunk.length
    else console.error('Insert error:', error.message)
  }

  return NextResponse.json({ ok: true, processed: rows.length, inserted, skipped: rows.length - inserted })
}
