'use client'

import { useState, useEffect } from 'react'
import { HotelTagEditor, type HotelTag } from '@/components/hotels/HotelTags'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Inn/Apart', 'Inn', 'Inn/Comfort', 'Comfort', 'Superior', 'Superior+', 'Luxury', 'Estancia sup', 'Estancia lux', 'Otros']
const CURRENCIES = ['OFICIAL', 'USD', 'MEP', 'DOLAR', 'ARS', 'PESOS', 'BLUE', 'BNA', 'EUR', 'CLP', 'DOLAR TURISTA', 'BLE', '-']
const BASES = ['SGL', 'DBL', 'TPL']
const SEASONS = ['26-27', '24-25']

const C = {
  bg: '#f5f0ea',
  headerBg: '#ede6dd',
  headerBorder: '#d4cbbf',
  cardBg: '#ffffff',
  cardBorder: '#ddd5cb',
  cardHeadBg: '#f5f0ea',
  labelColor: '#9a8d82',
  textDark: '#2c2420',
  textMid: '#7a6e65',
  inputBg: '#faf7f3',
  inputBorder: '#ccc5bb',
  btnPrimary: '#4a3f35',
  btnPrimaryHover: '#3a2f25',
  errorBg: '#fef2f2',
  errorBorder: '#fca5a5',
  errorText: '#b91c1c',
  successBg: '#f0fdf4',
  successBorder: '#86efac',
  successText: '#15803d',
}

const font = "'Inter','Helvetica Neue',system-ui,sans-serif"

