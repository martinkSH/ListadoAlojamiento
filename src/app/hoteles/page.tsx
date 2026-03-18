'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Hotel = {
  id: string
  name: string
  category: string
  priority: number
  distance_center: string | null
  contact_email: string | null
  is_direct: boolean
  is_family: boolean
  net_rate_validity: string | null
  destination_id: string
  rates: { room_base: string; pc_rate: number | null; net_rate: number | null; season: string }[]
}

type Destination = {
  id: string
  code: string
  name: string
  country: string
}

const categoryColors: Record<string, [string, string]> = {
  'Inn/Apart':   ['#dbeafe', '#1e40af'],
  'Inn':         ['#f3f4f6', '#374151'],
  'Comfort':     ['#fef3c7', '#92400e'],
  'Superior':    ['#ede9fe', '#5b21b6'],
  'Superior+':   ['#ede9fe', '#4c1d95'],
  'Luxury':      ['#fefce8', '#713f12'],
  'Estancia sup':['#d1fae5', '#065f46'],
  'Estancia lux':['#ecfdf5', '#064e3b'],
  'Inn/Comfort': ['#e0f2fe', '#0c4a6e'],
  'Otros':       ['#f3f4f6', '#6b7280'],
}
const categoryOrder = ['Inn/Apart','Inn','Inn/Comfort','Comfort','Superior','Superior+','Luxury','Estancia sup','Estancia lux','Otros']

