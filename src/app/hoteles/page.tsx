'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Hotel = {
  id: string; name: string; category: string; priority: number
  distance_center: string | null; contact_email: string | null
  is_direct: boolean; is_family: boolean; net_rate_validity: string | null
  destination_id: string
  rates: { room_base: string; pc_rate: number | null; net_rate: number | null; season: string }[]
}
type Destination = { id: string; code: string; name: string; country: string }

const CAT_STYLES: Record<string, { bg: string; pill: string; text: string }> = {
  'Inn/Apart':    { bg: '#eef4fd', pill: '#dbeafe', text: '#1e40af' },
  'Inn':          { bg: '#f7f7f7', pill: '#efefef', text: '#4b5563' },
  'Inn/Comfort':  { bg: '#f0f9ff', pill: '#e0f2fe', text: '#075985' },
  'Comfort':      { bg: '#fffbeb', pill: '#fef3c7', text: '#92400e' },
  'Superior':     { bg: '#f5f3ff', pill: '#ede9fe', text: '#5b21b6' },
  'Superior+':    { bg: '#f5f3ff', pill: '#ddd6fe', text: '#4c1d95' },
  'Luxury':       { bg: '#fefce8', pill: '#fef9c3', text: '#713f12' },
  'Estancia sup': { bg: '#f0fdf4', pill: '#dcfce7', text: '#14532d' },
  'Estancia lux': { bg: '#ecfdf5', pill: '#d1fae5', text: '#064e3b' },
  'Otros':        { bg: '#faf8f5', pill: '#f5f0eb', text: '#78716c' },
}
const CAT_ORDER = ['Inn/Apart','Inn','Inn/Comfort','Comfort','Superior','Superior+','Luxury','Estancia sup','Estancia lux','Otros']

const REGIONS = [
  { key: 'AR', label: 'Argentina',       flag: '🇦🇷', countries: ['AR'] },
  { key: 'EX', label: 'Exterior',        flag: '🌎',  countries: ['CL','PE','UY','PY','CO','EC','BO'] },
  { key: 'CA', label: 'Carretera Austral', flag: '🛣️',  countries: ['CA'] },
  { key: 'BR', label: 'Brasil',          flag: '🇧🇷', countries: ['BR'] },
]

const COUNTRY_FLAGS: Record<string, string> = {
  AR:'🇦🇷', CL:'🇨🇱', BR:'🇧🇷', PE:'🇵🇪', UY:'🇺🇾',
  PY:'🇵🇾', CO:'🇨🇴', EC:'🇪🇨', BO:'🇧🇴', CA:'🛣️',
}

