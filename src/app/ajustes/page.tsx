'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Destination = { id: string; code: string; name: string; country: string }
type PreviewRate = {
  hotel_id: string; hotel_name: string; room_base: string
  current_pc: number; new_pc: number; rate_id: string
}
type Adjustment = {
  id: string; created_at: string; applied_email: string
  adjustment_pct: number; category: string; rates_affected: number; note: string | null
  destinations: { name: string; code: string }
}

const CATEGORIES = ['Inn/Apart','Inn','Inn/Comfort','Comfort','Superior','Superior+','Luxury','Estancia sup','Estancia lux','Otros']
const SEASONS = ['26-27', '24-25']
const COUNTRY_FLAGS: Record<string,string> = { AR:'🇦🇷',CL:'🇨🇱',BR:'🇧🇷',PE:'🇵🇪',UY:'🇺🇾',PY:'🇵🇾',CO:'🇨🇴',EC:'🇪🇨',BO:'🇧🇴' }

const font = "'Inter','Helvetica Neue',system-ui,sans-serif"
const C = {
  bg: '#f5f0ea', sidebar: '#ede6dd', sidebarBorder: '#d4cbbf',
  card: '#fff', cardBorder: '#ddd5cb', cardHead: '#f5f0ea',
  text: '#2c2420', muted: '#7a6e65', label: '#9a8d82',
  input: '#faf7f3', inputBorder: '#ccc5bb',
  btnPrimary: '#4a3f35', btnDanger: '#b91c1c',
  success: '#15803d', successBg: '#f0fdf4', successBorder: '#86efac',
  error: '#b91c1c', errorBg: '#fef2f2', errorBorder: '#fca5a5',
  increase: '#15803d', increaseBg: '#dcfce7',
  decrease: '#b91c1c', decreaseBg: '#fee2e2',
  neutral: '#7a6e65', neutralBg: '#f5f0ea',
}

