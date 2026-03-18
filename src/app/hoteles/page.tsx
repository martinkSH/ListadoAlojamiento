'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  distance_center: string | null; is_direct: boolean; is_family: boolean
  net_rate_validity: string | null; destination_id: string
  rates: { room_base: string; pc_rate: number | null; net_rate: number | null; season: string }[]
}
type Destination = { id: string; code: string; name: string; country: string }

const CAT_STYLES: Record<string, { bg: string; pill: string; text: string }> = {
  'Inn/Apart':    { bg: '#e8f0fb', pill: '#c7d9f5', text: '#1a3a7a' },
  'Inn':          { bg: '#eeeeee', pill: '#d8d8d8', text: '#333333' },
  'Inn/Comfort':  { bg: '#e0f0fa', pill: '#b8ddf5', text: '#054a7a' },
  'Comfort':      { bg: '#fdf0d0', pill: '#f8de9a', text: '#7a4000' },
  'Superior':     { bg: '#ede8fb', pill: '#d5ccf5', text: '#3d1580' },
  'Superior+':    { bg: '#e8e0fb', pill: '#c8b8f0', text: '#2d0f70' },
  'Luxury':       { bg: '#fbf8d8', pill: '#f0e890', text: '#5a4000' },
  'Estancia sup': { bg: '#e0f5e8', pill: '#b0e8c0', text: '#0a4a20' },
  'Estancia lux': { bg: '#d8f5ee', pill: '#9ae0cc', text: '#054030' },
  'Otros':        { bg: '#f0ede8', pill: '#ddd8d0', text: '#4a4040' },
}
const CAT_ORDER = ['Inn/Apart','Inn','Inn/Comfort','Comfort','Superior','Superior+','Luxury','Estancia sup','Estancia lux','Otros']

const REGIONS = [
  { key: 'AR', label: 'Argentina',        flag: '🇦🇷', countries: ['AR'] },
  { key: 'CA', label: 'Carretera Austral', flag: '🛣️', countries: [] },
  { key: 'EX', label: 'Exterior',          flag: '🌎', countries: ['CL','PE','UY','PY','CO','EC','BO'] },
  { key: 'BR', label: 'Brasil',            flag: '🇧🇷', countries: ['BR'] },
]

const CA_CODES = ['Caleta Tor','Chaitén','Puelo','Hornopirén','La Junta','Aysen','Puyuhuapi','Coyhaique','Villa C. C','Puerto Tra','Chile Chic','Puerto Gua','Cochrane',"Villa O'Hi"]
const COUNTRY_FLAGS: Record<string, string> = { AR:'🇦🇷',CL:'🇨🇱',BR:'🇧🇷',PE:'🇵🇪',UY:'🇺🇾',PY:'🇵🇾',CO:'🇨🇴',EC:'🇪🇨',BO:'🇧🇴' }

const GRID = '18px 20px 1fr 68px 58px 50px 58px 50px'

