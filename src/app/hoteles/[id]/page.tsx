import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DeleteHotelButton from '@/components/hotels/DeleteHotelButton'

function splitHotelName(fullName: string): { name: string; desc: string } {
  const idx = fullName.search(/\s*\(/)
  if (idx === -1) return { name: fullName, desc: '' }
  return { name: fullName.slice(0, idx).trim(), desc: fullName.slice(idx).trim() }
}

export default async function HotelDetailPage({ params, searchParams }: { params: { id: string }, searchParams?: { date?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hotel } = await supabase
    .from('hotels')
    .select('*, destinations(id,code,name,country), rates(id,room_base,pc_rate,net_rate,season), promotions(id,title,description,promo_type,discount_pct,free_nights,valid_from,valid_until,book_by,conditions,active), tp_rates(id,option_desc,option_comment,room_base,tp_net_rate,date_from,date_to,synced_at), hotel_tp_room_map(option_desc)')
    .eq('id', params.id)
    .single() as any

  if (!hotel) notFound()

  const dest = hotel.destinations as any
  const rates = (hotel.rates ?? []) as any[]
  const promos = (hotel.promotions ?? []) as any[]
  const tpRates = (hotel.tp_rates ?? []) as any[]
  const mappedOption = (hotel.hotel_tp_room_map as any)?.[0]?.option_desc ?? null
  const viewDate = searchParams?.date ?? new Date().toISOString().split('T')[0]
  const tpSyncedAt = tpRates[0]?.synced_at ? new Date(tpRates[0].synced_at).toLocaleDateString('es-AR') : null
  const r = (base: string, season: string) => rates.find((r: any) => r.room_base === base && r.season === season)
  const seasons = ['26-27']
  const bases = ['SGL', 'DBL', 'TPL']

  const CAT_COLORS: Record<string, string> = {
    'Inn/Apart':'#1e40af','Inn':'#4b5563','Comfort':'#92400e',
    'Superior':'#5b21b6','Superior+':'#4c1d95','Luxury':'#713f12',
    'Estancia sup':'#14532d','Estancia lux':'#064e3b','Inn/Comfort':'#075985',
  }
  const CAT_BG: Record<string, string> = {
    'Inn/Apart':'#dbeafe','Inn':'#efefef','Comfort':'#fef3c7',
    'Superior':'#ede9fe','Superior+':'#ddd6fe','Luxury':'#fef9c3',
    'Estancia sup':'#dcfce7','Estancia lux':'#d1fae5','Inn/Comfort':'#e0f2fe',
  }

  const COUNTRY_FLAGS: Record<string,string> = { AR:'🇦🇷',CL:'🇨🇱',BR:'🇧🇷',PE:'🇵🇪',UY:'🇺🇾',PY:'🇵🇾',CO:'🇨🇴',EC:'🇪🇨',BO:'🇧🇴' }

  const isExpired = hotel.net_rate_validity ? new Date(hotel.net_rate_validity) < new Date() : false

  const S = {
    page: { minHeight:'100vh', background:'#faf8f5', fontFamily:"'Inter','Helvetica Neue',system-ui,sans-serif" },
    header: { background:'#f5f0eb', borderBottom:'0.5px solid #e2ddd6', padding:'12px 24px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' as const },
    back: { color:'#8c7d72', textDecoration:'none', fontSize:'12px' },
    sep: { color:'#d4ccc4', fontSize:'12px' },
    card: { background:'#fff', border:'0.5px solid #e8e3dc', borderRadius:'10px', marginBottom:'14px', overflow:'hidden' as const },
    cardHead: { padding:'9px 16px', borderBottom:'0.5px solid #f0ebe4', background:'#fdf9f6' },
    cardTitle: { fontSize:'10px', fontWeight:600, color:'#4a3f35', letterSpacing:'0.07em', textTransform:'uppercase' as const },
    label: { fontSize:'9px', color:'#c4b8ad', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:'2px' },
    val: { fontSize:'12px', color:'#3d3228' },
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <Link href="/hoteles" style={S.back}>← Volver</Link>
        <span style={S.sep}>|</span>
        <span style={{ fontSize:'12px', color:'#8c7d72' }}>
          {COUNTRY_FLAGS[dest?.country] ?? ''} {dest?.name} ({dest?.code})
        </span>
        <span style={S.sep}>|</span>
        <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 9px', borderRadius:'20px', background: CAT_BG[hotel.category] ?? '#efefef', color: CAT_COLORS[hotel.category] ?? '#4b5563' }}>
          {hotel.category}
        </span>
        <span style={{ fontSize:'10px', color:'#c4b8ad' }}>Prioridad {hotel.priority}</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:'8px', alignItems:'center' }}>
          <DeleteHotelButton hotelId={hotel.id} hotelName={hotel.name} />
          <Link href={`/hoteles/${params.id}/editar`} style={{ background:'#4a3f35', color:'#fff', fontSize:'11px', padding:'6px 14px', borderRadius:'6px', textDecoration:'none' }}>
            Editar
          </Link>
        </div>
      </div>

      <div style={{ maxWidth:'860px', margin:'0 auto', padding:'20px 20px' }}>

        {/* Name + meta */}
        <div style={{ marginBottom:'20px' }}>
          <h1 style={{ fontSize:'15px', fontWeight:600, color:'#3d3228', margin:'0 0 6px' }}>{hotel.name}</h1>
          <div style={{ display:'flex', gap:'14px', flexWrap:'wrap' }}>
            {hotel.distance_center && <span style={{ fontSize:'11px', color:'#a8998c' }}>📍 {hotel.distance_center}</span>}
            {hotel.contact_email && <span style={{ fontSize:'11px', color:'#a8998c' }}>✉ {hotel.contact_email}</span>}
            {hotel.contact_phone && <span style={{ fontSize:'11px', color:'#a8998c' }}>📞 {hotel.contact_phone}</span>}
            {hotel.is_family && <span style={{ fontSize:'10px', color:'#92600a', background:'#fef3c7', padding:'1px 6px', borderRadius:'4px', fontWeight:500 }}>FAM</span>}
            {!hotel.is_direct && <span style={{ fontSize:'10px', color:'#6d28d9', background:'#ede9fe', padding:'1px 6px', borderRadius:'4px', fontWeight:500 }}>PLT{hotel.platform_name ? ` · ${hotel.platform_name}` : ''}</span>}
            {isExpired && <span style={{ fontSize:'10px', color:'#b91c1c', background:'#fee2e2', padding:'1px 6px', borderRadius:'4px', fontWeight:500 }}>NT vencida</span>}
          </div>
        </div>

        {/* Tarifas */}
        <div style={S.card}>
          <div style={S.cardHead}><span style={S.cardTitle}>Tarifas</span></div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
            <thead>
              <tr style={{ background:'#faf8f5' }}>
                <th style={{ padding:'6px 16px', textAlign:'left', color:'#a8998c', fontWeight:600, fontSize:'9px', letterSpacing:'0.07em' }}>Temporada</th>
                {bases.map(b => (<>
                  <th key={`${b}-pc`} style={{ padding:'6px 10px', textAlign:'right', color:'#3d3228', fontWeight:600, fontSize:'9px' }}>{b} PC</th>
                  <th key={`${b}-nt`} style={{ padding:'6px 10px', textAlign:'right', color:'#c4b8ad', fontWeight:600, fontSize:'9px' }}>{b} NT</th>
                </>))}
              </tr>
            </thead>
            <tbody>
              {seasons.map((season, si) => (
                <tr key={season} style={{ borderTop:'0.5px solid #f0ebe4', background: si % 2 === 0 ? '#fff' : '#fdf9f6' }}>
                  <td style={{ padding:'7px 16px', color:'#8c7d72', fontSize:'10px', fontWeight:500 }}>{season}</td>
                  {bases.map(base => {
                    const rate = r(base, season)
                    return (<>
                      <td key={`${base}-pc`} style={{ padding:'7px 10px', textAlign:'right', color:'#3d3228', fontFamily:'monospace' }}>
                        {rate?.pc_rate != null ? `$${rate.pc_rate}` : <span style={{ color:'#e8e3dc' }}>—</span>}
                      </td>
                      <td key={`${base}-nt`} style={{ padding:'7px 10px', textAlign:'right', color:'#c4b8ad', fontFamily:'monospace' }}>
                        {rate?.net_rate != null ? `$${rate.net_rate}` : <span style={{ color:'#e8e3dc' }}>—</span>}
                      </td>
                    </>)
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tipos de habitación TourPlan */}
        {tpRates.length > 0 && (() => {
          const optionDescsArr: string[] = []
          tpRates.forEach((r: any) => { if (!optionDescsArr.includes(r.option_desc)) optionDescsArr.push(r.option_desc) })
          const hasTpl = tpRates.some((r: any) => r.room_base === 'TPL')
          return (
            <div style={S.card}>
              <div style={{ ...S.cardHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={S.cardTitle}>Tipos de habitación — TourPlan</span>
                  <span style={{ fontSize: '9px', color: '#c4b8ad', marginLeft: '8px' }}>{optionDescsArr.length} tipo{optionDescsArr.length !== 1 ? 's' : ''}</span>
                </div>
                {tpSyncedAt && <span style={{ fontSize: '9px', color: '#c4b8ad' }}>sync: {tpSyncedAt}</span>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f5f0ea' }}>
                    <th style={{ padding: '7px 16px', textAlign: 'left', color: '#9a8d82', fontWeight: 600, fontSize: '9px', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>Habitación</th>
                    <th style={{ padding: '7px 12px', textAlign: 'right', color: '#9a8d82', fontWeight: 600, fontSize: '9px', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>SGL</th>
                    <th style={{ padding: '7px 12px', textAlign: 'right', color: '#9a8d82', fontWeight: 600, fontSize: '9px', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>DBL</th>
                    {hasTpl && <th style={{ padding: '7px 12px', textAlign: 'right', color: '#9a8d82', fontWeight: 600, fontSize: '9px', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>TPL</th>}
                  </tr>
                </thead>
                <tbody>
                  {optionDescsArr.map((optDesc, si) => {
                    const isMapped = optDesc === mappedOption
                    // For mapped option: show rate for viewDate. For others: show max rate.
                    const getRate = (base: string) => {
                      const matching = tpRates.filter((r: any) => r.option_desc === optDesc && r.room_base === base)
                      if (!matching.length) return null
                      if (isMapped) {
                        const periodRate = matching.find((r: any) => r.date_from <= viewDate && r.date_to >= viewDate)
                        if (periodRate) return periodRate
                      }
                      return matching.reduce((max: any, r: any) => r.tp_net_rate > max.tp_net_rate ? r : max)
                    }
                    const sgl = getRate('SGL'), dbl = getRate('DBL'), tpl = getRate('TPL')
                    const comment = tpRates.find((r: any) => r.option_desc === optDesc)?.option_comment
                    return (
                      <tr key={optDesc} style={{ borderTop: '0.5px solid #ede8e2', background: isMapped ? '#f0f7ff' : si % 2 === 0 ? '#fff' : '#fdf9f6' }}>
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ fontSize: '12px', color: '#3d3228', fontWeight: 500 }}>{optDesc}</div>
                          {comment && <div style={{ fontSize: '10px', color: '#b8a99a', marginTop: '1px' }}>{comment}</div>}
                        </td>
                        {[sgl, dbl, ...(hasTpl ? [tpl] : [])].map((rate, i) => (
                          <td key={i} style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {rate?.tp_net_rate != null
                              ? <span style={{ fontSize: '13px', color: '#2c2420', fontWeight: 600 }}>${rate.tp_net_rate}</span>
                              : <span style={{ color: '#ddd5cb', fontSize: '11px' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}

        {/* Vigencias + Moneda */}
        <div style={{ ...S.card, padding:'14px 16px' }}>
          <div style={{ display:'flex', gap:'28px', flexWrap:'wrap' }}>
            {hotel.net_rate_validity && (
              <div><div style={S.label}>Vigencia NT</div>
              <div style={{ ...S.val, color: isExpired ? '#e57373' : '#3d3228' }}>{hotel.net_rate_validity}</div></div>
            )}
            {hotel.pc_rate_validity && (
              <div><div style={S.label}>Vigencia PC</div><div style={S.val}>{hotel.pc_rate_validity}</div></div>
            )}
            {hotel.closing_date && (
              <div><div style={S.label}>Cierre temporada</div><div style={S.val}>{hotel.closing_date}</div></div>
            )}
            {hotel.season_open && (
              <div><div style={S.label}>Temporada</div><div style={S.val}>{hotel.season_open}</div></div>
            )}
            <div><div style={S.label}>Moneda</div><div style={S.val}>{hotel.currency}</div></div>
          </div>
        </div>

        {/* Notas */}
        {hotel.notes && (
          <div style={{ ...S.card, padding:'14px 16px' }}>
            <div style={{ ...S.label, marginBottom:'6px' }}>Notas internas</div>
            <div style={{ fontSize:'12px', color:'#8c7d72', lineHeight:1.6 }}>{hotel.notes}</div>
          </div>
        )}

        {/* Promociones */}
        {promos.length > 0 && (
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.cardTitle}>Promociones</span></div>
            {promos.map((p: any) => (
              <div key={p.id} style={{ padding:'12px 16px', borderBottom:'0.5px solid #f0ebe4' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                  <span style={{ fontSize:'12px', fontWeight:500, color:'#3d3228' }}>{p.title}</span>
                  {p.discount_pct && <span style={{ fontSize:'9px', color:'#14532d', background:'#dcfce7', padding:'1px 6px', borderRadius:'4px', fontWeight:600 }}>{p.discount_pct}% OFF</span>}
                  {p.free_nights && <span style={{ fontSize:'9px', color:'#075985', background:'#e0f2fe', padding:'1px 6px', borderRadius:'4px', fontWeight:600 }}>{p.free_nights} noches gratis</span>}
                  {!p.active && <span style={{ fontSize:'9px', color:'#b91c1c', background:'#fee2e2', padding:'1px 6px', borderRadius:'4px' }}>Inactiva</span>}
                </div>
                {p.description && <div style={{ fontSize:'11px', color:'#8c7d72' }}>{p.description}</div>}
                {p.conditions && <div style={{ fontSize:'10px', color:'#c4b8ad', marginTop:'2px' }}>{p.conditions}</div>}
                <div style={{ display:'flex', gap:'12px', marginTop:'4px' }}>
                  {p.valid_from && <span style={{ fontSize:'9px', color:'#c4b8ad' }}>Desde: {p.valid_from}</span>}
                  {p.valid_until && <span style={{ fontSize:'9px', color:'#c4b8ad' }}>Hasta: {p.valid_until}</span>}
                  {p.book_by && <span style={{ fontSize:'9px', color:'#c4b8ad' }}>Reservar antes: {p.book_by}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Disponibilidad */}
        <div style={S.card}>
          <div style={S.cardHead}><span style={S.cardTitle}>Consulta de disponibilidad</span></div>
          <div style={{ padding:'14px 16px' }}>
            {hotel.contact_email ? (<>
              <p style={{ fontSize:'12px', color:'#8c7d72', margin:'0 0 12px', lineHeight:1.6 }}>
                Se enviará un mail a <strong style={{ color:'#4a3f35' }}>{hotel.contact_email}</strong> con botones para que el hotel confirme o rechace.
              </p>
              <Link href={`/hoteles/${params.id}/disponibilidad`} style={{ display:'inline-block', background:'#4a3f35', color:'#fff', fontSize:'12px', padding:'8px 18px', borderRadius:'7px', textDecoration:'none' }}>
                Pedir disponibilidad →
              </Link>
            </>) : (
              <p style={{ fontSize:'12px', color:'#e57373', margin:0 }}>Este hotel no tiene email de contacto configurado.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
