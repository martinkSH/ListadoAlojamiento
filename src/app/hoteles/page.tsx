import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HotelesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: destinations } = await supabase
    .from('destinations')
    .select('id, code, name, country')
    .eq('active', true)
    .order('country')
    .order('name')

  const { data: hotels } = await supabase
    .from('hotels')
    .select(`
      id, name, category, priority, distance_center,
      contact_email, is_direct, net_rate_validity, active,
      destination_id,
      rates ( room_base, pc_rate, net_rate, season )
    `)
    .eq('active', true)
    .eq('rates.season', '26-27')
    .order('priority')

  const hotelsByDest = destinations?.reduce((acc, dest) => {
    acc[dest.id] = (hotels ?? []).filter(h => h.destination_id === dest.id)
    return acc
  }, {} as Record<string, typeof hotels>)

  const categoryOrder = ['Inn/Apart', 'Inn', 'Comfort', 'Superior', 'Luxury']
  const categoryColors: Record<string, string> = {
    'Inn/Apart': 'bg-blue-50 text-blue-700',
    'Inn': 'bg-gray-100 text-gray-700',
    'Comfort': 'bg-amber-50 text-amber-700',
    'Superior': 'bg-purple-50 text-purple-700',
    'Luxury': 'bg-yellow-50 text-yellow-800',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <h1 className="font-bold text-gray-900">Say Hueque — Alojamiento</h1>
          <Link
            href="/hoteles/nuevo"
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            + Agregar hotel
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {destinations?.map(dest => {
          const destHotels = hotelsByDest?.[dest.id] ?? []
          if (destHotels.length === 0) return null

          const byCategory = categoryOrder.reduce((acc, cat) => {
            const group = destHotels.filter(h => h.category === cat)
            if (group.length > 0) acc[cat] = group
            return acc
          }, {} as Record<string, typeof destHotels>)

          return (
            <section key={dest.id} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-900">{dest.name}</h2>
                <span className="text-xs text-gray-400 font-mono">{dest.code}</span>
                <span className="text-xs text-gray-400">{dest.country}</span>
              </div>

              {Object.entries(byCategory).map(([category, catHotels]) => (
                <div key={category} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {category}
                    </span>
                    <span className="text-xs text-gray-400">{catHotels.length} hoteles</span>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {catHotels.map((hotel, idx) => {
                      const sglRate = hotel.rates?.find((r: any) => r.room_base === 'SGL')
                      const dblRate = hotel.rates?.find((r: any) => r.room_base === 'DBL')
                      const isExpired = hotel.net_rate_validity
                        ? new Date(hotel.net_rate_validity) < new Date()
                        : false

                      return (
                        <Link
                          key={hotel.id}
                          href={`/hoteles/${hotel.id}`}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group"
                        >
                          {/* Prioridad */}
                          <span className="text-xs font-mono text-gray-400 w-5 text-center flex-shrink-0">
                            {String.fromCharCode(64 + (idx + 1))}
                          </span>

                          {/* Nombre */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate group-hover:text-gray-700">
                              {hotel.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {hotel.distance_center ?? '—'}
                              {hotel.is_direct ? '' : ' · Plataforma'}
                            </p>
                          </div>

                          {/* Tarifas */}
                          <div className="flex gap-6 text-right flex-shrink-0">
                            {sglRate && (
                              <div>
                                <p className="text-xs text-gray-400">SGL</p>
                                <p className="text-sm font-medium text-gray-900">
                                  ${sglRate.pc_rate}
                                </p>
                                <p className="text-xs text-gray-500">NT ${sglRate.net_rate}</p>
                              </div>
                            )}
                            {dblRate && (
                              <div>
                                <p className="text-xs text-gray-400">DBL</p>
                                <p className="text-sm font-medium text-gray-900">
                                  ${dblRate.pc_rate}
                                </p>
                                <p className="text-xs text-gray-500">NT ${dblRate.net_rate}</p>
                              </div>
                            )}
                          </div>

                          {/* Vigencia */}
                          {isExpired && (
                            <span className="text-xs text-red-500 flex-shrink-0">Vencida</span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          )
        })}
      </main>
    </div>
  )
}
