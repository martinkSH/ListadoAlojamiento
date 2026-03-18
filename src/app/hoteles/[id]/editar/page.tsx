'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Inn/Apart', 'Inn', 'Inn/Comfort', 'Comfort', 'Superior', 'Superior+', 'Luxury', 'Estancia sup', 'Estancia lux', 'Otros']
const CURRENCIES = ['OFICIAL', 'USD', 'MEP', 'DOLAR', 'ARS', 'PESOS', 'BLUE', 'BNA', 'EUR', 'CLP', 'DOLAR TURISTA', 'BLE', '-']
const BASES = ['SGL', 'DBL', 'TPL']
const SEASONS = ['26-27', '24-25']

export default function EditarHotelPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [destinations, setDestinations] = useState<any[]>([])

  const [form, setForm] = useState<any>({
    destination_id: '', name: '', category: 'Inn', currency: 'OFICIAL',
    distance_center: '', contact_email: '', contact_name: '', contact_phone: '',
    closing_date: '', net_rate_validity: '', pc_rate_validity: '',
    is_family: false, family_type: '', is_direct: true, platform_name: '',
    notes: '', season_open: '',
  })

  // rates[base][season] = { pc, nt, id }
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
        supabase.from('hotels').select('*, rates(id, room_base, pc_rate, net_rate, season)').eq('id', params.id).single() as any,
        supabase.from('destinations').select('id, code, name, country').eq('active', true).order('name') as any,
      ])

      if (!hotel) { router.push('/hoteles'); return }

      setDestinations(dests ?? [])
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

      // Load rates
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
    setRates(r => ({
      ...r,
      [base]: { ...r[base], [season]: { ...r[base][season], [field]: value } }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    // Update hotel
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

    if (hotelErr) {
      setError('Error al guardar: ' + hotelErr.message)
      setSaving(false)
      return
    }

    // Upsert rates
    for (const base of BASES) {
      for (const season of SEASONS) {
        const { pc, nt, id } = rates[base][season]
        const pcVal = pc !== '' ? parseFloat(pc) : null
        const ntVal = nt !== '' ? parseFloat(nt) : null

        if (pcVal === null && ntVal === null) {
          // If there was a rate, delete it
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

  const label = (text: string) => (
    <div style={{ fontSize: '9px', fontWeight: 700, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{text}</div>
  )

  const inputStyle = { width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #e0e0d8', borderRadius: '6px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fafaf8' }
  const selectStyle = { ...inputStyle }

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0ec', background: '#fafaf8' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )

  const grid2 = (children: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>{children}</div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', color: '#aaa', fontSize: '12px' }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f6', fontFamily: "'DM Mono', 'Courier New', monospace" }}>

      {/* Header */}
      <div style={{ background: '#1a1a1a', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '11px' }}>← Volver</button>
        <span style={{ color: '#333' }}>|</span>
        <span style={{ color: '#aaa', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
          Editando: {form.name}
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 20px' }}>

        {section('Identificación', <>
          <div style={{ marginBottom: '12px' }}>
            {label('Destino')}
            <select value={form.destination_id} onChange={e => setField('destination_id', e.target.value)} style={selectStyle}>
              {['AR','CL','BR','PE','UY','PY','CO','EC','BO'].map(country => {
                const dests = destinations.filter(d => d.country === country)
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
            {label('Nombre completo *')}
            <input value={form.name} onChange={e => setField('name', e.target.value)} required style={inputStyle} />
          </div>
          {grid2(<>
            <div>
              {label('Categoría')}
              <select value={form.category} onChange={e => setField('category', e.target.value)} style={selectStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              {label('Moneda')}
              <select value={form.currency} onChange={e => setField('currency', e.target.value)} style={selectStyle}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>)}
        </>)}

        {section('Tarifas', <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '9px', color: '#888', fontWeight: 700, width: '50px' }}>BASE</th>
                {SEASONS.flatMap(s => [
                  <th key={`${s}-pc`} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '9px', color: '#1a1a1a', fontWeight: 700 }}>PC {s}</th>,
                  <th key={`${s}-nt`} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '9px', color: '#9ca3af', fontWeight: 700 }}>NT {s}</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {BASES.map(base => (
                <tr key={base} style={{ borderTop: '1px solid #f0f0ec' }}>
                  <td style={{ padding: '6px 4px', fontWeight: 700, color: '#555', fontSize: '11px' }}>{base}</td>
                  {SEASONS.flatMap(season => [
                    <td key={`${base}-${season}-pc`} style={{ padding: '4px' }}>
                      <input
                        type="number" step="0.01" min="0"
                        value={rates[base][season].pc}
                        onChange={e => setRate(base, season, 'pc', e.target.value)}
                        placeholder="—"
                        style={{ width: '90px', padding: '5px 6px', fontSize: '12px', border: '1px solid #e0e0d8', borderRadius: '4px', fontFamily: 'inherit', textAlign: 'right', background: '#fafaf8' }}
                      />
                    </td>,
                    <td key={`${base}-${season}-nt`} style={{ padding: '4px' }}>
                      <input
                        type="number" step="0.01" min="0"
                        value={rates[base][season].nt}
                        onChange={e => setRate(base, season, 'nt', e.target.value)}
                        placeholder="—"
                        style={{ width: '90px', padding: '5px 6px', fontSize: '12px', border: '1px solid #e0e0d8', borderRadius: '4px', fontFamily: 'inherit', textAlign: 'right', background: '#fafaf8' }}
                      />
                    </td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </>)}

        {section('Contacto', <>
          {grid2(<>
            <div>
              {label('Email de contacto')}
              <input type="email" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} style={inputStyle} placeholder="reservas@hotel.com" />
            </div>
            <div>
              {label('Nombre contacto')}
              <input value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} style={inputStyle} />
            </div>
          </>)}
          <div style={{ marginTop: '12px' }}>
            {label('Teléfono')}
            <input value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} style={inputStyle} />
          </div>
        </>)}

        {section('Logística', <>
          {grid2(<>
            <div>
              {label('Distancia al centro')}
              <input value={form.distance_center} onChange={e => setField('distance_center', e.target.value)} style={inputStyle} placeholder="Ej: 5 min, En el centro" />
            </div>
            <div>
              {label('Temporada abierta')}
              <input value={form.season_open} onChange={e => setField('season_open', e.target.value)} style={inputStyle} placeholder="Abierto todo el año" />
            </div>
          </>)}
          <div style={{ marginTop: '12px' }}>
            {label('Fecha de cierre')}
            <input type="date" value={form.closing_date} onChange={e => setField('closing_date', e.target.value)} style={{ ...inputStyle, width: '200px' }} />
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_family} onChange={e => setField('is_family', e.target.checked)} />
              Hotel Family
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_direct} onChange={e => setField('is_direct', e.target.checked)} />
              Contrato directo
            </label>
          </div>
          {!form.is_direct && (
            <div style={{ marginTop: '12px' }}>
              {label('Nombre de plataforma')}
              <input value={form.platform_name} onChange={e => setField('platform_name', e.target.value)} style={inputStyle} placeholder="Ej: Senderos Nativos" />
            </div>
          )}
        </>)}

        {section('Vigencias', <>
          {grid2(<>
            <div>
              {label('Vigencia tarifa neta')}
              <input type="date" value={form.net_rate_validity} onChange={e => setField('net_rate_validity', e.target.value)} style={inputStyle} />
            </div>
            <div>
              {label('Vigencia tarifa PC')}
              <input type="date" value={form.pc_rate_validity} onChange={e => setField('pc_rate_validity', e.target.value)} style={inputStyle} />
            </div>
          </>)}
        </>)}

        {section('Notas internas', <>
          <textarea
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #e0e0d8', borderRadius: '6px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#fafaf8' }}
          />
        </>)}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#15803d' }}>
            ✓ Guardado correctamente. Volviendo...
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} style={{ padding: '9px 20px', fontSize: '12px', border: '1px solid #e0e0d8', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} style={{ padding: '9px 24px', fontSize: '12px', background: saving ? '#555' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
