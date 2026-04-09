import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ══════════════════════════════════════════════════════════════════════════════
// RATES FOR DATE - VERSIÓN MEJORADA
// ══════════════════════════════════════════════════════════════════════════════
//
// MEJORAS APLICADAS:
// ✅ FIX: Paginación completa para additionalSuppliers query
//
// ══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // ── 1. Mappings ─────────────────────────────────────────────────────────────
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

  // ── 2. NT rates for this date (WITH PAGINATION) ────────────────────────────
  let ntRatesRaw: any[] = []
  let page = 0
  const pageSize = 1000
  
  while (true) {
    const { data, error } = await supabase
      .from('tp_rates')
      .select('supplier_code, option_code, option_desc, room_base, tp_net_rate, date_from, date_to')
      .range(page * pageSize, (page + 1) * pageSize - 1)
    
    if (error) {
      console.error('[rates] Error fetching page', page, error)
      break
    }
    
    if (!data || data.length === 0) break
    
    ntRatesRaw = ntRatesRaw.concat(data)
    
    if (data.length < pageSize) break
    page++
  }

  console.log('[rates] Total ntRates fetched:', ntRatesRaw.length)

  // Filter for CURRENT rates (valid for the date)
  const ntRates = (ntRatesRaw ?? []).filter((row: any) => {
    return row.date_from <= date && row.date_to >= date
  })

  console.log('[rates] After date filter:', ntRates.length, 'rates')
  
  // Get LAST AVAILABLE rates (even if expired)
  const lastRatesMap = new Map<string, any>()
  for (const row of ntRatesRaw) {
    const keyByCode = `${String(row.supplier_code).trim()}__${String(row.option_code || '').trim()}`
    const keyByDesc = `${String(row.supplier_code).trim()}__${String(row.option_desc || '').trim()}`
    
    for (const key of [keyByCode, keyByDesc]) {
      if (!lastRatesMap.has(key) || row.date_to > lastRatesMap.get(key).date_to) {
        lastRatesMap.set(key, row)
      }
    }
  }

  // Build NT map
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
  
  // Build EXPIRED rates map
  const expiredNtMap = new Map<string, Record<string, number>>()
  lastRatesMap.forEach((row, key) => {
    if (row.date_to < date) {
      if (!expiredNtMap.has(key)) expiredNtMap.set(key, {})
      expiredNtMap.get(key)![row.room_base] = row.tp_net_rate
    }
  })

  // ✅ FIX: Get ALL suppliers with data using pagination
  const allSuppliersWithData = new Set<string>(suppliersWithDataForDate)
  
  let suppliersPage = 0
  while (true) {
    const { data: additionalSuppliers, error } = await supabase
      .from('tp_rates')
      .select('supplier_code')
      .range(suppliersPage * pageSize, (suppliersPage + 1) * pageSize - 1) as any
    
    if (error || !additionalSuppliers || additionalSuppliers.length === 0) break
    
    for (const row of additionalSuppliers) {
      allSuppliersWithData.add(String(row.supplier_code))
    }
    
    if (additionalSuppliers.length < pageSize) break
    suppliersPage++
  }
  
  console.log('[rates] allSuppliersWithData final size:', allSuppliersWithData.size)

  // ── 3. PC rates ─────────────────────────────────────────────────────────────
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

  // ── 4. Get hotels with destinations ────────────────────────────────────────
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, name, tourplan_code, category, destination_id, destinations(id, code, name)')
    .eq('active', true)
    .order('name')
    .limit(10000) as any

  const hotelData = (hotels ?? []).map((h: any) => {
    const supplierCode = String(h.tourplan_code || '').trim()
    const destCode = h.destinations?.code ?? ''
    const destCatKey = `${destCode}__${h.category}`
    const map = mappingByHotel.get(h.id)

    const ntKey1 = map?.code ? `${supplierCode}__${map.code}` : null
    const ntKey2 = map?.desc ? `${supplierCode}__${map.desc}` : null

    const ntCurrent = ntKey1 && ntMap.has(ntKey1) ? ntMap.get(ntKey1)! 
      : ntKey2 && ntMap.has(ntKey2) ? ntMap.get(ntKey2)! 
      : null

    const ntExpired = ntKey1 && expiredNtMap.has(ntKey1) ? expiredNtMap.get(ntKey1)!
      : ntKey2 && expiredNtMap.has(ntKey2) ? expiredNtMap.get(ntKey2)!
      : null

    const pc = pcMap.get(destCatKey) ?? null

    const hasNtData = allSuppliersWithData.has(supplierCode)
    const hasPcData = destCatsWithPc.has(destCatKey)

    return {
      id: h.id,
      name: h.name,
      tourplan_code: h.tourplan_code,
      category: h.category,
      destination: {
        id: h.destinations?.id,
        name: h.destinations?.name,
        code: destCode,
      },
      nt_rates: ntCurrent,
      nt_expired: ntExpired,
      pc_rates: pc,
      has_nt_data: hasNtData,
      has_pc_data: hasPcData,
      room_mapping: map ?? null,
    }
  })

  return NextResponse.json({ date, hotels: hotelData })
}
