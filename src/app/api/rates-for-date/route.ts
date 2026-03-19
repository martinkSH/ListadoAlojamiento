import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // 1. NT — room mapping
  const { data: mappings } = await supabase
    .from('hotel_tp_room_map')
    .select('hotel_id, option_desc') as any

  const mappingMap = new Map<string, string>()
  for (const m of (mappings ?? [])) mappingMap.set(m.hotel_id, m.option_desc)

  // Hotels that have ANY nt rates in tp_rates (regardless of date)
  const { data: allNtHotels } = await supabase
    .from('tp_rates')
    .select('hotel_id')
    .not('hotel_id', 'is', null) as any
  const hotelsWithNt = new Set((allNtHotels ?? []).map((r: any) => r.hotel_id))

  // NT rates for this specific date
  const { data: ntRates } = await supabase
    .from('tp_rates')
    .select('hotel_id, option_desc, room_base, tp_net_rate')
    .lte('date_from', date)
    .gte('date_to', date)
    .not('hotel_id', 'is', null) as any

  const ntMap = new Map<string, Record<string, number>>()
  for (const row of (ntRates ?? [])) {
    const mappedOption = mappingMap.get(row.hotel_id)
    if (!mappedOption || row.option_desc !== mappedOption) continue
    if (!ntMap.has(row.hotel_id)) ntMap.set(row.hotel_id, {})
    ntMap.get(row.hotel_id)![row.room_base] = row.tp_net_rate
  }

  // 2. PC — dest+category combinations that have ANY data
  const { data: allPcData } = await supabase
    .from('tp_pc_rates')
    .select('dest_code, category') as any
  const destCatsWithPc = new Set((allPcData ?? []).map((r: any) => `${r.dest_code}__${r.category}`))

  // PC rates for this specific date
  const { data: pcPeriods } = await supabase
    .from('tp_pc_rates')
    .select('dest_code, category, room_base, pc_rate')
    .lte('date_from', date)
    .gte('date_to', date) as any

  const pcMap = new Map<string, Record<string, number>>()
  for (const row of (pcPeriods ?? [])) {
    const key = `${row.dest_code}__${row.category}`
    if (!pcMap.has(key)) pcMap.set(key, {})
    pcMap.get(key)![row.room_base] = row.pc_rate
  }

  // 3. Get all hotels
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, category, destination_id, destinations(code)')
    .eq('active', true) as any

  // 4. Build combined result
  const result = (hotels ?? []).map((hotel: any) => {
    const destCode = (hotel.destinations as any)?.code
    const pcKey = `${destCode}__${hotel.category}`
    const pc = pcMap.get(pcKey) ?? {}
    const nt = ntMap.get(hotel.id) ?? {}
    const has_pc = destCatsWithPc.has(pcKey)
    const has_nt = hotelsWithNt.has(hotel.id)

    if (!has_pc && !has_nt) return null

    return {
      hotel_id: hotel.id,
      sgl_pc: pc['SGL'] ?? null,
      dbl_pc: pc['DBL'] ?? null,
      tpl_pc: pc['TPL'] ?? null,
      sgl_nt: nt['SGL'] ?? null,
      dbl_nt: nt['DBL'] ?? null,
      tpl_nt: nt['TPL'] ?? null,
      has_pc,
      has_nt,
    }
  }).filter(Boolean)

  return NextResponse.json({ date, rates: result })
}
