import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  console.log('[DEBUG] Searching for date:', date, 'type:', typeof date)

  // Use regular client for auth
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Use admin client for data queries (no pagination limits)
  const { createAdminClient } = await import('@/lib/supabase/server')
  const adminSupabase = createAdminClient()

  // ── 1. Mappings: hotel_id → { option_code, option_desc } ─────────────────
  const { data: mappings } = await adminSupabase
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
  // FIXED: Increase limit to fetch all rows (21,260 total in DB)
  const { data: ntRatesRaw } = await adminSupabase
    .from('tp_rates')
    .select('supplier_code, option_code, option_desc, room_base, tp_net_rate, date_from, date_to')
    .limit(25000) as any  // Increased from default 1000 to 25000

  console.log('[DEBUG] Total ntRates fetched:', (ntRatesRaw ?? []).length)

  // Filter in memory for the specific date (more reliable than Supabase date filters)
  const ntRates = (ntRatesRaw ?? []).filter((row: any) => {
    return row.date_from <= date && row.date_to >= date
  })

  console.log('[DEBUG] After date filter:', ntRates.length, 'rates')

  // DEBUG: Log para supplier 526
  const debug526 = (ntRates ?? []).filter((r: any) => String(r.supplier_code) === '526')
  console.log('[DEBUG] Rates for supplier 526:', debug526.length, 'rows')
  if (debug526.length > 0) {
    console.log('[DEBUG] Sample 526 rate:', debug526[0])
  }

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
  
  // DEBUG: Verificar si 526 está en los sets
  console.log('[DEBUG] suppliersWithDataForDate has 526?', suppliersWithDataForDate.has('526'))
  console.log('[DEBUG] ntMap keys with 526:', Array.from(ntMap.keys()).filter(k => k.startsWith('526__')))

  // Also get ALL suppliers that have any tp_rates (not just for this date)
  // to show red dash vs grey dash
  // FIXED: Use suppliersWithDataForDate as base, then add any missing from a separate query
  const allSuppliersWithData = new Set<string>(suppliersWithDataForDate)
  
  // Query for additional suppliers not in current date range (in batches to avoid limit issues)
  const { data: additionalSuppliers } = await adminSupabase
    .from('tp_rates')
    .select('supplier_code')
    .limit(1000) as any
  
  for (const row of (additionalSuppliers ?? [])) {
    allSuppliersWithData.add(String(row.supplier_code))
  }
  
  console.log('[DEBUG] allSuppliersWithData final size:', allSuppliersWithData.size)
  console.log('[DEBUG] allSuppliersWithData has 526:', allSuppliersWithData.has('526'))

  // ── 3. PC rates ───────────────────────────────────────────────────────────
  const { data: allPcRows } = await adminSupabase
    .from('tp_pc_rates').select('dest_code, category').limit(10000) as any
  const destCatsWithPc = new Set((allPcRows ?? []).map((r: any) => `${r.dest_code}__${r.category}`))

  const { data: pcRates } = await adminSupabase
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
  const { data: hotels } = await adminSupabase
    .from('hotels')
    .select('id, category, tourplan_code, destination_id, destinations(code)')
    .eq('active', true)
    .limit(2000) as any

  const result = (hotels ?? []).map((hotel: any) => {
    const destCode = (hotel.destinations as any)?.code
    const pcKey = `${destCode}__${hotel.category}`
    const tpCode = hotel.tourplan_code?.trim()
    const mapping = mappingByHotel.get(hotel.id)

    // DEBUG: Log para el hotel Design Suites
    if (hotel.id === '4f36157a-5de6-560c-82c5-a0e1834fb75e') {
      console.log('[DEBUG] Design Suites Calafate:')
      console.log('  tpCode:', tpCode, 'type:', typeof tpCode)
      console.log('  mapping:', mapping)
      console.log('  allSuppliersWithData.has(tpCode):', allSuppliersWithData.has(tpCode))
      console.log('  allSuppliersWithData size:', allSuppliersWithData.size)
      console.log('  allSuppliersWithData has "526":', allSuppliersWithData.has('526'))
    }

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
      
      // DEBUG: Log búsqueda para Design Suites
      if (hotel.id === '4f36157a-5de6-560c-82c5-a0e1834fb75e') {
        console.log('  Searching byCode:', `${tpCode}__${mapping!.code}`, '→', byCode)
        console.log('  Searching byDesc:', `${tpCode}__${mapping!.desc}`, '→', byDesc)
        console.log('  Final nt:', nt)
      }
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
