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
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [defaultDate, setDefaultDate] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const [dateSaved, setDateSaved] = useState(false)

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

  useEffect(() => {
    async function loadDefaultDate() {
      const supabase = createClient()
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_view_date')
        .single() as any
      if (data?.value) setDefaultDate(data.value)
    }
    loadDefaultDate()
  }, [])

  async function saveDefaultDate() {
    if (!defaultDate) return
    setSavingDate(true)
    setDateSaved(false)
    const supabase = createClient()
    await supabase.from('app_settings')
      .upsert({ key: 'default_view_date', value: defaultDate, updated_at: new Date().toISOString() })
    setSavingDate(false)
    setDateSaved(true)
    setTimeout(() => setDateSaved(false), 3000)
  }

  async function handleSyncTP() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-tp-rates', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setSyncResult({ ok: true, msg: `✓ Sync OK — ${data.suppliers ?? data.hotels_matched ?? 0} proveedores · ${data.nt_rows ?? data.rates_updated ?? 0} NT · ${data.pc_rows ?? 0} PC` })
      } else {
        setSyncResult({ ok: false, msg: `Error: ${data.error}` })
      }
    } catch (e: any) {
      setSyncResult({ ok: false, msg: `Error de red: ${e.message}` })
    }
    setSyncing(false)
  }

  useEffect(() => {
    if (!destId) { setAvailableCategories([]); return }
    setLoadingCats(true)
    supabase
      .from('hotels')
      .select('category')
      .eq('destination_id', destId)
      .eq('active', true)
      .then(({ data }) => {
        const cats = Array.from(new Set((data ?? []).map((h: any) => h.category)))
          .filter(c => CATEGORIES.includes(c))
          .sort((a, b) => CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b))
        setAvailableCategories(cats as string[])
        if (cats.length && !cats.includes(category)) setCategory(cats[0] as string)
        setLoadingCats(false)
      })
  }, [destId])

  async function loadHistory() {
    const { data } = await supabase
      .from('rate_adjustments')
      .select('*, destinations(name, code)')
      .order('created_at', { ascending: false })
      .limit(50) as any
    setHistory(data ?? [])
  }

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

    await Promise.all(
      preview.map(r =>
        supabase.from('rates').update({ pc_rate: r.new_pc }).eq('id', r.rate_id)
      )
    )

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

            {/* Sync TourPlan */}
            <div style={{ background: C.card, border: `0.5px solid ${C.cardBorder}`, borderRadius: '10px', marginBottom: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '9px 16px', borderBottom: `0.5px solid ${C.cardBorder}`, background: C.cardHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Sync TourPlan — Tarifas NT y PC</span>
                <span style={{ fontSize: '9px', color: C.label }}>Automático: todos los días 6am UTC</span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ marginBottom: '12px', fontSize: '12px', color: C.muted, lineHeight: '1.5' }}>
                  El sync conecta directamente con TourPlan y actualiza todas las tarifas NT (netas) y PC (precio categoría) automáticamente.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const }}>
                  <button
                    onClick={handleSyncTP}
                    disabled={syncing}
                    style={{
                      padding: '8px 20px', fontSize: '12px', fontWeight: 600, fontFamily: font,
                      background: syncing ? '#a09080' : C.btnPrimary, color: '#fff',
                      border: 'none', borderRadius: '7px', cursor: syncing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {syncing ? 'Sincronizando...' : '⟳ Sync ahora'}
                  </button>
                  {syncResult && (
                    <div style={{
                      fontSize: '12px', padding: '6px 12px', borderRadius: '6px',
                      background: syncResult.ok ? C.successBg : C.errorBg,
                      color: syncResult.ok ? C.success : C.error,
                      border: `1px solid ${syncResult.ok ? C.successBorder : C.errorBorder}`,
                    }}>
                      {syncResult.msg}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fecha por defecto */}
            <div style={{ background: C.card, border: `0.5px solid ${C.cardBorder}`, borderRadius: '10px', marginBottom: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '9px 16px', borderBottom: `0.5px solid ${C.cardBorder}`, background: C.cardHead }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Fecha por defecto (vista hoteles)</span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="date"
                  value={defaultDate}
                  onChange={(e) => setDefaultDate(e.target.value)}
                  style={{ ...inputSx, width: '180px' }}
                />
                <button
                  onClick={saveDefaultDate}
                  disabled={savingDate || !defaultDate}
                  style={{
                    padding: '8px 16px', fontSize: '12px', fontWeight: 600, fontFamily: font,
                    background: savingDate ? '#a09080' : C.btnPrimary, color: '#fff',
                    border: 'none', borderRadius: '7px',
                    cursor: (savingDate || !defaultDate) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingDate ? 'Guardando...' : 'Guardar'}
                </button>
                {dateSaved && (
                  <span style={{ fontSize: '12px', color: C.success }}>✓ Guardado</span>
                )}
              </div>
            </div>

            <Section title="Ajuste porcentual de tarifas PC">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <Label t="Destino" />
                  <select value={destId} onChange={e => setDestId(e.target.value)} style={{ ...inputSx, width: '100%' }}>
                    <option value="">Seleccione destino</option>
                    {destinations.map(d => (
                      <option key={d.id} value={d.id}>
                        {COUNTRY_FLAGS[d.country] ?? ''} {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label t="Categoría" />
                  <select value={category} onChange={e => setCategory(e.target.value)} disabled={!destId || loadingCats} style={{ ...inputSx, width: '100%' }}>
                    {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <Label t="Temporada" />
                  <select value={season} onChange={e => setSeason(e.target.value)} style={{ ...inputSx, width: '100%' }}>
                    {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <Label t="Ajuste %" />
                  <input type="number" step="0.01" value={pct} onChange={e => setPct(e.target.value)} placeholder="ej: 10 o -5" style={{ ...inputSx, width: '100%' }} />
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <Label t="Nota (opcional)" />
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Descripción del ajuste" style={{ ...inputSx, width: '100%' }} />
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={handlePreview}
                  disabled={!destId || !pct || isNaN(pctNum) || loadingPreview}
                  style={{
                    padding: '8px 18px', fontSize: '12px', fontWeight: 600, fontFamily: font,
                    background: (!destId || !pct || loadingPreview) ? '#a09080' : C.btnPrimary,
                    color: '#fff', border: 'none', borderRadius: '7px',
                    cursor: (!destId || !pct || loadingPreview) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingPreview ? 'Calculando...' : 'Vista Previa'}
                </button>
              </div>

              {message && (
                <div style={{
                  marginTop: '12px', fontSize: '12px', padding: '8px 12px', borderRadius: '6px',
                  background: message.type === 'success' ? C.successBg : C.errorBg,
                  color: message.type === 'success' ? C.success : C.error,
                  border: `1px solid ${message.type === 'success' ? C.successBorder : C.errorBorder}`,
                }}>
                  {message.text}
                </div>
              )}
            </Section>

            {preview.length > 0 && (
              <Section title={`Vista Previa — ${preview.length} tarifas afectadas`}>
                <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    background: isIncrease ? C.increaseBg : isDecrease ? C.decreaseBg : C.neutralBg,
                    color: isIncrease ? C.increase : isDecrease ? C.decrease : C.neutral,
                  }}>
                    {isIncrease ? '↑' : isDecrease ? '↓' : '='} {pctNum > 0 ? '+' : ''}{pctNum}%
                  </div>
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    style={{
                      padding: '7px 16px', fontSize: '12px', fontWeight: 600, fontFamily: font,
                      background: applying ? '#a09080' : C.btnPrimary, color: '#fff',
                      border: 'none', borderRadius: '7px', cursor: applying ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {applying ? 'Aplicando...' : 'Aplicar ajuste'}
                  </button>
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', border: `0.5px solid ${C.cardBorder}`, borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead style={{ background: C.cardHead, position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text }}>Hotel</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, color: C.text }}>Base</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: C.text }}>Actual</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: C.text }}>Nueva</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} style={{ borderTop: `0.5px solid ${C.cardBorder}` }}>
                          <td style={{ padding: '8px 10px', color: C.text }}>{r.hotel_name}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: C.muted }}>{r.room_base}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: C.muted }}>${r.current_pc}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: C.text }}>${r.new_pc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            <Section title="Historial de ajustes">
              {history.length === 0 ? (
                <div style={{ fontSize: '12px', color: C.muted, textAlign: 'center', padding: '20px' }}>
                  No hay ajustes registrados
                </div>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: `0.5px solid ${C.cardBorder}`, borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead style={{ background: C.cardHead, position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text }}>Fecha</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text }}>Destino</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text }}>Categoría</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, color: C.text }}>Ajuste</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, color: C.text }}>Afectadas</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: C.text }}>Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((adj, i) => {
                        const isInc = adj.adjustment_pct > 0
                        const isDec = adj.adjustment_pct < 0
                        return (
                          <tr key={i} style={{ borderTop: `0.5px solid ${C.cardBorder}` }}>
                            <td style={{ padding: '8px 10px', color: C.muted }}>
                              {new Date(adj.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '8px 10px', color: C.text }}>{adj.destinations?.name}</td>
                            <td style={{ padding: '8px 10px', color: C.muted }}>{adj.category}</td>
                            <td style={{
                              padding: '8px 10px', textAlign: 'center', fontWeight: 600,
                              color: isInc ? C.increase : isDec ? C.decrease : C.neutral
                            }}>
                              {adj.adjustment_pct > 0 ? '+' : ''}{adj.adjustment_pct}%
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: C.muted }}>{adj.rates_affected}</td>
                            <td style={{ padding: '8px 10px', color: C.muted, fontSize: '10px' }}>{adj.applied_email}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

          </div>
        </div>
      </div>
    </div>
  )
}
