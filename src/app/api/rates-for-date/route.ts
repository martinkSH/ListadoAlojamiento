import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // 1. Get room mappings: hotel_id → option_desc
  const { data: mappings } = await supabase
    .from('hotel_tp_room_map')
    .select('hotel_id, option_desc') as any

  if (!mappings?.length) return NextResponse.json({ date, rates: [] })

  const mappingMap = new Map<string, string>()
  for (const m of mappings) mappingMap.set(m.hotel_id, m.option_desc)

  // 2. Get tp_rates valid for this date
  const { data: rates, error } = await supabase
    .from('tp_rates')
    .select('hotel_id, option_desc, room_base, tp_net_rate')
    .lte('date_from', date)
    .gte('date_to', date)
    .not('hotel_id', 'is', null) as any

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 3. Filter to only mapped options and build result
  const rateMap = new Map<string, Record<string, number>>()

  for (const row of (rates ?? [])) {
    const mappedOption = mappingMap.get(row.hotel_id)
    if (!mappedOption || row.option_desc !== mappedOption) continue

    if (!rateMap.has(row.hotel_id)) rateMap.set(row.hotel_id, {})
    rateMap.get(row.hotel_id)![row.room_base] = row.tp_net_rate
  }

  const result = Array.from(rateMap.entries()).map(([hotel_id, r]) => ({
    hotel_id,
    sgl_nt: r['SGL'] ?? null,
    dbl_nt: r['DBL'] ?? null,
    tpl_nt: r['TPL'] ?? null,
  }))

  return NextResponse.json({ date, rates: result })
}
