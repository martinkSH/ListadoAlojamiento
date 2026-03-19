'use client'

import { useState, useEffect } from 'react'
import { HotelTagEditor, type HotelTag } from '@/components/hotels/HotelTags'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Inn/Apart', 'Inn', 'Inn/Comfort', 'Comfort', 'Superior', 'Superior+', 'Luxury', 'Estancia sup', 'Estancia lux', 'Otros']
const CURRENCIES = ['OFICIAL', 'USD', 'MEP', 'DOLAR', 'ARS', 'PESOS', 'BLUE', 'BNA', 'EUR', 'CLP', 'DOLAR TURISTA', 'BLE', '-']
const BASES = ['SGL', 'DBL', 'TPL']

const C = {
  bg: '#f5f0ea', headerBg: '#ede6dd', headerBorder: '#d4cbbf',
  cardBg: '#ffffff', cardBorder: '#ddd5cb', cardHeadBg: '#f5f0ea',
  labelColor: '#9a8d82', textDark: '#2c2420', textMid: '#7a6e65',
  inputBg: '#faf7f3', inputBorder: '#ccc5bb', btnPrimary: '#4a3f35',
  errorBg: '#fef2f2', errorBorder: '#fca5a5', errorText: '#b91c1c',
  successBg: '#f0fdf4', successBorder: '#86efac', successText: '#15803d',
  warnBg: '#fffbeb', warnBorder: '#fcd34d', warnText: '#92400e',
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

  // TourPlan
  const [tourplanCode, setTourplanCode] = useState('')
  const [tpOptions, setTpOptions] = useState<string[]>([])
  const [mappedOption, setMappedOption] = useState('')
  const [loadingTp, setLoadingTp] = useState(false)
  const [mappingId, setMappingId] = useState<string | null>(null)

  const [form, setForm] = useState<any>({
    destination_id: '', name: '', category: 'Inn', currency: 'OFICIAL',
    distance_center: '', contact_email: '', contact_name: '', contact_phone: '',
    net_rate_validity: '', is_family: false, is_direct: true, platform_name: '',
    notes: '', season_open: '', closing_info: '',
  })

  const [rates, setRates] = useState<Record<string, { pc: string; nt: string; id?: string }>>({
    SGL: { pc: '', nt: '' }, DBL: { pc: '', nt: '' }, TPL: { pc: '', nt: '' },
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: hotel }, { data: dests }, { data: mapping }] = await Promise.all([
        supabase.from('hotels').select('*, rates(id,room_base,pc_rate,net_rate,season), hotel_tags(id,tag_type,tag_value,tag_link)').eq('id', params.id).single() as any,
        supabase.from('destinations').select('id,code,name,country').eq('active', true).order('name') as any,
        supabase.from('hotel_tp_room_map').select('id,option_desc').eq('hotel_id', params.id).single() as any,
      ])

      if (!hotel) { router.push('/hoteles'); return }

      setDestinations(dests ?? [])
      setHotelName(hotel.name ?? '')
      setInitialTags(hotel.hotel_tags ?? [])

      const code = hotel.tourplan_code ?? ''
      setTourplanCode(code)

      if (mapping) {
        setMappedOption(mapping.option_desc ?? '')
        setMappingId(mapping.id)
      }

      setForm({
        destination_id: hotel.destination_id ?? '',
        name: hotel.name ?? '',
        category: hotel.category ?? 'Inn',
        currency: hotel.currency ?? 'OFICIAL',
        distance_center: hotel.distance_center ?? '',
        contact_email: hotel.contact_email ?? '',
        contact_name: hotel.contact_name ?? '',
        contact_phone: hotel.contact_phone ?? '',
        net_rate_validity: hotel.net_rate_validity ?? '',
        is_family: hotel.is_family ?? false,
        is_direct: hotel.is_direct ?? true,
        platform_name: hotel.platform_name ?? '',
        notes: hotel.notes ?? '',
        season_open: hotel.season_open ?? '',
        closing_info: hotel.closing_info ?? '',
      })

      const newRates = { SGL: { pc: '', nt: '' }, DBL: { pc: '', nt: '' }, TPL: { pc: '', nt: '' } } as any
      for (const rate of (hotel.rates ?? [])) {
        if (rate.season === '26-27' && newRates[rate.room_base]) {
          newRates[rate.room_base] = {
            pc: rate.pc_rate != null ? String(rate.pc_rate) : '',
            nt: rate.net_rate != null ? String(rate.net_rate) : '',
            id: rate.id,
          }
        }
      }
      setRates(newRates)

      if (code) await loadTpOptions(code)
      setLoading(false)
    }
    load()
  }, [params.id])

  async function loadTpOptions(code: string) {
    if (!code.trim()) { setTpOptions([]); return }
    setLoadingTp(true)
    const { data } = await supabase
      .from('tp_rates')
      .select('option_desc')
      .eq('supplier_code', parseInt(code))
      .not('option_desc', 'is', null) as any
    const unique: string[] = []
    for (const r of (data ?? [])) {
      if (r.option_desc && !unique.includes(r.option_desc)) unique.push(r.option_desc)
    }
    setTpOptions(unique.sort())
    setLoadingTp(false)
  }

  function setField(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }))
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
      net_rate_validity: form.net_rate_validity || null,
      is_family: form.is_family,
      is_direct: form.is_direct,
      platform_name: form.is_direct ? null : (form.platform_name || null),
      notes: form.notes || null,
      season_open: form.season_open || null,
      closing_info: form.closing_info || null,
      tourplan_code: tourplanCode || null,
    }).eq('id', params.id) as any

    if (hotelErr) { setError('Error al guardar: ' + hotelErr.message); setSaving(false); return }

    // Save rates 26-27
    for (const base of BASES) {
      const { pc, nt, id } = rates[base]
      const pcVal = pc !== '' ? parseFloat(pc) : null
      const ntVal = nt !== '' ? parseFloat(nt) : null
      if (pcVal === null && ntVal === null) {
        if (id) await supabase.from('rates').delete().eq('id', id)
        continue
      }
      if (id) {
        await supabase.from('rates').update({ pc_rate: pcVal, net_rate: ntVal }).eq('id', id)
      } else {
        await supabase.from('rates').insert({ hotel_id: params.id, season: '26-27', room_base: base, pc_rate: pcVal, net_rate: ntVal })
      }
    }

    // Save room mapping
    if (mappedOption) {
      if (mappingId) {
        await supabase.from('hotel_tp_room_map').update({ option_desc: mappedOption }).eq('id', mappingId)
      } else {
        const { data: newMap } = await supabase.from('hotel_tp_room_map')
          .insert({ hotel_id: params.id, option_desc: mappedOption })
          .select('id').single() as any
        if (newMap) setMappingId(newMap.id)
      }
    } else if (mappingId) {
      await supabase.from('hotel_tp_room_map').delete().eq('id', mappingId)
      setMappingId(null)
    }

    setSuccess(true)
    setTimeout(() => router.push(`/hoteles/${params.id}`), 1000)
  }

  const Label = ({ text }: { text: string }) => (
    <div style={{ fontSize: '10px', fontWeight: 600, color: C.labelColor, letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: '5px' }}>{text}</div>
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
        <span style={{ fontSize: '10px', fontWeight: 700, color: C.textMid, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{title}</span>
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
            <div style={{ fontSize: '10px', color: C.labelColor, marginTop: '3px' }}>
              Incluí el tipo de habitación entre paréntesis. Ej: "Arc Recoleta (Superior)"
            </div>
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

        <Section title="TourPlan">
          <Grid2>
            <div>
              <Label text="Código de proveedor TP" />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={tourplanCode}
                  onChange={e => setTourplanCode(e.target.value)}
                  placeholder="Ej: 128"
                  style={{ ...inputSx }}
                />
                <button
                  type="button"
                  onClick={() => loadTpOptions(tourplanCode)}
                  disabled={loadingTp || !tourplanCode}
                  style={{ padding: '8px 12px', fontSize: '12px', border: `1px solid ${C.inputBorder}`, borderRadius: '7px', background: '#fff', cursor: 'pointer', fontFamily: font, color: C.textMid, whiteSpace: 'nowrap' as const }}
                >
                  {loadingTp ? '...' : 'Buscar'}
                </button>
              </div>
            </div>
            <div>
              <Label text="Habitación del listado (mapeo)" />
              {tpOptions.length > 0 ? (
                <select value={mappedOption} onChange={e => setMappedOption(e.target.value)} style={inputSx}>
                  <option value="">— Sin mapeo —</option>
                  {tpOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <div style={{ padding: '8px 10px', fontSize: '12px', border: `1px solid ${C.inputBorder}`, borderRadius: '7px', background: C.inputBg, color: C.labelColor }}>
                  {tourplanCode ? (loadingTp ? 'Buscando...' : 'Presioná Buscar para ver habitaciones') : 'Ingresá el código TP primero'}
                </div>
              )}
              {!mappedOption && tourplanCode && tpOptions.length > 0 && (
                <div style={{ fontSize: '10px', color: C.warnText, marginTop: '4px', background: C.warnBg, padding: '4px 8px', borderRadius: '4px', border: `1px solid ${C.warnBorder}` }}>
                  ⚠ Sin mapeo — las tarifas NT no se mostrarán en el listado
                </div>
              )}
              {mappedOption && (
                <div style={{ fontSize: '10px', color: C.successText, marginTop: '4px' }}>✓ {mappedOption}</div>
              )}
            </div>
          </Grid2>
        </Section>

        <Section title="Tarifas 26-27">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: C.cardHeadBg }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', color: C.labelColor, fontWeight: 700, width: '50px' }}>BASE</th>
                <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', color: C.textDark, fontWeight: 700 }}>PC</th>
                <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', color: C.labelColor, fontWeight: 700 }}>NT (referencia)</th>
              </tr>
            </thead>
            <tbody>
              {BASES.map((base, bi) => (
                <tr key={base} style={{ borderTop: `0.5px solid ${C.cardBorder}`, background: bi % 2 === 0 ? '#fff' : C.cardHeadBg }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: C.textMid }}>{base}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <input type="number" step="0.01" min="0"
                      value={rates[base].pc}
                      onChange={e => setRates(r => ({ ...r, [base]: { ...r[base], pc: e.target.value } }))}
                      placeholder="—"
                      style={{ width: '100px', padding: '6px 8px', fontSize: '12px', border: `1px solid ${C.inputBorder}`, borderRadius: '6px', fontFamily: font, textAlign: 'right', background: C.inputBg, color: C.textDark, outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <input type="number" step="0.01" min="0"
                      value={rates[base].nt}
                      onChange={e => setRates(r => ({ ...r, [base]: { ...r[base], nt: e.target.value } }))}
                      placeholder="Auto desde TP"
                      style={{ width: '130px', padding: '6px 8px', fontSize: '12px', border: `1px solid ${C.inputBorder}`, borderRadius: '6px', fontFamily: font, textAlign: 'right', background: '#f0f0f0', color: C.labelColor, outline: 'none' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '10px', color: C.labelColor, marginTop: '8px' }}>
            La NT se actualiza automáticamente desde TourPlan con el sync semanal. Solo editá si querés forzar un valor.
          </div>
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
            <Label text="Fecha / período de cierre" />
            <input value={form.closing_info} onChange={e => setField('closing_info', e.target.value)} placeholder="Ej: Cerrado del 01/05 al 31/08" style={{ ...inputSx }} />
          </div>
          <div style={{ marginTop: '14px', display: 'flex', gap: '20px', flexWrap: 'wrap' as const }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: C.textMid, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_family} onChange={e => setField('is_family', e.target.checked)} /> Hotel Family
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: C.textMid, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_direct} onChange={e => setField('is_direct', e.target.checked)} /> Contrato directo
            </label>
          </div>
          {!form.is_direct && (
            <div style={{ marginTop: '12px' }}>
              <Label text="Nombre de plataforma" />
              <input value={form.platform_name} onChange={e => setField('platform_name', e.target.value)} style={inputSx} />
            </div>
          )}
        </Section>

        <Section title="Vigencias">
          <div>
            <Label text="Vigencia tarifa neta" />
            <input type="date" value={form.net_rate_validity} onChange={e => setField('net_rate_validity', e.target.value)} style={{ ...inputSx, width: '200px' }} />
          </div>
        </Section>

        <Section title="Etiquetas">
          <HotelTagEditor hotelId={params.id} initialTags={initialTags} />
        </Section>

        <Section title="Notas internas">
          <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3}
            style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: `1px solid ${C.inputBorder}`, borderRadius: '7px', fontFamily: font, resize: 'vertical', boxSizing: 'border-box', background: C.inputBg, color: C.textDark, outline: 'none' }}
          />
        </Section>

        {error && <div style={{ background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '7px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: C.errorText }}>{error}</div>}
        {success && <div style={{ background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: '7px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: C.successText }}>✓ Guardado correctamente. Volviendo...</div>}

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