function HotelRow({ hotel, idx, isAdmin, onNavigate }: {
  hotel: Hotel; idx: number; isAdmin: boolean; onNavigate: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: hotel.id, disabled: !isAdmin })
  const [hovered, setHovered] = useState(false)

  const rates = hotel.rates ?? []
  const r = (base: string) => rates.find(r => r.room_base === base && r.season === '26-27')
  const sgl = r('SGL'), dbl = r('DBL')
  const isExpired = hotel.net_rate_validity ? new Date(hotel.net_rate_validity) < new Date() : false
  const baseBg = idx % 2 === 0 ? '#ffffff' : '#f9f6f2'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1,
        display: 'grid', gridTemplateColumns: GRID, padding: '5px 14px',
        borderBottom: '0.5px solid #ddd8d0', background: hovered ? '#eee8e0' : baseBg,
        alignItems: 'center', cursor: 'pointer' }}
      onClick={() => onNavigate(hotel.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div {...(isAdmin ? { ...attributes, ...listeners } : {})} onClick={e => e.stopPropagation()}
        style={{ color: isAdmin ? '#a89880' : 'transparent', fontSize: '14px', cursor: isAdmin ? 'grab' : 'default' }}>⠿</div>
      <div style={{ fontSize: '10px', color: '#a09080', fontWeight: 600, fontFamily: 'monospace' }}>
        {String.fromCharCode(64 + (idx + 1))}
      </div>
      <div style={{ minWidth: 0, paddingRight: '8px' }}>
        <div style={{ fontSize: '12px', color: isExpired ? '#c0392b' : '#2c2420', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hotel.name}
          {hotel.is_family && <span style={{ marginLeft: '5px', fontSize: '9px', color: '#7a4000', background: '#f8de9a', padding: '0 5px', borderRadius: '3px', fontWeight: 600 }}>FAM</span>}
          {!hotel.is_direct && <span style={{ marginLeft: '5px', fontSize: '9px', color: '#3d1580', background: '#d5ccf5', padding: '0 5px', borderRadius: '3px', fontWeight: 600 }}>PLT</span>}
        </div>
        {hotel.distance_center && <div style={{ fontSize: '10px', color: '#a09080', marginTop: '1px' }}>{hotel.distance_center}</div>}
      </div>
      <div style={{ fontSize: '10px', color: CAT_STYLES[hotel.category]?.text ?? '#333', textAlign: 'right', paddingRight: '4px', fontWeight: 500 }}>
        {hotel.category.replace('Inn/Apart','Inn/Apt').replace('Estancia sup','Est.sup').replace('Estancia lux','Est.lux')}
      </div>
      {[sgl?.pc_rate, sgl?.net_rate, dbl?.pc_rate, dbl?.net_rate].map((val, i) => (
        <div key={i} style={{ fontSize: '12px', color: i % 2 === 0 ? '#2c2420' : '#a09080', textAlign: 'right', fontFamily: 'monospace' }}>
          {val != null ? `$${val}` : <span style={{ color: '#ccc8c0' }}>—</span>}
        </div>
      ))}
    </div>
  )
}

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
      .from('destinations').select('id,code,name,country').eq('active', true).order('name')
    setDestinations((dests ?? []) as Destination[])

    const allDests = (dests ?? []) as Destination[]
    let destIds: string[]

    if (region === 'CA') {
      destIds = allDests.filter(d => CA_CODES.includes(d.code)).map(d => d.id)
    } else {
      const countries = REGIONS.find(r => r.key === region)?.countries ?? []
      destIds = allDests.filter(d => countries.includes(d.country) && !CA_CODES.includes(d.code)).map(d => d.id)
    }

    if (!destIds.length) { setHotels([]); setLoading(false); return }

    const { data: h } = await supabase
      .from('hotels')
      .select('id,name,category,priority,distance_center,is_direct,is_family,net_rate_validity,destination_id,rates(room_base,pc_rate,net_rate,season)')
      .eq('active', true).in('destination_id', destIds).order('priority')
    setHotels((h ?? []) as Hotel[])
    setLoading(false)
  }

  const filteredDests = (() => {
    let list: Destination[]
    if (region === 'CA') {
      list = destinations.filter(d => CA_CODES.includes(d.code))
    } else {
      const countries = REGIONS.find(r => r.key === region)?.countries ?? []
      list = destinations.filter(d => countries.includes(d.country) && !CA_CODES.includes(d.code))
    }
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(d => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q))
  })()

  function getHotels(destId: string) { return hotels.filter(h => h.destination_id === destId) }

  function groupByCategory(list: Hotel[]) {
    return CAT_ORDER.reduce((acc: Record<string, Hotel[]>, cat) => {
      const g = list.filter(h => h.category === cat)
      if (g.length) acc[cat] = g
      return acc
    }, {})
  }

  async function handleDragEnd(e: DragEndEvent, destId: string, cat: string) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const catHotels = getHotels(destId).filter(h => h.category === cat)
    const oi = catHotels.findIndex(h => h.id === active.id)
    const ni = catHotels.findIndex(h => h.id === over.id)
    if (oi === -1 || ni === -1) return
    const reordered = arrayMove(catHotels, oi, ni)
    setHotels(prev => prev.map(h => { const i = reordered.findIndex(r => r.id === h.id); return i !== -1 ? { ...h, priority: i+1 } : h }))
    setSaving(true)
    await Promise.all(reordered.map((h, i) => supabase.from('hotels').update({ priority: i+1 }).eq('id', h.id)))
    setSaving(false)
  }

  const totalHotels = hotels.filter(h => filteredDests.some(d => d.id === h.destination_id)).length

  const C = {
    sidebar: '#ede6dd', sidebarBorder: '#d4cbbf',
    navActive: '#e0d5c8', navActiveBorder: '#9a8878',
    navText: '#2c2420', navMuted: '#7a6e65', labelMuted: '#9a8d82',
    topbar: '#ffffff', topbarBorder: '#c4bbb0',
    colHeader: '#ddd5cb', colHeaderBorder: '#bdb5ac', colHeaderText: '#5a4e45',
    destHeader: '#cec6bc', destHeaderBorder: '#bdb5ac',
    destHeaderText: '#2c2420', destMuted: '#7a6e65',
  }

  return (
    // CLAVE: height 100vh en el wrapper + overflow hidden
    // El scroll ocurre en #scroll-area, no en window
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f5f0ea', fontFamily: "'Inter','Helvetica Neue',system-ui,sans-serif" }}>

      {/* SIDEBAR — no scrollea */}
      <aside style={{ width: '188px', minWidth: '188px', background: C.sidebar, borderRight: `0.5px solid ${C.sidebarBorder}`, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px 12px', borderBottom: `0.5px solid ${C.sidebarBorder}` }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.navText }}>Say Hueque</div>
          <div style={{ fontSize: '10px', color: C.navMuted, marginTop: '2px' }}>Alojamiento 26-27</div>
        </div>
        <nav style={{ padding: '8px 0', flex: 1 }}>
          <div style={{ padding: '6px 14px 3px', fontSize: '9px', color: C.labelMuted, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Región</div>
          {REGIONS.map(({ key, label, flag }) => (
            <button key={key} onClick={() => { setRegion(key); setSearch('') }} style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '7px 14px', fontSize: '12px', border: 'none',
              borderLeft: region === key ? `2px solid ${C.navActiveBorder}` : '2px solid transparent',
              background: region === key ? C.navActive : 'transparent',
              color: region === key ? C.navText : C.navMuted,
              fontWeight: region === key ? 600 : 400,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: '14px' }}>{flag}</span>{label}
            </button>
          ))}
          <div style={{ margin: '8px 0', borderTop: `0.5px solid ${C.sidebarBorder}` }} />
          <div style={{ padding: '6px 14px 3px', fontSize: '9px', color: C.labelMuted, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Gestión</div>
          <a href="/hoteles/nuevo" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', fontSize: '12px', color: C.navMuted, textDecoration: 'none', borderLeft: '2px solid transparent' }}>
            <span style={{ fontWeight: 600 }}>＋</span> Nuevo hotel
          </a>
          <div style={{ margin: '8px 0', borderTop: `0.5px solid ${C.sidebarBorder}` }} />
          <div style={{ padding: '6px 14px 3px', fontSize: '9px', color: C.labelMuted, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Modo</div>
          <button onClick={() => setIsAdmin(a => !a)} style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '7px 14px', fontSize: '12px', border: 'none',
            borderLeft: isAdmin ? '2px solid #c08030' : '2px solid transparent',
            background: isAdmin ? '#f5e8d0' : 'transparent',
            color: isAdmin ? '#7a4800' : C.navMuted,
            fontWeight: isAdmin ? 600 : 400,
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          }}>
            <span>{isAdmin ? '✎' : '👁'}</span>
            {isAdmin ? 'Edición activa' : 'Solo lectura'}
          </button>
        </nav>
        <div style={{ padding: '10px 14px', borderTop: `0.5px solid ${C.sidebarBorder}` }}>
          {saving && <div style={{ fontSize: '9px', color: '#c08030', marginBottom: '3px', fontWeight: 600 }}>Guardando...</div>}
          <div style={{ fontSize: '9px', color: C.navMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
        </div>
      </aside>

      {/* RIGHT PANEL — flex column, scroll solo en el contenido */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar — FIJO, no scrollea */}
        <div style={{ flexShrink: 0, padding: '8px 14px', borderBottom: `1px solid ${C.topbarBorder}`, background: C.topbar, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#a09080', fontSize: '13px', pointerEvents: 'none' }}>⌕</span>
            <input
              type="text" placeholder="Buscar destino (BUE, Bariloche...)"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: '12px', border: `1px solid ${C.topbarBorder}`, borderRadius: '6px', fontFamily: 'inherit', outline: 'none', background: '#faf7f3', color: '#2c2420', boxSizing: 'border-box' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a09080', fontSize: '13px', padding: 0 }}>✕</button>}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '11px', color: C.navMuted, fontWeight: 500 }}>
            {filteredDests.length} destinos · {totalHotels} hoteles
          </div>
        </div>

        {/* Column header — FIJO, no scrollea */}
        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: GRID, padding: '6px 14px', background: C.colHeader, borderBottom: `1px solid ${C.colHeaderBorder}` }}>
          {['', '#', 'Hotel', 'Categ.', 'SGL PC', 'NT', 'DBL PC', 'NT'].map((h, i) => (
            <div key={i} style={{ fontSize: '10px', fontWeight: 700, color: C.colHeaderText, letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: i > 2 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {/* Scrollable content — SOLO ESTO SCROLLEA */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: C.navMuted, fontSize: '13px' }}>Cargando...</div>
          ) : filteredDests.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: C.navMuted, fontSize: '13px' }}>
              No se encontraron destinos{search ? ` para "${search}"` : ''}
            </div>
          ) : filteredDests.map(dest => {
            const destHotels = getHotels(dest.id)
            if (!destHotels.length) return null
            const byCat = groupByCategory(destHotels)
            const flag = region === 'CA' ? '🛣️' : (COUNTRY_FLAGS[dest.country] ?? '')

            return (
              <div key={dest.id}>
                <div style={{ padding: '7px 14px', background: C.destHeader, borderBottom: `1px solid ${C.destHeaderBorder}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>{flag}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: C.destHeaderText }}>{dest.name}</span>
                  <span style={{ fontSize: '10px', color: C.destMuted, fontWeight: 500 }}>{dest.code}</span>
                  <span style={{ fontSize: '10px', color: C.destMuted, marginLeft: 'auto' }}>{destHotels.length} hoteles</span>
                </div>
                {Object.entries(byCat).map(([cat, catHotels]) => {
                  const cs = CAT_STYLES[cat] ?? { bg: '#f0ede8', pill: '#ddd8d0', text: '#4a4040' }
                  return (
                    <div key={cat}>
                      <div style={{ padding: '3px 14px 3px 52px', background: cs.bg, borderBottom: `0.5px solid ${cs.text}30`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: cs.text, background: cs.pill, padding: '1px 8px', borderRadius: '20px' }}>{cat}</span>
                        <span style={{ fontSize: '10px', color: cs.text + 'aa' }}>{catHotels.length}</span>
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
        </div>
      </div>
    </div>
  )
}