// ── Sortable row ────────────────────────────────────────
function HotelRow({ hotel, idx, isAdmin, onNavigate }: {
  hotel: Hotel; idx: number; isAdmin: boolean; onNavigate: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: hotel.id, disabled: !isAdmin })

  const rates = hotel.rates ?? []
  const r = (base: string) => rates.find(r => r.room_base === base && r.season === '26-27')
  const sgl = r('SGL'), dbl = r('DBL')
  const isExpired = hotel.net_rate_validity ? new Date(hotel.net_rate_validity) < new Date() : false

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        display: 'grid',
        gridTemplateColumns: '18px 18px 1fr 62px 56px 48px 56px 48px',
        padding: '5px 14px',
        borderBottom: '0.5px solid #ede8e2',
        background: idx % 2 === 0 ? '#ffffff' : '#fdf9f6',
        alignItems: 'center',
        cursor: 'pointer',
      }}
      onClick={() => onNavigate(hotel.id)}
    >
      {/* Drag handle */}
      <div
        {...(isAdmin ? { ...attributes, ...listeners } : {})}
        onClick={e => e.stopPropagation()}
        style={{ color: isAdmin ? '#c4b8ad' : 'transparent', fontSize: '13px', cursor: isAdmin ? 'grab' : 'default', lineHeight: 1 }}
      >⠿</div>

      {/* Priority */}
      <div style={{ fontSize: '9px', color: '#c4b8ad', fontWeight: 600, fontFamily: 'monospace' }}>
        {String.fromCharCode(64 + (idx + 1))}
      </div>

      {/* Name */}
      <div style={{ minWidth: 0, paddingRight: '8px' }}>
        <div style={{ fontSize: '11px', color: isExpired ? '#e57373' : '#3d3228', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hotel.name}
          {hotel.is_family && <span style={{ marginLeft: '5px', fontSize: '9px', color: '#d97706', background: '#fef3c7', padding: '0 4px', borderRadius: '3px' }}>FAM</span>}
          {!hotel.is_direct && <span style={{ marginLeft: '5px', fontSize: '9px', color: '#7c3aed', background: '#ede9fe', padding: '0 4px', borderRadius: '3px' }}>PLT</span>}
        </div>
        {hotel.distance_center && <div style={{ fontSize: '9px', color: '#c4b8ad', marginTop: '1px' }}>{hotel.distance_center}</div>}
      </div>

      {/* Category */}
      <div style={{ fontSize: '9px', color: CAT_STYLES[hotel.category]?.text ?? '#4b5563', textAlign: 'right', paddingRight: '4px' }}>
        {hotel.category.replace('Inn/Apart', 'Inn/Apt').replace('Estancia sup', 'Est.sup').replace('Estancia lux', 'Est.lux')}
      </div>

      {/* Rates */}
      {[sgl?.pc_rate, sgl?.net_rate, dbl?.pc_rate, dbl?.net_rate].map((val, i) => (
        <div key={i} style={{ fontSize: '11px', color: i % 2 === 0 ? '#3d3228' : '#c4b8ad', textAlign: 'right', fontFamily: 'monospace' }}>
          {val != null ? `$${val}` : <span style={{ color: '#e8e3dc' }}>—</span>}
        </div>
      ))}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────
export default function HotelesPage() {
  const supabase = createClient()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [region, setRegion] = useState('AR')
  const [search, setSearch] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { loadData() }, [region])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    setUserEmail(user.email ?? '')

    const { data: dests } = await supabase
      .from('destinations').select('id, code, name, country')
      .eq('active', true).order('name')
    setDestinations((dests ?? []) as Destination[])

    const regionCountries = REGIONS.find(r => r.key === region)?.countries ?? []
    const destIds = ((dests ?? []) as Destination[])
      .filter(d => regionCountries.includes(d.country)).map(d => d.id)

    if (!destIds.length) { setHotels([]); setLoading(false); return }

    const { data: h } = await supabase
      .from('hotels')
      .select('id,name,category,priority,distance_center,contact_email,is_direct,is_family,net_rate_validity,destination_id,rates(room_base,pc_rate,net_rate,season)')
      .eq('active', true).in('destination_id', destIds).order('priority')
    setHotels((h ?? []) as Hotel[])
    setLoading(false)
  }

  const regionCountries = REGIONS.find(r => r.key === region)?.countries ?? []
  const filteredDests = destinations
    .filter(d => regionCountries.includes(d.country))
    .filter(d => !search || d.code.toLowerCase().includes(search.toLowerCase()) || d.name.toLowerCase().includes(search.toLowerCase()))

  function getHotels(destId: string) {
    return hotels.filter(h => h.destination_id === destId)
  }

  function groupByCategory(list: Hotel[]) {
    return CAT_ORDER.reduce((acc: Record<string, Hotel[]>, cat) => {
      const g = list.filter(h => h.category === cat)
      if (g.length) acc[cat] = g
      return acc
    }, {})
  }

  async function handleDragEnd(e: DragEndEvent, destId: string, category: string) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const destHotels = getHotels(destId).filter(h => h.category === category)
    const oldIdx = destHotels.findIndex(h => h.id === active.id)
    const newIdx = destHotels.findIndex(h => h.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(destHotels, oldIdx, newIdx)
    setHotels(prev => prev.map(h => {
      const i = reordered.findIndex(r => r.id === h.id)
      return i !== -1 ? { ...h, priority: i + 1 } : h
    }))

    setSaving(true)
    await Promise.all(reordered.map((h, i) =>
      supabase.from('hotels').update({ priority: i + 1 }).eq('id', h.id)
    ))
    setSaving(false)
  }

  const totalHotels = hotels.filter(h => filteredDests.some(d => d.id === h.destination_id)).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#faf8f5', fontFamily: "'Inter', 'Helvetica Neue', system-ui, sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width: '184px', minWidth: '184px', background: '#f5f0eb', borderRight: '0.5px solid #e2ddd6', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>

        <div style={{ padding: '16px 14px 12px', borderBottom: '0.5px solid #e2ddd6' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#4a3f35', letterSpacing: '0.01em' }}>Say Hueque</div>
          <div style={{ fontSize: '10px', color: '#a8998c', marginTop: '2px' }}>Alojamiento 26-27</div>
        </div>

        <nav style={{ padding: '8px 0', flex: 1 }}>
          <div style={{ padding: '6px 14px 3px', fontSize: '9px', color: '#c4b8ad', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Región</div>
          {REGIONS.map(({ key, label, flag }) => (
            <button key={key} onClick={() => { setRegion(key); setSearch('') }} style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '7px 14px', fontSize: '12px', border: 'none',
              borderLeft: region === key ? '2px solid #b8a99a' : '2px solid transparent',
              background: region === key ? '#ece6df' : 'transparent',
              color: region === key ? '#4a3f35' : '#8c7d72',
              fontWeight: region === key ? 500 : 400,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: '14px' }}>{flag}</span>{label}
            </button>
          ))}

          <div style={{ margin: '8px 0', borderTop: '0.5px solid #e2ddd6' }} />
          <div style={{ padding: '6px 14px 3px', fontSize: '9px', color: '#c4b8ad', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Gestión</div>
          <a href="/hoteles/nuevo" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', fontSize: '12px', color: '#8c7d72', textDecoration: 'none', borderLeft: '2px solid transparent' }}>
            <span>＋</span> Nuevo hotel
          </a>

          <div style={{ margin: '8px 0', borderTop: '0.5px solid #e2ddd6' }} />
          <div style={{ padding: '6px 14px 3px', fontSize: '9px', color: '#c4b8ad', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Modo</div>
          <button onClick={() => setIsAdmin(a => !a)} style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '7px 14px', fontSize: '12px', border: 'none',
            borderLeft: isAdmin ? '2px solid #d4a96a' : '2px solid transparent',
            background: isAdmin ? '#fdf3e3' : 'transparent',
            color: isAdmin ? '#92600a' : '#8c7d72',
            fontWeight: isAdmin ? 500 : 400,
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          }}>
            <span style={{ fontSize: '12px' }}>{isAdmin ? '✎' : '👁'}</span>
            {isAdmin ? 'Edición activa' : 'Solo lectura'}
          </button>
        </nav>

        <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e2ddd6' }}>
          {saving && <div style={{ fontSize: '9px', color: '#d4a96a', marginBottom: '3px' }}>Guardando...</div>}
          <div style={{ fontSize: '9px', color: '#c4b8ad', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: 'auto' }}>

        {/* Top bar */}
        <div style={{ padding: '8px 14px', borderBottom: '0.5px solid #e8e3dc', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#c4b8ad', fontSize: '13px', pointerEvents: 'none' }}>⌕</span>
            <input
              type="text"
              placeholder="Buscar destino (BUE, Bariloche...)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: '11px', border: '0.5px solid #e2ddd6', borderRadius: '6px', fontFamily: 'inherit', outline: 'none', background: '#faf8f5', color: '#3d3228', boxSizing: 'border-box' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#c4b8ad', fontSize: '12px', padding: 0 }}>✕</button>
            )}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '10px', color: '#c4b8ad' }}>
            {filteredDests.length} destinos · {totalHotels} hoteles
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '18px 18px 1fr 62px 56px 48px 56px 48px', padding: '5px 14px', background: '#ede8e2', borderBottom: '0.5px solid #ddd7ce', position: 'sticky', top: '41px', zIndex: 9 }}>
          {['', '#', 'Hotel', 'Categ.', 'SGL PC', 'NT', 'DBL PC', 'NT'].map((h, i) => (
            <div key={i} style={{ fontSize: '9px', fontWeight: 600, color: '#a8998c', letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: i > 2 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#c4b8ad', fontSize: '12px' }}>Cargando...</div>
        ) : filteredDests.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#c4b8ad', fontSize: '12px' }}>
            No se encontraron destinos{search ? ` para "${search}"` : ''}
          </div>
        ) : filteredDests.map(dest => {
          const destHotels = getHotels(dest.id)
          if (!destHotels.length) return null
          const byCat = groupByCategory(destHotels)
          const flag = COUNTRY_FLAGS[dest.country] ?? ''

          return (
            <div key={dest.id}>
              {/* Destination header */}
              <div style={{ padding: '6px 14px', background: '#e8e3dc', borderBottom: '0.5px solid #ddd7ce', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px' }}>{flag}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#4a3f35' }}>{dest.name}</span>
                <span style={{ fontSize: '9px', color: '#b8a99a' }}>{dest.code}</span>
                <span style={{ fontSize: '9px', color: '#c4b8ad', marginLeft: 'auto' }}>{destHotels.length} hoteles</span>
              </div>

              {Object.entries(byCat).map(([cat, catHotels]) => {
                const cs = CAT_STYLES[cat] ?? { bg: '#faf8f5', pill: '#f5f0eb', text: '#78716c' }
                return (
                  <div key={cat}>
                    <div style={{ padding: '3px 14px 3px 50px', background: cs.bg, borderBottom: `0.5px solid ${cs.text}18`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 600, color: cs.text, background: cs.pill, padding: '1px 7px', borderRadius: '20px', letterSpacing: '0.05em' }}>{cat}</span>
                      <span style={{ fontSize: '9px', color: cs.text + '99' }}>{catHotels.length}</span>
                    </div>

                    {isAdmin ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleDragEnd(e, dest.id, cat)}>
                        <SortableContext items={catHotels.map(h => h.id)} strategy={verticalListSortingStrategy}>
                          {catHotels.map((h, i) => <HotelRow key={h.id} hotel={h} idx={i} isAdmin={true} onNavigate={id => window.location.href = `/hoteles/${id}`} />)}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      catHotels.map((h, i) => <HotelRow key={h.id} hotel={h} idx={i} isAdmin={false} onNavigate={id => window.location.href = `/hoteles/${id}`} />)
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </main>
    </div>
  )
}