export default function EditarHotelPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [destinations, setDestinations] = useState<any[]>([])
  const [hotelName, setHotelName] = useState('')
  const [initialTags, setInitialTags] = useState<HotelTag[]>([])

  const [form, setForm] = useState<any>({
    destination_id: '', name: '', category: 'Inn', currency: 'OFICIAL',
    distance_center: '', contact_email: '', contact_name: '', contact_phone: '',
    closing_date: '', net_rate_validity: '', pc_rate_validity: '',
    is_family: false, family_type: '', is_direct: true, platform_name: '',
    notes: '', season_open: '',
  })

  const [rates, setRates] = useState<Record<string, Record<string, { pc: string; nt: string; id?: string }>>>({
    SGL: { '26-27': { pc: '', nt: '' }, '24-25': { pc: '', nt: '' } },
    DBL: { '26-27': { pc: '', nt: '' }, '24-25': { pc: '', nt: '' } },
    TPL: { '26-27': { pc: '', nt: '' }, '24-25': { pc: '', nt: '' } },
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: hotel }, { data: dests }] = await Promise.all([
        supabase.from('hotels').select('*, rates(id,room_base,pc_rate,net_rate,season), hotel_tags(id,tag_type,tag_value)').eq('id', params.id).single() as any,
        supabase.from('destinations').select('id,code,name,country').eq('active', true).order('name') as any,
      ])

      if (!hotel) { router.push('/hoteles'); return }

      setDestinations(dests ?? [])
      setHotelName(hotel.name ?? '')
      setInitialTags(hotel.hotel_tags ?? [])
      setForm({
        destination_id: hotel.destination_id ?? '',
        name: hotel.name ?? '',
        category: hotel.category ?? 'Inn',
        currency: hotel.currency ?? 'OFICIAL',
        distance_center: hotel.distance_center ?? '',
        contact_email: hotel.contact_email ?? '',
        contact_name: hotel.contact_name ?? '',
        contact_phone: hotel.contact_phone ?? '',
        closing_date: hotel.closing_date ?? '',
        net_rate_validity: hotel.net_rate_validity ?? '',
        pc_rate_validity: hotel.pc_rate_validity ?? '',
        is_family: hotel.is_family ?? false,
        family_type: hotel.family_type ?? '',
        is_direct: hotel.is_direct ?? true,
        platform_name: hotel.platform_name ?? '',
        notes: hotel.notes ?? '',
        season_open: hotel.season_open ?? '',
      })

      const newRates = {
        SGL: { '26-27': { pc: '', nt: '' }, '24-25': { pc: '', nt: '' } },
        DBL: { '26-27': { pc: '', nt: '' }, '24-25': { pc: '', nt: '' } },
        TPL: { '26-27': { pc: '', nt: '' }, '24-25': { pc: '', nt: '' } },
      } as any

      for (const rate of (hotel.rates ?? [])) {
        if (newRates[rate.room_base]?.[rate.season] !== undefined) {
          newRates[rate.room_base][rate.season] = {
            pc: rate.pc_rate != null ? String(rate.pc_rate) : '',
            nt: rate.net_rate != null ? String(rate.net_rate) : '',
            id: rate.id,
          }
        }
      }
      setRates(newRates)
      setLoading(false)
    }
    load()
  }, [params.id])

  function setField(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }))
  }

  function setRate(base: string, season: string, field: 'pc' | 'nt', value: string) {
    setRates(r => ({ ...r, [base]: { ...r[base], [season]: { ...r[base][season], [field]: value } } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const { error: hotelErr } = await supabase.from('hotels').update({
      destination_id: form.destination_id,
      name: form.name.trim(),
      category: form.category,
      currency: form.currency,
      distance_center: form.distance_center || null,
      contact_email: form.contact_email || null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      closing_date: form.closing_date || null,
      net_rate_validity: form.net_rate_validity || null,
      pc_rate_validity: form.pc_rate_validity || null,
      is_family: form.is_family,
      family_type: form.family_type || null,
      is_direct: form.is_direct,
      platform_name: form.is_direct ? null : (form.platform_name || null),
      notes: form.notes || null,
      season_open: form.season_open || null,
    }).eq('id', params.id) as any

    if (hotelErr) { setError('Error al guardar: ' + hotelErr.message); setSaving(false); return }

    for (const base of BASES) {
      for (const season of SEASONS) {
        const { pc, nt, id } = rates[base][season]
        const pcVal = pc !== '' ? parseFloat(pc) : null
        const ntVal = nt !== '' ? parseFloat(nt) : null
        if (pcVal === null && ntVal === null) {
          if (id) await supabase.from('rates').delete().eq('id', id)
          continue
        }
        if (id) {
          await supabase.from('rates').update({ pc_rate: pcVal, net_rate: ntVal }).eq('id', id)
        } else {
          await supabase.from('rates').insert({ hotel_id: params.id, season, room_base: base, pc_rate: pcVal, net_rate: ntVal })
        }
      }
    }

    setSuccess(true)
    setTimeout(() => router.push(`/hoteles/${params.id}`), 1000)
  }

  // ── Componentes de UI ──────────────────────────────────
  const Label = ({ text }: { text: string }) => (
    <div style={{ fontSize: '10px', fontWeight: 600, color: C.labelColor, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '5px' }}>{text}</div>
  )

  const inputSx: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: '13px',
    border: `1px solid ${C.inputBorder}`, borderRadius: '7px',
    fontFamily: font, outline: 'none', background: C.inputBg,
    color: C.textDark, boxSizing: 'border-box',
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: C.cardBg, border: `0.5px solid ${C.cardBorder}`, borderRadius: '10px', marginBottom: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '9px 16px', borderBottom: `0.5px solid ${C.cardBorder}`, background: C.cardHeadBg }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: C.textMid, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )

  const Grid2 = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>{children}</div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, color: C.labelColor, fontSize: '13px' }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: font }}>

      {/* Header */}
      <div style={{ background: C.headerBg, borderBottom: `0.5px solid ${C.headerBorder}`, padding: '11px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: '12px', fontFamily: font, padding: 0 }}>← Volver</button>
        <span style={{ color: C.headerBorder }}>|</span>
        <span style={{ fontSize: '12px', color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
          Editando: <span style={{ color: C.textDark, fontWeight: 600 }}>{hotelName}</span>
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 20px' }}>

        <Section title="Identificación">
          <div style={{ marginBottom: '12px' }}>
            <Label text="Destino" />
            <select value={form.destination_id} onChange={e => setField('destination_id', e.target.value)} style={inputSx}>
              {['AR','CL','BR','PE','UY','PY','CO','EC','BO'].map(country => {
                const dests = destinations.filter((d: any) => d.country === country)
                if (!dests.length) return null
                return (
                  <optgroup key={country} label={country}>
                    {dests.map((d: any) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                  </optgroup>
                )
              })}
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <Label text="Nombre completo *" />
            <input value={form.name} onChange={e => setField('name', e.target.value)} required style={inputSx} />
          </div>
          <Grid2>
            <div>
              <Label text="Categoría" />
              <select value={form.category} onChange={e => setField('category', e.target.value)} style={inputSx}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label text="Moneda" />
              <select value={form.currency} onChange={e => setField('currency', e.target.value)} style={inputSx}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </Grid2>
        </Section>

        <Section title="Tarifas">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: C.cardHeadBg }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', color: C.labelColor, fontWeight: 700, letterSpacing: '0.06em', width: '50px' }}>BASE</th>
                {SEASONS.flatMap(s => [
                  <th key={`${s}-pc`} style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', color: C.textDark, fontWeight: 700 }}>PC {s}</th>,
                  <th key={`${s}-nt`} style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', color: C.labelColor, fontWeight: 700 }}>NT {s}</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {BASES.map((base, bi) => (
                <tr key={base} style={{ borderTop: `0.5px solid ${C.cardBorder}`, background: bi % 2 === 0 ? '#fff' : C.cardHeadBg }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: C.textMid, fontSize: '12px' }}>{base}</td>
                  {SEASONS.flatMap(season => [
                    <td key={`${base}-${season}-pc`} style={{ padding: '4px 6px' }}>
                      <input type="number" step="0.01" min="0"
                        value={rates[base][season].pc}
                        onChange={e => setRate(base, season, 'pc', e.target.value)}
                        placeholder="—"
                        style={{ width: '90px', padding: '6px 8px', fontSize: '12px', border: `1px solid ${C.inputBorder}`, borderRadius: '6px', fontFamily: font, textAlign: 'right', background: C.inputBg, color: C.textDark, outline: 'none' }}
                      />
                    </td>,
                    <td key={`${base}-${season}-nt`} style={{ padding: '4px 6px' }}>
                      <input type="number" step="0.01" min="0"
                        value={rates[base][season].nt}
                        onChange={e => setRate(base, season, 'nt', e.target.value)}
                        placeholder="—"
                        style={{ width: '90px', padding: '6px 8px', fontSize: '12px', border: `1px solid ${C.inputBorder}`, borderRadius: '6px', fontFamily: font, textAlign: 'right', background: C.inputBg, color: C.textDark, outline: 'none' }}
                      />
                    </td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Contacto">
          <Grid2>
            <div>
              <Label text="Email de contacto" />
              <input type="email" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} style={inputSx} placeholder="reservas@hotel.com" />
            </div>
            <div>
              <Label text="Nombre contacto" />
              <input value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} style={inputSx} />
            </div>
          </Grid2>
          <div style={{ marginTop: '12px' }}>
            <Label text="Teléfono" />
            <input value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} style={inputSx} />
          </div>
        </Section>

        <Section title="Logística">
          <Grid2>
            <div>
              <Label text="Distancia al centro" />
              <input value={form.distance_center} onChange={e => setField('distance_center', e.target.value)} style={inputSx} placeholder="Ej: 5 min, En el centro" />
            </div>
            <div>
              <Label text="Temporada" />
              <input value={form.season_open} onChange={e => setField('season_open', e.target.value)} style={inputSx} placeholder="Abierto todo el año" />
            </div>
          </Grid2>
          <div style={{ marginTop: '12px' }}>
            <Label text="Fecha de cierre" />
            <input type="date" value={form.closing_date} onChange={e => setField('closing_date', e.target.value)} style={{ ...inputSx, width: '200px' }} />
          </div>
          <div style={{ marginTop: '14px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: C.textMid, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_family} onChange={e => setField('is_family', e.target.checked)} />
              Hotel Family
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: C.textMid, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_direct} onChange={e => setField('is_direct', e.target.checked)} />
              Contrato directo
            </label>
          </div>
          {!form.is_direct && (
            <div style={{ marginTop: '12px' }}>
              <Label text="Nombre de plataforma" />
              <input value={form.platform_name} onChange={e => setField('platform_name', e.target.value)} style={inputSx} placeholder="Ej: Senderos Nativos" />
            </div>
          )}
        </Section>

        <Section title="Vigencias">
          <Grid2>
            <div>
              <Label text="Vigencia tarifa neta" />
              <input type="date" value={form.net_rate_validity} onChange={e => setField('net_rate_validity', e.target.value)} style={inputSx} />
            </div>
            <div>
              <Label text="Vigencia tarifa PC" />
              <input type="date" value={form.pc_rate_validity} onChange={e => setField('pc_rate_validity', e.target.value)} style={inputSx} />
            </div>
          </Grid2>
        </Section>

        <Section title="Etiquetas">
          <HotelTagEditor hotelId={params.id} initialTags={initialTags} />
        </Section>

        <Section title="Notas internas">
          <textarea
            value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3}
            style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: `1px solid ${C.inputBorder}`, borderRadius: '7px', fontFamily: font, resize: 'vertical', boxSizing: 'border-box', background: C.inputBg, color: C.textDark, outline: 'none' }}
          />
        </Section>

        {error && (
          <div style={{ background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '7px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: C.errorText }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: '7px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: C.successText }}>
            ✓ Guardado correctamente. Volviendo...
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingBottom: '32px' }}>
          <button type="button" onClick={() => router.back()} style={{ padding: '9px 20px', fontSize: '13px', border: `1px solid ${C.inputBorder}`, borderRadius: '7px', background: '#fff', cursor: 'pointer', fontFamily: font, color: C.textMid }}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} style={{ padding: '9px 24px', fontSize: '13px', background: saving ? '#a09080' : C.btnPrimary, color: '#fff', border: 'none', borderRadius: '7px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: font, fontWeight: 600 }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
