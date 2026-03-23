import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // ── 1. Mappings: hotel_id → option_code ──────────────────────────────────
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

  // ── 2. NT rates for this date — match by supplier_code + option_code ─────
  // supplier_code in tp_rates = tourplan_code in hotels
  const { data: ntRates } = await supabase
    .from('tp_rates')
    .select('supplier_code, option_code, option_desc, room_base, tp_net_rate')
    .lte('date_from', date)
    .gte('date_to', date)
    .limit(50000) as any

  // Build NT lookup: supplier_code + option_code → { SGL, DBL, TPL }
  const ntBySupplier = new Map<string, Record<string, number>>()
  for (const row of (ntRates ?? [])) {
    const key = `${String(row.supplier_code)}__${row.option_code ?? row.option_desc}`
    if (!ntBySupplier.has(key)) ntBySupplier.set(key, {})
    ntBySupplier.get(key)![row.room_base] = row.tp_net_rate
  }

  // Which supplier_codes have ANY data in tp_rates
  const { data: allNtSuppliers } = await supabase
    .from('tp_rates')
    .select('supplier_code')
    .limit(50000) as any
  const suppliersWithData = new Set((allNtSuppliers ?? []).map((r: any) => String(r.supplier_code)))

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

    const hasMapping = !!mapping
    const hasNtData = hasMapping && tpCode && suppliersWithData.has(tpCode)
    const hasPcData = destCatsWithPc.has(pcKey)

    if (!hasNtData && !hasPcData) return null

    // Find NT rates: match by supplier_code + option_code (or option_desc fallback)
    let nt: Record<string, number> = {}
    if (hasNtData && mapping) {
      const keyByCode = `${tpCode}__${mapping.code}`
      const keyByDesc = `${tpCode}__${mapping.desc}`
      nt = ntBySupplier.get(keyByCode) ?? ntBySupplier.get(keyByDesc) ?? {}
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
