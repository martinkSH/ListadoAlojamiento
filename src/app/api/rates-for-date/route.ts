import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // ── 1. Room mappings: hotel_id → option_desc (always use desc for matching) ──
  const { data: mappings } = await supabase
    .from('hotel_tp_room_map')
    .select('hotel_id, option_desc') as any

  // Normalize: trim + remove accents for robust matching
  const norm = (s: string) => s.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  const mappingMap = new Map<string, string>() // hotel_id → normalized option_desc
  for (const m of (mappings ?? [])) {
    if (m.option_desc) mappingMap.set(m.hotel_id, norm(m.option_desc))
  }

  // ── 2. Hotels that have ANY data in tp_rates ─────────────────────────────
  const { data: allNtRows } = await supabase
    .from('tp_rates')
    .select('hotel_id')
    .not('hotel_id', 'is', null) as any
  const hotelsWithNtData = new Set((allNtRows ?? []).map((r: any) => r.hotel_id))

  // ── 3. NT rates for this date ────────────────────────────────────────────
  const { data: ntRates } = await supabase
    .from('tp_rates')
    .select('hotel_id, option_desc, room_base, tp_net_rate')
    .lte('date_from', date)
    .gte('date_to', date)
    .not('hotel_id', 'is', null) as any

  // Match strictly by option_desc (trim both sides to avoid whitespace issues)
  const ntMap = new Map<string, Record<string, number>>()
  for (const row of (ntRates ?? [])) {
    const mappedDesc = mappingMap.get(row.hotel_id)
    if (!mappedDesc) continue
    if (norm(row.option_desc ?? '') !== mappedDesc) continue
    if (!ntMap.has(row.hotel_id)) ntMap.set(row.hotel_id, {})
    ntMap.get(row.hotel_id)![row.room_base] = row.tp_net_rate
  }

  // ── 4. PC rates for this date ────────────────────────────────────────────
  const { data: allPcRows } = await supabase
    .from('tp_pc_rates')
    .select('dest_code, category') as any
  const destCatsWithPc = new Set((allPcRows ?? []).map((r: any) => `${r.dest_code}__${r.category}`))

  const { data: pcRates } = await supabase
    .from('tp_pc_rates')
    .select('dest_code, category, room_base, pc_rate')
    .lte('date_from', date)
    .gte('date_to', date) as any

  const pcMap = new Map<string, Record<string, number>>()
  for (const row of (pcRates ?? [])) {
    const key = `${row.dest_code}__${row.category}`
    if (!pcMap.has(key)) pcMap.set(key, {})
    pcMap.get(key)![row.room_base] = row.pc_rate
  }

  // ── 5. Build result ──────────────────────────────────────────────────────
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, category, destination_id, destinations(code)')
    .eq('active', true) as any

  const result = (hotels ?? []).map((hotel: any) => {
    const destCode = (hotel.destinations as any)?.code
    const pcKey = `${destCode}__${hotel.category}`
    const hasMapping = mappingMap.has(hotel.id)
    const hasNtData = hotelsWithNtData.has(hotel.id) && hasMapping
    const hasPcData = destCatsWithPc.has(pcKey)

    if (!hasNtData && !hasPcData) return null

    const nt = ntMap.get(hotel.id) ?? {}
    const pc = pcMap.get(pcKey) ?? {}

    return {
      hotel_id: hotel.id,
      sgl_nt: nt['SGL'] ?? null,
      dbl_nt: nt['DBL'] ?? null,
      tpl_nt: nt['TPL'] ?? null,
      sgl_pc: pc['SGL'] ?? null,
      dbl_pc: pc['DBL'] ?? null,
      tpl_pc: pc['TPL'] ?? null,
      nt_has_data: hasNtData,
      pc_has_data: hasPcData,
    }
  }).filter(Boolean)

  return NextResponse.json({ date, rates: result })
}
