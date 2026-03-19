import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // ── 1. NT rates ──────────────────────────────────────────────────────────
  // Get room mappings: hotel_id → option_desc
  const { data: mappings } = await supabase
    .from('hotel_tp_room_map')
    .select('hotel_id, option_desc') as any

  const mappingMap = new Map<string, string>()
  for (const m of (mappings ?? [])) mappingMap.set(m.hotel_id, m.option_desc)

  // Hotels that have ANY nt data in tp_rates (to distinguish no-data vs no-period)
  const { data: allNtRows } = await supabase
    .from('tp_rates')
    .select('hotel_id')
    .not('hotel_id', 'is', null) as any
  const hotelsWithNtData = new Set((allNtRows ?? []).map((r: any) => r.hotel_id))

  // NT rates valid for this specific date
  const { data: ntRates } = await supabase
    .from('tp_rates')
    .select('hotel_id, option_desc, room_base, tp_net_rate')
    .lte('date_from', date)
    .gte('date_to', date)
    .not('hotel_id', 'is', null) as any

  // Build NT map: hotel_id → { SGL, DBL, TPL } (only mapped option)
  const ntMap = new Map<string, Record<string, number>>()
  for (const row of (ntRates ?? [])) {
    const mappedOption = mappingMap.get(row.hotel_id)
    if (!mappedOption || row.option_desc !== mappedOption) continue
    if (!ntMap.has(row.hotel_id)) ntMap.set(row.hotel_id, {})
    ntMap.get(row.hotel_id)![row.room_base] = row.tp_net_rate
  }

  // ── 2. PC rates ──────────────────────────────────────────────────────────
  // Dest+category combos that have ANY pc data
  const { data: allPcRows } = await supabase
    .from('tp_pc_rates')
    .select('dest_code, category') as any
  const destCatsWithPc = new Set((allPcRows ?? []).map((r: any) => `${r.dest_code}__${r.category}`))

  // PC rates valid for this specific date
  const { data: pcRates } = await supabase
    .from('tp_pc_rates')
    .select('dest_code, category, room_base, pc_rate')
    .lte('date_from', date)
    .gte('date_to', date) as any

  // Build PC map: dest_code+category → { SGL, DBL, TPL }
  const pcMap = new Map<string, Record<string, number>>()
  for (const row of (pcRates ?? [])) {
    const key = `${row.dest_code}__${row.category}`
    if (!pcMap.has(key)) pcMap.set(key, {})
    pcMap.get(key)![row.room_base] = row.pc_rate
  }

  // ── 3. Build result per hotel ────────────────────────────────────────────
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, category, destination_id, destinations(code)')
    .eq('active', true) as any

  const result = (hotels ?? []).map((hotel: any) => {
    const destCode = (hotel.destinations as any)?.code
    const pcKey = `${destCode}__${hotel.category}`
    const hasMappingForNt = mappingMap.has(hotel.id)
    const hasNtData = hotelsWithNtData.has(hotel.id) && hasMappingForNt
    const hasPcData = destCatsWithPc.has(pcKey)

    // Skip hotels with no TP data at all
    if (!hasNtData && !hasPcData) return null

    const nt = ntMap.get(hotel.id) ?? {}
    const pc = pcMap.get(pcKey) ?? {}

    return {
      hotel_id: hotel.id,
      // NT values — null means either no data or no period for this date
      sgl_nt: nt['SGL'] ?? null,
      dbl_nt: nt['DBL'] ?? null,
      tpl_nt: nt['TPL'] ?? null,
      // PC values — null means either no data or no period for this date
      sgl_pc: pc['SGL'] ?? null,
      dbl_pc: pc['DBL'] ?? null,
      tpl_pc: pc['TPL'] ?? null,
      // Flags: true = has TP data but no rate for this specific date → show red dash
      // false = no TP data at all → show grey dash
      nt_has_data: hasNtData,
      pc_has_data: hasPcData,
    }
  }).filter(Boolean)

  return NextResponse.json({ date, rates: result })
}