// ── Sortable hotel row ────────────────────────────────────
function SortableHotelRow({
  hotel, idx, isAdmin, onNavigate
}: {
  hotel: Hotel
  idx: number
  isAdmin: boolean
  onNavigate: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: hotel.id, disabled: !isAdmin })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined,
  }

  const rates = hotel.rates ?? []
  const r = (base: string) => rates.find(r => r.room_base === base && r.season === '26-27')
  const sgl = r('SGL'), dbl = r('DBL'), tpl = r('TPL')
  const isExpired = hotel.net_rate_validity
    ? new Date(hotel.net_rate_validity) < new Date()
    : false

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onNavigate(hotel.id)}
      className="hotel-row"
      css-data-expired={isExpired ? 'true' : 'false'}
    >
      <style>{`
        .hotel-row {
          display: grid;
          grid-template-columns: 20px 24px 1fr 72px 68px 60px 68px 60px 68px 60px;
          padding: 4px 12px;
          border-bottom: 1px solid #ebebeb;
          background: ${idx % 2 === 0 ? '#fff' : '#fafaf8'};
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
        .hotel-row:hover { background: #f0f4ff !important; }
      `}</style>

      {/* Drag handle */}
      <div
        {...(isAdmin ? { ...attributes, ...listeners } : {})}
        onClick={e => e.stopPropagation()}
        style={{
          cursor: isAdmin ? 'grab' : 'default',
          color: '#ccc',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {isAdmin ? '⠿' : ''}
      </div>

      {/* Priority */}
      <div style={{ fontSize: '9px', color: '#aaa', fontWeight: 600, fontFamily: 'monospace' }}>
        {String.fromCharCode(64 + (idx + 1))}
      </div>

      {/* Name */}
      <div style={{ minWidth: 0, paddingRight: '8px' }}>
        <div style={{
          fontSize: '11px',
          color: isExpired ? '#ef4444' : '#1a1a1a',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hotel.name}
          {hotel.is_family && <span style={{ marginLeft: '4px', color: '#f59e0b', fontSize: '9px' }}>FAM</span>}
          {!hotel.is_direct && <span style={{ marginLeft: '4px', color: '#8b5cf6', fontSize: '9px' }}>PLT</span>}
        </div>
        {hotel.distance_center && (
          <div style={{ fontSize: '9px', color: '#aaa', marginTop: '1px' }}>{hotel.distance_center}</div>
        )}
      </div>

      {/* Category */}
      <div style={{ fontSize: '9px', color: categoryColors[hotel.category]?.[1] ?? '#374151', textAlign: 'right' }}>
        {hotel.category}
      </div>

      {/* Rates */}
      {[sgl?.pc_rate, sgl?.net_rate, dbl?.pc_rate, dbl?.net_rate, tpl?.pc_rate, tpl?.net_rate].map((val, i) => (
        <div key={i} style={{
          fontSize: '11px',
          color: i % 2 === 0 ? '#1a1a1a' : '#9ca3af',
          textAlign: 'right',
          fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {val != null ? `$${val}` : <span style={{ color: '#e5e7eb' }}>—</span>}
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
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

  useEffect(() => {
    loadData()
  }, [region])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    setUserEmail(user.email ?? '')

    const { data: dests } = await supabase
      .from('destinations').select('id, code, name, country')
      .eq('active', true).order('name')
    setDestinations((dests ?? []) as Destination[])

    const destIds = ((dests ?? []) as Destination[])
      .filter(d => {
        if (region === 'AR') return d.country === 'AR'
        if (region === 'EX') return !['AR','BR'].includes(d.country)
        if (region === 'BR') return d.country === 'BR'
        return true
      }).map(d => d.id)

    if (destIds.length === 0) { setHotels([]); setLoading(false); return }

    const { data: h } = await supabase
      .from('hotels')
      .select('id, name, category, priority, distance_center, contact_email, is_direct, is_family, net_rate_validity, destination_id, rates(room_base, pc_rate, net_rate, season)')
      .eq('active', true)
      .in('destination_id', destIds)
      .order('priority')
    setHotels((h ?? []) as Hotel[])
    setLoading(false)
  }

  // Filter destinations by search
  const filteredDests = destinations.filter(d => {
    if (!search) return true
    const q = search.toLowerCase()
    return d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
  }).filter(d => {
    if (region === 'AR') return d.country === 'AR'
    if (region === 'EX') return !['AR','BR'].includes(d.country)
    if (region === 'BR') return d.country === 'BR'
    return true
  })

  function getHotelsForDest(destId: string) {
    return hotels.filter(h => h.destination_id === destId)
  }

  function groupByCategory(destHotels: Hotel[]) {
    return categoryOrder.reduce((acc: Record<string, Hotel[]>, cat) => {
      const group = destHotels.filter(h => h.category === cat)
      if (group.length > 0) acc[cat] = group
      return acc
    }, {})
  }

  async function handleDragEnd(event: DragEndEvent, destId: string) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const destHotels = getHotelsForDest(destId)
    const oldIdx = destHotels.findIndex(h => h.id === active.id)
    const newIdx = destHotels.findIndex(h => h.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(destHotels, oldIdx, newIdx)

    // Optimistic update
    const updated = hotels.map(h => {
      const found = reordered.findIndex(r => r.id === h.id)
      if (found !== -1) return { ...h, priority: found + 1 }
      return h
    })
    setHotels(updated)

    // Save to DB
    setSaving(true)
    await Promise.all(
      reordered.map((h, i) =>
        supabase.from('hotels').update({ priority: i + 1 }).eq('id', h.id)
      )
    )
    setSaving(false)
  }

  function navigate(id: string) {
    window.location.href = `/hoteles/${id}`
  }

  const regions = [
    { key: 'AR', label: 'Argentina', emoji: '🇦🇷' },
    { key: 'EX', label: 'Exterior', emoji: '🌎' },
    { key: 'BR', label: 'Brasil', emoji: '🇧🇷' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f8f6', fontFamily: "'DM Mono', 'Courier New', monospace" }}>

      {/* SIDEBAR */}
      <aside style={{ width: '190px', minWidth: '190px', background: '#1a1a1a', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em' }}>SAY HUEQUE</div>
          <div style={{ color: '#555', fontSize: '10px', marginTop: '2px' }}>Alojamiento 26-27</div>
        </div>

        <nav style={{ padding: '8px 0', flex: 1 }}>
          <div style={{ padding: '6px 14px 4px', color: '#444', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Región</div>
          {regions.map(({ key, label, emoji }) => (
            <button key={key} onClick={() => { setRegion(key); setSearch('') }} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '7px 14px', fontSize: '12px',
              color: region === key ? '#fff' : '#888',
              background: region === key ? '#2a2a2a' : 'transparent',
              border: 'none', borderLeft: region === key ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: '11px' }}>{emoji}</span>{label}
            </button>
          ))}

          <div style={{ margin: '10px 0 4px', borderTop: '1px solid #2a2a2a' }} />
          <div style={{ padding: '6px 14px 4px', color: '#444', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Gestión</div>
          <a href="/hoteles/nuevo" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', fontSize: '12px', color: '#888', textDecoration: 'none' }}>
            <span>＋</span> Nuevo hotel
          </a>

          <div style={{ margin: '10px 0 4px', borderTop: '1px solid #2a2a2a' }} />
          <div style={{ padding: '6px 14px 4px', color: '#444', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Modo</div>
          <button onClick={() => setIsAdmin(a => !a)} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%', padding: '7px 14px', fontSize: '11px',
            color: isAdmin ? '#facc15' : '#888',
            background: isAdmin ? '#2a2200' : 'transparent',
            border: 'none', borderLeft: isAdmin ? '2px solid #facc15' : '2px solid transparent',
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span>{isAdmin ? '✎' : '👁'}</span>
            {isAdmin ? 'Edición activa' : 'Solo lectura'}
          </button>
        </nav>

        <div style={{ padding: '10px 14px', borderTop: '1px solid #2a2a2a' }}>
          {saving && <div style={{ color: '#facc15', fontSize: '9px', marginBottom: '4px' }}>Guardando...</div>}
          <div style={{ color: '#444', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: 'auto' }}>

        {/* Top bar */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0d8', background: '#fff', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 10 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '12px' }}>⌕</span>
            <input
              type="text"
              placeholder="Buscar destino (ej: BUE, Bariloche...)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px 6px 26px', fontSize: '11px',
                border: '1px solid #e0e0d8', borderRadius: '6px',
                fontFamily: 'inherit', outline: 'none', background: '#fafaf8',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '12px' }}>✕</button>
            )}
          </div>

          {/* Stats */}
          <div style={{ fontSize: '10px', color: '#aaa', marginLeft: 'auto' }}>
            {filteredDests.length} destinos · {hotels.filter(h => filteredDests.some(d => d.id === h.destination_id)).length} hoteles
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '20px 24px 1fr 72px 68px 60px 68px 60px 68px 60px', padding: '5px 12px', background: '#f0f0ec', borderBottom: '2px solid #d8d8d0', position: 'sticky', top: '41px', zIndex: 9 }}>
          {['', '#', 'Hotel', 'Categ.', 'SGL PC', 'NT', 'DBL PC', 'NT', 'TPL PC', 'NT'].map((h, i) => (
            <div key={i} style={{ fontSize: '9px', fontWeight: 700, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: i > 2 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Cargando...</div>
        ) : filteredDests.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>
            No se encontraron destinos para "{search}"
          </div>
        ) : (
          filteredDests.map(dest => {
            const destHotels = getHotelsForDest(dest.id)
            if (destHotels.length === 0) return null
            const byCategory = groupByCategory(destHotels)

            return (
              <div key={dest.id}>
                {/* Destination header */}
                <div style={{ padding: '6px 12px', background: '#1a1a1a', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {dest.name}
                  <span style={{ color: '#555', fontSize: '10px', fontWeight: 400 }}>{dest.code}</span>
                  <span style={{ color: '#444', fontSize: '10px', fontWeight: 400, marginLeft: 'auto' }}>{destHotels.length} hoteles</span>
                </div>

                {Object.entries(byCategory).map(([category, catHotels]) => {
                  const [bg] = categoryColors[category] ?? ['#f3f4f6', '#374151']
                  return (
                    <div key={category}>
                      <div style={{ padding: '2px 12px 2px 56px', background: bg, borderBottom: `1px solid ${categoryColors[category]?.[1] ?? '#ccc'}22`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: categoryColors[category]?.[1] ?? '#374151', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{category}</span>
                        <span style={{ fontSize: '9px', color: `${categoryColors[category]?.[1] ?? '#374151'}88` }}>{catHotels.length}</span>
                      </div>

                      {isAdmin ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, dest.id)}>
                          <SortableContext items={catHotels.map(h => h.id)} strategy={verticalListSortingStrategy}>
                            {catHotels.map((hotel, idx) => (
                              <SortableHotelRow key={hotel.id} hotel={hotel} idx={idx} isAdmin={isAdmin} onNavigate={navigate} />
                            ))}
                          </SortableContext>
                        </DndContext>
                      ) : (
                        catHotels.map((hotel, idx) => (
                          <SortableHotelRow key={hotel.id} hotel={hotel} idx={idx} isAdmin={false} onNavigate={navigate} />
                        ))
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
