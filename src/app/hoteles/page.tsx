import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HotelesPage({
  searchParams,
}: {
  searchParams: { region?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const region = searchParams.region ?? 'AR'

  const { data: destinations } = await supabase
    .from('destinations')
    .select('id, code, name, country')
    .eq('active', true)
    .eq('country', region)
    .order('name')

  const { data: hotels } = await supabase
    .from('hotels')
    .select(`
      id, name, category, priority, distance_center,
      contact_email, is_direct, net_rate_validity,
      closing_date, is_family, family_type, destination_id,
      rates ( room_base, pc_rate, net_rate, season )
    `)
    .eq('active', true)
    .order('priority')

  const categoryOrder = ['Inn/Apart', 'Inn', 'Comfort', 'Superior', 'Luxury']

  const categoryColors: Record<string, string> = {
    'Inn/Apart': '#dbeafe|#1e40af',
    'Inn':       '#f3f4f6|#374151',
    'Comfort':   '#fef3c7|#92400e',
    'Superior':  '#ede9fe|#5b21b6',
    'Luxury':    '#fefce8|#713f12',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f8f6', fontFamily: "'DM Mono', 'Courier New', monospace" }}>

      {/* SIDEBAR */}
      <aside style={{
        width: '200px',
        minWidth: '200px',
        background: '#1a1a1a',
        borderRight: '1px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Say Hueque</div>
          <div style={{ color: '#666', fontSize: '10px', marginTop: '2px', letterSpacing: '0.05em' }}>Alojamiento</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px 0', flex: 1 }}>
          <div style={{ padding: '6px 14px 4px', color: '#444', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Temporada 26-27</div>

          {[
            { label: 'Argentina', country: 'AR', emoji: '🇦🇷' },
            { label: 'Exterior', country: 'CL', emoji: '🌎' },
            { label: 'Brasil', country: 'BR', emoji: '🇧🇷' },
          ].map(({ label, country, emoji }) => (
            <Link
              key={country}
              href={`/hoteles?region=${country}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                fontSize: '12px',
                color: region === country ? '#fff' : '#888',
                background: region === country ? '#2a2a2a' : 'transparent',
                textDecoration: 'none',
                borderLeft: region === country ? '2px solid #fff' : '2px solid transparent',
                transition: 'all 0.1s',
              }}
            >
              <span style={{ fontSize: '11px' }}>{emoji}</span>
              {label}
            </Link>
          ))}

          <div style={{ margin: '12px 0 4px', borderTop: '1px solid #2a2a2a' }} />
          <div style={{ padding: '6px 14px 4px', color: '#444', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Gestión</div>

          <Link href="/hoteles/nuevo" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 14px', fontSize: '12px', color: '#888',
            textDecoration: 'none',
          }}>
            <span style={{ fontSize: '11px' }}>＋</span> Nuevo hotel
          </Link>
        </nav>

        {/* User */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #2a2a2a' }}>
          <div style={{ color: '#555', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, overflow: 'auto' }}>

        {/* Top bar */}
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid #e0e0d8',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {region === 'AR' ? '🇦🇷 Argentina 26-27' : region === 'CL' ? '🌎 Exterior 26-27' : '🇧🇷 Brasil 26-27'}
            <span style={{ marginLeft: '8px', color: '#aaa' }}>
              {hotels?.filter(h => (destinations ?? []).some(d => d.id === h.destination_id)).length ?? 0} hoteles
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#aaa' }}>Temporada 2026-2027</span>
          </div>
        </div>

        {/* Table */}
        <div style={{ padding: '0' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 70px 80px 70px 80px 70px 80px 90px',
            padding: '6px 16px',
            background: '#f0f0ec',
            borderBottom: '2px solid #d8d8d0',
            position: 'sticky',
            top: '41px',
            zIndex: 9,
          }}>
            {['#', 'Hotel', 'Categ.', 'SGL PC', 'SGL NT', 'DBL PC', 'DBL NT', 'TPL PC', 'TPL NT'].map((h, i) => (
              <div key={i} style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#666',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textAlign: i > 1 ? 'right' : 'left',
              }}>{h}</div>
            ))}
          </div>

          {/* Destinations + rows */}
          {(destinations ?? []).map((dest) => {
            const destHotels = (hotels ?? []).filter(h => h.destination_id === dest.id)
            if (destHotels.length === 0) return null

            const byCategory = categoryOrder.reduce((acc: Record<string, any[]>, cat) => {
              const group = destHotels.filter(h => h.category === cat)
              if (group.length > 0) acc[cat] = group
              return acc
            }, {})

            return (
              <div key={dest.id}>
                {/* Destination header */}
                <div style={{
                  padding: '8px 16px 4px',
                  background: '#1a1a1a',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  {dest.name}
                  <span style={{ color: '#555', fontSize: '10px', fontWeight: 400 }}>{dest.code}</span>
                </div>

                {Object.entries(byCategory).map(([category, catHotels]: [string, any]) => {
                  const [bg, text] = (categoryColors[category] ?? '#f3f4f6|#374151').split('|')
                  return (
                    <div key={category}>
                      {/* Category subheader */}
                      <div style={{
                        padding: '3px 16px 3px 44px',
                        background: bg,
                        borderBottom: `1px solid ${text}22`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: text, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{category}</span>
                        <span style={{ fontSize: '9px', color: `${text}88` }}>{catHotels.length}</span>
                      </div>

                      {/* Hotel rows */}
                      {catHotels.map((hotel: any, idx: number) => {
                        const rates = (hotel.rates ?? []) as any[]
                        const r = (base: string) => rates.find(r => r.room_base === base && r.season === '26-27')
                        const sgl = r('SGL'), dbl = r('DBL'), tpl = r('TPL')
                        const isExpired = hotel.net_rate_validity
                          ? new Date(hotel.net_rate_validity) < new Date()
                          : false

                        return (
                          <Link
                            key={hotel.id}
                            href={`/hoteles/${hotel.id}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '28px 1fr 70px 80px 70px 80px 70px 80px 90px',
                              padding: '5px 16px',
                              borderBottom: '1px solid #ebebeb',
                              background: idx % 2 === 0 ? '#fff' : '#fafaf8',
                              textDecoration: 'none',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            {/* Priority */}
                            <div style={{ fontSize: '9px', color: '#aaa', fontWeight: 600 }}>
                              {String.fromCharCode(64 + (idx + 1))}
                            </div>

                            {/* Name */}
                            <div style={{ minWidth: 0, paddingRight: '8px' }}>
                              <div style={{
                                fontSize: '11px',
                                color: isExpired ? '#ef4444' : '#1a1a1a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {hotel.name}
                                {hotel.is_family && <span style={{ marginLeft: '4px', color: '#f59e0b', fontSize: '9px' }}>FAM</span>}
                                {!hotel.is_direct && <span style={{ marginLeft: '4px', color: '#8b5cf6', fontSize: '9px' }}>PLT</span>}
                              </div>
                              {hotel.distance_center && (
                                <div style={{ fontSize: '9px', color: '#aaa', marginTop: '1px' }}>{hotel.distance_center}</div>
                              )}
                            </div>

                            {/* Category badge */}
                            <div style={{ fontSize: '9px', color: text, textAlign: 'right' }}>{category.replace('Inn/Apart', 'Inn/Apt')}</div>

                            {/* Rates */}
                            {[
                              sgl?.pc_rate, sgl?.net_rate,
                              dbl?.pc_rate, dbl?.net_rate,
                              tpl?.pc_rate, tpl?.net_rate,
                            ].map((val, i) => (
                              <div key={i} style={{
                                fontSize: '11px',
                                color: i % 2 === 0 ? '#1a1a1a' : '#6b7280',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {val != null ? `$${val}` : <span style={{ color: '#ddd' }}>—</span>}
                              </div>
                            ))}
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
