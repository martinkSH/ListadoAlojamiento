import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // ── 1. Mappings: hotel_id → { option_code, option_desc } ─────────────────
  const { data: mappings } = await supabase
    .from('hotel_tp_room_map')
    .select('hotel_id, option_code, option_desc')
    .limit(10000) as any

  const mappingByHotel = new Map<string, { code: string | null; desc: string }>()
  for (const m of (mappings ?? [])) {
    if (!mappingByHotel.has(m.hotel_id)) {
      mappingByHotel.set(m.hotel_id, {
        code: m.option_code?.trim() ?? null,
        desc: m.option_desc?.trim() ?? ''
      })
    }
  }

  // Also build: tourplan_code → hotel_id (for hasNtData check)
  // We need to know which tourplan_codes have mapped hotels
  const mappedTpCodes = new Set<string>()
  // We'll populate this from hotels below

  // ── 2. NT rates for this date ─────────────────────────────────────────────
  const { data: ntRates } = await supabase
    .from('tp_rates')
    .select('supplier_code, option_code, option_desc, room_base, tp_net_rate')
    .lte('date_from', date)
    .gte('date_to', date)
    .limit(50000) as any

  // Build: "supplierCode__optionCode" → { SGL, DBL, TPL }
  // Also track which suppliers have data FOR THIS DATE
  const ntMap = new Map<string, Record<string, number>>()
  const suppliersWithDataForDate = new Set<string>()
  for (const row of (ntRates ?? [])) {
    const sc = String(row.supplier_code)
    suppliersWithDataForDate.add(sc)
    const optKey = row.option_code?.trim() ?? row.option_desc?.trim()
    const key = `${sc}__${optKey}`
    if (!ntMap.has(key)) ntMap.set(key, {})
    ntMap.get(key)![row.room_base] = row.tp_net_rate
  }

  // Also get ALL suppliers that have any tp_rates (not just for this date)
  // to show red dash vs grey dash
  const { data: allNtRows } = await supabase
    .from('tp_rates')
    .select('supplier_code')
    .limit(50000) as any
  const allSuppliersWithData = new Set((allNtRows ?? []).map((r: any) => String(r.supplier_code)))

  // ── 3. PC rates ───────────────────────────────────────────────────────────
  const { data: allPcRows } = await supabase
    .from('tp_pc_rates').select('dest_code, category').limit(10000) as any
  const destCatsWithPc = new Set((allPcRows ?? []).map((r: any) => `${r.dest_code}__${r.category}`))

  const { data: pcRates } = await supabase
    .from('tp_pc_rates')
    .select('dest_code, category, room_base, pc_rate')
    .lte('date_from', date)
    .gte('date_to', date)
    .limit(10000) as any

  const pcMap = new Map<string, Record<string, number>>()
  for (const row of (pcRates ?? [])) {
    const key = `${row.dest_code}__${row.category}`
    if (!pcMap.has(key)) pcMap.set(key, {})
    pcMap.get(key)![row.room_base] = row.pc_rate
  }

  // ── 4. Hotels ─────────────────────────────────────────────────────────────
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, category, tourplan_code, destination_id, destinations(code)')
    .eq('active', true)
    .limit(2000) as any

  const result = (hotels ?? []).map((hotel: any) => {
    const destCode = (hotel.destinations as any)?.code
    const pcKey = `${destCode}__${hotel.category}`
    const tpCode = hotel.tourplan_code?.trim()
    const mapping = mappingByHotel.get(hotel.id)

    const hasMapping = !!mapping && !!tpCode
    // nt_has_data = hotel has a mapping AND supplier has ANY data in tp_rates
    const hasNtData = hasMapping && allSuppliersWithData.has(tpCode)
    const hasPcData = destCatsWithPc.has(pcKey)

    if (!hasNtData && !hasPcData) return null

    // Look up NT rates for this date
    let nt: Record<string, number> = {}
    if (hasMapping && tpCode) {
      const byCode = mapping!.code ? ntMap.get(`${tpCode}__${mapping!.code}`) : undefined
      const byDesc = mapping!.desc ? ntMap.get(`${tpCode}__${mapping!.desc}`) : undefined
      nt = byCode ?? byDesc ?? {}
    }

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
