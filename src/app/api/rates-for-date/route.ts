import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Get all tp_rates valid for this date, joined with hotel_tp_room_map
  const { data, error } = await supabase
    .from('tp_rates')
    .select('hotel_id, option_desc, room_base, tp_net_rate, date_from, date_to, hotel_tp_room_map!inner(option_desc)')
    .lte('date_from', date)
    .gte('date_to', date)
    .not('hotel_id', 'is', null) as any

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build map: hotel_id → { SGL, DBL, TPL }
  const rateMap = new Map<string, Record<string, number>>()

  for (const row of (data ?? [])) {
    // Only use the mapped option for this hotel
    const mappedOption = row.hotel_tp_room_map?.[0]?.option_desc
    if (!mappedOption || row.option_desc !== mappedOption) continue

    if (!rateMap.has(row.hotel_id)) rateMap.set(row.hotel_id, {})
    const hotel = rateMap.get(row.hotel_id)!
    hotel[row.room_base] = row.tp_net_rate
  }

  // Convert to array
  const result = Array.from(rateMap.entries()).map(([hotel_id, rates]) => ({
    hotel_id,
    sgl_nt: rates['SGL'] ?? null,
    dbl_nt: rates['DBL'] ?? null,
    tpl_nt: rates['TPL'] ?? null,
  }))

  return NextResponse.json({ date, rates: result })
}
