import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

export default async function HotelDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hotel } = await supabase
    .from('hotels')
    .select(`
      *,
      destinations ( id, code, name, country ),
      rates ( id, room_base, pc_rate, net_rate, season ),
      promotions ( id, title, description, promo_type, discount_pct, free_nights, valid_from, valid_until, book_by, conditions, active )
    `)
    .eq('id', params.id)
    .single() as any

  if (!hotel) notFound()

  const dest = hotel.destinations as any
  const rates = (hotel.rates ?? []) as any[]
  const promos = (hotel.promotions ?? []) as any[]

  const r = (base: string, season: string) =>
    rates.find((r: any) => r.room_base === base && r.season === season)

  const seasons = ['26-27', '24-25']
  const bases = ['SGL', 'DBL', 'TPL']

  const categoryColors: Record<string, string> = {
    'Inn/Apart': '#1e40af', 'Inn': '#374151', 'Comfort': '#92400e',
    'Superior': '#5b21b6', 'Superior+': '#4c1d95', 'Luxury': '#713f12',
    'Estancia sup': '#065f46', 'Estancia lux': '#064e3b',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f6', fontFamily: "'DM Mono', 'Courier New', monospace" }}>

      {/* Header */}
      <div style={{ background: '#1a1a1a', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/hoteles" style={{ color: '#555', textDecoration: 'none', fontSize: '11px' }}>← Volver</Link>
        <span style={{ color: '#333' }}>|</span>
        <span style={{ color: '#555', fontSize: '11px' }}>{dest?.name} ({dest?.code})</span>
        <span style={{ color: '#333' }}>|</span>
        <span style={{
          fontSize: '9px', fontWeight: 700, padding: '2px 8px',
          borderRadius: '999px', letterSpacing: '0.08em',
          background: `${categoryColors[hotel.category] ?? '#374151'}22`,
          color: categoryColors[hotel.category] ?? '#374151',
          border: `1px solid ${categoryColors[hotel.category] ?? '#374151'}44`,
        }}>
          {hotel.category}
        </span>
        <span style={{ color: '#555', fontSize: '10px' }}>Prioridad {hotel.priority}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <Link href={`/hoteles/${params.id}/editar`} style={{
            background: '#2a2a2a', color: '#fff', fontSize: '11px',
            padding: '5px 12px', borderRadius: '6px', textDecoration: 'none',
          }}>
            Editar
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Hotel name */}
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>{hotel.name}</h1>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {hotel.distance_center && <span style={{ fontSize: '11px', color: '#888' }}>📍 {hotel.distance_center}</span>}
          {hotel.contact_email && <span style={{ fontSize: '11px', color: '#888' }}>✉ {hotel.contact_email}</span>}
          {hotel.contact_phone && <span style={{ fontSize: '11px', color: '#888' }}>📞 {hotel.contact_phone}</span>}
          {hotel.is_family && <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700 }}>FAM</span>}
          {!hotel.is_direct && <span style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: 700 }}>PLATAFORMA{hotel.platform_name ? `: ${hotel.platform_name}` : ''}</span>}
        </div>

        {/* Tarifas */}
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0ec', background: '#fafaf8' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.05em' }}>TARIFAS</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f0f0ec' }}>
                <th style={{ padding: '6px 16px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '9px', letterSpacing: '0.08em' }}>TEMPORADA</th>
                {bases.map(b => (
                  <>
                    <th key={`${b}-pc`} style={{ padding: '6px 12px', textAlign: 'right', color: '#888', fontWeight: 600, fontSize: '9px' }}>{b} PC</th>
                    <th key={`${b}-nt`} style={{ padding: '6px 12px', textAlign: 'right', color: '#6b7280', fontWeight: 600, fontSize: '9px' }}>{b} NT</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {seasons.map((season, si) => (
                <tr key={season} style={{ borderTop: '1px solid #f0f0ec', background: si % 2 === 0 ? '#fff' : '#fafaf8' }}>
                  <td style={{ padding: '7px 16px', color: '#555', fontSize: '10px', fontWeight: 600 }}>{season}</td>
                  {bases.map(base => {
                    const rate = r(base, season)
                    return (
                      <>
                        <td key={`${base}-pc`} style={{ padding: '7px 12px', textAlign: 'right', color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>
                          {rate?.pc_rate != null ? `$${rate.pc_rate}` : <span style={{ color: '#e5e7eb' }}>—</span>}
                        </td>
                        <td key={`${base}-nt`} style={{ padding: '7px 12px', textAlign: 'right', color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                          {rate?.net_rate != null ? `$${rate.net_rate}` : <span style={{ color: '#e5e7eb' }}>—</span>}
                        </td>
                      </>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Vigencias */}
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', marginBottom: '16px', padding: '12px 16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {hotel.net_rate_validity && (
            <div>
              <div style={{ fontSize: '9px', color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Vigencia NT</div>
              <div style={{ fontSize: '12px', color: new Date(hotel.net_rate_validity) < new Date() ? '#ef4444' : '#1a1a1a' }}>
                {hotel.net_rate_validity}
              </div>
            </div>
          )}
          {hotel.pc_rate_validity && (
            <div>
              <div style={{ fontSize: '9px', color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Vigencia PC</div>
              <div style={{ fontSize: '12px', color: '#1a1a1a' }}>{hotel.pc_rate_validity}</div>
            </div>
          )}
          {hotel.closing_date && (
            <div>
              <div style={{ fontSize: '9px', color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Cierre temporada</div>
              <div style={{ fontSize: '12px', color: '#1a1a1a' }}>{hotel.closing_date}</div>
            </div>
          )}
          {hotel.currency && (
            <div>
              <div style={{ fontSize: '9px', color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Moneda</div>
              <div style={{ fontSize: '12px', color: '#1a1a1a' }}>{hotel.currency}</div>
            </div>
          )}
        </div>

        {/* Promociones */}
        {promos.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0ec', background: '#fafaf8' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.05em' }}>PROMOCIONES</span>
            </div>
            {promos.map((promo: any) => (
              <div key={promo.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0ec' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#1a1a1a' }}>{promo.title}</span>
                  {promo.discount_pct && <span style={{ fontSize: '9px', color: '#16a34a', fontWeight: 700 }}>{promo.discount_pct}% OFF</span>}
                  {promo.free_nights && <span style={{ fontSize: '9px', color: '#2563eb', fontWeight: 700 }}>{promo.free_nights} noches gratis</span>}
                  {!promo.active && <span style={{ fontSize: '9px', color: '#ef4444' }}>INACTIVA</span>}
                </div>
                {promo.description && <div style={{ fontSize: '10px', color: '#666' }}>{promo.description}</div>}
                {promo.conditions && <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{promo.conditions}</div>}
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  {promo.valid_from && <span style={{ fontSize: '9px', color: '#aaa' }}>Desde: {promo.valid_from}</span>}
                  {promo.valid_until && <span style={{ fontSize: '9px', color: '#aaa' }}>Hasta: {promo.valid_until}</span>}
                  {promo.book_by && <span style={{ fontSize: '9px', color: '#aaa' }}>Reservar antes: {promo.book_by}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pedir disponibilidad */}
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px', letterSpacing: '0.05em' }}>CONSULTA DE DISPONIBILIDAD</div>
          {hotel.contact_email ? (
            <p style={{ fontSize: '11px', color: '#666', margin: '0 0 12px' }}>
              Se enviará un mail a <strong>{hotel.contact_email}</strong> con los detalles y dos botones para que el hotel confirme o rechace.
            </p>
          ) : (
            <p style={{ fontSize: '11px', color: '#ef4444', margin: '0 0 12px' }}>
              Este hotel no tiene email de contacto configurado.
            </p>
          )}
          {hotel.contact_email && (
            <Link href={`/hoteles/${params.id}/disponibilidad`} style={{
              display: 'inline-block', background: '#1a1a1a', color: '#fff',
              fontSize: '11px', padding: '8px 16px', borderRadius: '6px', textDecoration: 'none',
            }}>
              Pedir disponibilidad →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