export default function AjustesPage() {
  const supabase = createClient()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [destId, setDestId] = useState('')
  const [category, setCategory] = useState('Inn')
  const [season, setSeason] = useState('26-27')
  const [pct, setPct] = useState('')
  const [note, setNote] = useState('')
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [preview, setPreview] = useState<PreviewRate[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState<{ type: 'success'|'error'; text: string } | null>(null)
  const [history, setHistory] = useState<Adjustment[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserEmail(user.email ?? '')
      setUserId(user.id)

      const { data: dests } = await supabase
        .from('destinations').select('id,code,name,country')
        .eq('active', true).order('country').order('name')
      setDestinations((dests ?? []) as Destination[])

      loadHistory()
    }
    load()
  }, [])

  async function loadCategories(id: string) {
    if (!id) { setAvailableCategories([]); return }
    setLoadingCats(true)
    const { data } = await supabase
      .from('hotels')
      .select('category')
      .eq('destination_id', id)
      .eq('active', true) as any
    const cats = Array.from(new Set((data ?? []).map((h: any) => h.category)))
      .sort((a: any, b: any) => CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b))
    setAvailableCategories(cats as string[])
    if (cats.length > 0) setCategory(cats[0] as string)
    setLoadingCats(false)
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('rate_adjustments')
      .select('*, destinations(name, code)')
      .order('created_at', { ascending: false })
      .limit(50) as any
    setHistory(data ?? [])
  }

  // Preview: busca todas las rates PC afectadas
  async function handlePreview() {
    if (!destId || !pct || isNaN(parseFloat(pct))) return
    setLoadingPreview(true)
    setPreview([])
    setMessage(null)

    const { data: hotels } = await supabase
      .from('hotels')
      .select('id, name')
      .eq('destination_id', destId)
      .eq('category', category)
      .eq('active', true) as any

    if (!hotels?.length) {
      setMessage({ type: 'error', text: 'No se encontraron hoteles para ese destino y categoría.' })
      setLoadingPreview(false)
      return
    }

    const hotelIds = hotels.map((h: any) => h.id)
    const { data: rates } = await supabase
      .from('rates')
      .select('id, hotel_id, room_base, pc_rate, season')
      .in('hotel_id', hotelIds)
      .eq('season', season)
      .not('pc_rate', 'is', null) as any

    const multiplier = 1 + parseFloat(pct) / 100
    const rows: PreviewRate[] = (rates ?? []).map((r: any) => {
      const hotel = hotels.find((h: any) => h.id === r.hotel_id)
      return {
        rate_id: r.id,
        hotel_id: r.hotel_id,
        hotel_name: hotel?.name ?? '',
        room_base: r.room_base,
        current_pc: r.pc_rate,
        new_pc: Math.round(r.pc_rate * multiplier * 100) / 100,
      }
    }).sort((a: PreviewRate, b: PreviewRate) => a.hotel_name.localeCompare(b.hotel_name))

    setPreview(rows)
    setLoadingPreview(false)
  }

  async function handleApply() {
    if (!preview.length || applying) return
    setApplying(true)
    setMessage(null)

    // Update all rates
    await Promise.all(
      preview.map(r =>
        supabase.from('rates').update({ pc_rate: r.new_pc }).eq('id', r.rate_id)
      )
    )

    // Save to history
    await supabase.from('rate_adjustments').insert({
      destination_id: destId,
      category,
      adjustment_pct: parseFloat(pct),
      applied_by: userId,
      applied_email: userEmail,
      rates_affected: preview.length,
      note: note || null,
    })

    setMessage({ type: 'success', text: `✓ Aplicado. ${preview.length} tarifas PC actualizadas.` })
    setPreview([])
    setPct('')
    setNote('')
    setApplying(false)
    loadHistory()
  }

  const pctNum = parseFloat(pct)
  const isIncrease = pctNum > 0
  const isDecrease = pctNum < 0

  const inputSx: React.CSSProperties = {
    padding: '8px 10px', fontSize: '13px', border: `1px solid ${C.inputBorder}`,
    borderRadius: '7px', fontFamily: font, outline: 'none',
    background: C.input, color: C.text, boxSizing: 'border-box' as const,
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: C.card, border: `0.5px solid ${C.cardBorder}`, borderRadius: '10px', marginBottom: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '9px 16px', borderBottom: `0.5px solid ${C.cardBorder}`, background: C.cardHead }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{title}</span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )

  const Label = ({ t }: { t: string }) => (
    <div style={{ fontSize: '10px', fontWeight: 600, color: C.label, letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: '5px' }}>{t}</div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: font }}>

      {/* SIDEBAR */}
      <aside style={{ width: '188px', minWidth: '188px', background: C.sidebar, borderRight: `0.5px solid ${C.sidebarBorder}`, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px 12px', borderBottom: `0.5px solid ${C.sidebarBorder}` }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>Say Hueque</div>
          <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px' }}>Alojamiento 26-27</div>
        </div>
        <nav style={{ padding: '8px 0', flex: 1 }}>
          <div style={{ padding: '6px 14px 3px', fontSize: '9px', color: C.label, letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontWeight: 600 }}>Navegación</div>
          <Link href="/hoteles" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', fontSize: '12px', color: C.muted, textDecoration: 'none', borderLeft: '2px solid transparent' }}>
            ← Volver al listado
          </Link>
          <a href="/ajustes" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', fontSize: '12px', color: C.text, textDecoration: 'none', borderLeft: `2px solid ${C.sidebarBorder}`, background: C.cardHead, fontWeight: 600 }}>
            ⚙ Ajuste de tarifas
          </a>
        </nav>
        <div style={{ padding: '10px 14px', borderTop: `0.5px solid ${C.sidebarBorder}` }}>
          <div style={{ fontSize: '9px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '11px 24px', borderBottom: `0.5px solid ${C.sidebarBorder}`, background: C.sidebar, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>Ajuste masivo de tarifas PC</span>
          <span style={{ fontSize: '11px', color: C.muted, marginLeft: 'auto' }}>Los cambios afectan solo la tarifa PC, no la NT</span>
        </div>

        {/* Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>

            {/* Formulario */}
            {Section({ title: 'Configurar ajuste', children: (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <Label t="Destino" />
                    <select value={destId} onChange={e => { setDestId(e.target.value); setPreview([]); loadCategories(e.target.value) }} style={{ ...inputSx, width: '100%' }}>
                      <option value="">Seleccionar...</option>
                      {['AR','CL','BR','PE','UY','PY','CO','EC','BO'].map(country => {
                        const dests = destinations.filter(d => d.country === country)
                        if (!dests.length) return null
                        return (
                          <optgroup key={country} label={`${COUNTRY_FLAGS[country] ?? ''} ${country}`}>
                            {dests.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                          </optgroup>
                        )
                      })}
                    </select>
                  </div>
                  <div>
                    <Label t="Categoría" />
                    <select
                      value={category}
                      onChange={e => { setCategory(e.target.value); setPreview([]) }}
                      disabled={!destId || loadingCats}
                      style={{ ...inputSx, width: '100%', opacity: (!destId || loadingCats) ? 0.5 : 1 }}
                    >
                      {!destId && <option value="">Elegí un destino primero</option>}
                      {loadingCats && <option>Cargando...</option>}
                      {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label t="Temporada" />
                    <select value={season} onChange={e => { setSeason(e.target.value); setPreview([]) }} style={{ ...inputSx, width: '100%' }}>
                      {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label t="Ajuste %" />
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number" step="0.1" placeholder="Ej: 10 o -5"
                        value={pct} onChange={e => { setPct(e.target.value); setPreview([]) }}
                        style={{ ...inputSx, width: '100%',
                          color: isIncrease ? C.increase : isDecrease ? C.decrease : C.text,
                          fontWeight: pct ? 600 : 400,
                        }}
                      />
                      {pct && !isNaN(pctNum) && (
                        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: isIncrease ? C.increase : C.decrease, fontWeight: 700 }}>
                          {isIncrease ? '↑' : '↓'}{Math.abs(pctNum)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <Label t="Nota (opcional)" />
                  <input
                    value={note} onChange={e => setNote(e.target.value)}
                    placeholder="Ej: Ajuste temporada alta 2026"
                    style={{ ...inputSx, width: '100%' }}
                  />
                </div>

                <button
                  onClick={handlePreview}
                  disabled={!destId || !pct || isNaN(pctNum) || pctNum === 0 || loadingPreview}
                  style={{ padding: '8px 20px', fontSize: '12px', background: (!destId || !pct) ? '#ccc5bb' : C.btnPrimary, color: '#fff', border: 'none', borderRadius: '7px', cursor: (!destId || !pct) ? 'not-allowed' : 'pointer', fontFamily: font, fontWeight: 600 }}
                >
                  {loadingPreview ? 'Buscando...' : 'Ver preview →'}
                </button>
              </>
            )})}

            {/* Preview */}
            {preview.length > 0 && (
              Section({ title: `Preview — ${preview.length} tarifas a modificar`, children: (
                <>
                  {/* Resumen */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <div style={{ background: isIncrease ? C.increaseBg : C.decreaseBg, borderRadius: '8px', padding: '10px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: isIncrease ? C.increase : C.decrease }}>
                        {isIncrease ? '+' : ''}{pctNum}%
                      </span>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: isIncrease ? C.increase : C.decrease }}>
                          {isIncrease ? 'Aumento' : 'Reducción'}
                        </div>
                        <div style={{ fontSize: '10px', color: C.muted }}>{preview.length} tarifas PC · {season}</div>
                      </div>
                    </div>
                    <div style={{ background: C.cardHead, borderRadius: '8px', padding: '10px 16px' }}>
                      <div style={{ fontSize: '10px', color: C.label, marginBottom: '2px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Destino</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>
                        {destinations.find(d => d.id === destId)?.name} · {category}
                      </div>
                    </div>
                  </div>

                  {/* Tabla preview */}
                  <div style={{ border: `0.5px solid ${C.cardBorder}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px 80px', padding: '6px 12px', background: C.cardHead, borderBottom: `0.5px solid ${C.cardBorder}` }}>
                      {['Hotel', 'Base', 'PC actual', 'PC nueva', 'Diferencia'].map((h, i) => (
                        <div key={i} style={{ fontSize: '9px', fontWeight: 700, color: C.label, letterSpacing: '0.07em', textTransform: 'uppercase' as const, textAlign: i > 1 ? 'right' : 'left' }}>{h}</div>
                      ))}
                    </div>
                    {preview.map((r, i) => {
                      const diff = Math.round((r.new_pc - r.current_pc) * 100) / 100
                      return (
                        <div key={r.rate_id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px 80px', padding: '5px 12px', borderBottom: i < preview.length - 1 ? `0.5px solid ${C.cardBorder}` : 'none', background: i % 2 === 0 ? '#fff' : C.bg, alignItems: 'center' }}>
                          <div style={{ fontSize: '11px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.hotel_name}</div>
                          <div style={{ fontSize: '10px', color: C.muted, fontWeight: 600 }}>{r.room_base}</div>
                          <div style={{ fontSize: '12px', color: C.muted, textAlign: 'right', fontFamily: 'monospace' }}>${r.current_pc}</div>
                          <div style={{ fontSize: '12px', color: C.text, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>${r.new_pc}</div>
                          <div style={{ fontSize: '11px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: diff > 0 ? C.increase : C.decrease }}>
                            {diff > 0 ? '+' : ''}${diff}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {message && (
                    <div style={{ background: message.type === 'success' ? C.successBg : C.errorBg, border: `1px solid ${message.type === 'success' ? C.successBorder : C.errorBorder}`, borderRadius: '7px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: message.type === 'success' ? C.success : C.error }}>
                      {message.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button onClick={handleApply} disabled={applying} style={{ padding: '9px 24px', fontSize: '13px', background: applying ? '#a09080' : C.btnPrimary, color: '#fff', border: 'none', borderRadius: '7px', cursor: applying ? 'not-allowed' : 'pointer', fontFamily: font, fontWeight: 600 }}>
                      {applying ? 'Aplicando...' : `Confirmar y aplicar ${preview.length} cambios`}
                    </button>
                    <button onClick={() => setPreview([])} style={{ padding: '9px 16px', fontSize: '13px', background: 'transparent', color: C.muted, border: `1px solid ${C.inputBorder}`, borderRadius: '7px', cursor: 'pointer', fontFamily: font }}>
                      Cancelar
                    </button>
                  </div>
                </>
              )})
            )}

            {message && !preview.length && (
              <div style={{ background: message.type === 'success' ? C.successBg : C.errorBg, border: `1px solid ${message.type === 'success' ? C.successBorder : C.errorBorder}`, borderRadius: '7px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: message.type === 'success' ? C.success : C.error }}>
                {message.text}
              </div>
            )}

            {/* Historial */}
            {Section({ title: 'Historial de ajustes', children: (
              history.length === 0 ? (
                <div style={{ fontSize: '12px', color: C.label, textAlign: 'center', padding: '20px 0' }}>No hay ajustes registrados todavía</div>
              ) : (
                <div style={{ border: `0.5px solid ${C.cardBorder}`, borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 60px 70px 1fr', padding: '6px 12px', background: C.cardHead, borderBottom: `0.5px solid ${C.cardBorder}` }}>
                    {['Fecha', 'Destino · Categ.', 'Temp.', 'Ajuste', 'Tarifas', 'Operador'].map((h, i) => (
                      <div key={i} style={{ fontSize: '9px', fontWeight: 700, color: C.label, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>{h}</div>
                    ))}
                  </div>
                  {history.map((adj, i) => {
                    const isPos = adj.adjustment_pct > 0
                    const dest = adj.destinations as any
                    const date = new Date(adj.created_at)
                    const dateStr = `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`
                    return (
                      <div key={adj.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 60px 70px 1fr', padding: '7px 12px', borderBottom: i < history.length - 1 ? `0.5px solid ${C.cardBorder}` : 'none', background: i % 2 === 0 ? '#fff' : C.bg, alignItems: 'center' }}>
                        <div style={{ fontSize: '10px', color: C.muted, fontFamily: 'monospace' }}>{dateStr}</div>
                        <div style={{ fontSize: '11px', color: C.text, fontWeight: 500 }}>
                          {dest?.name} ({dest?.code})
                          <span style={{ marginLeft: '6px', fontSize: '10px', color: C.muted }}>· {adj.category}</span>
                          {adj.note && <div style={{ fontSize: '10px', color: C.label, marginTop: '1px' }}>{adj.note}</div>}
                        </div>
                        <div style={{ fontSize: '10px', color: C.muted }}>26-27</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: isPos ? C.increase : C.decrease }}>
                          {isPos ? '+' : ''}{adj.adjustment_pct}%
                        </div>
                        <div style={{ fontSize: '11px', color: C.muted }}>{adj.rates_affected} PC</div>
                        <div style={{ fontSize: '10px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adj.applied_email}</div>
                      </div>
                    )
                  })}
                </div>
              )
            )})}

          </div>
        </div>
      </div>
    </div>
  )
}
