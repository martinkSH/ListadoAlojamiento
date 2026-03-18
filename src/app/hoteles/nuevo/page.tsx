'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Inn/Apart', 'Inn', 'Inn/Comfort', 'Comfort', 'Superior', 'Superior+', 'Luxury', 'Estancia sup', 'Estancia lux', 'Otros']
const CURRENCIES = ['OFICIAL', 'USD', 'MEP', 'DOLAR', 'ARS', 'PESOS', 'BLUE', 'BNA', 'EUR', 'CLP']
const BASES = ['SGL', 'DBL', 'TPL']
const SEASONS = ['26-27', '24-25']

type Destination = { id: string; code: string; name: string; country: string }

export default function NuevoHotelPage() {
  const router = useRouter()
  const supabase = createClient()

  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    destination_id: '',
    name: '',
    category: 'Inn',
    currency: 'OFICIAL',
    distance_center: '',
    contact_email: '',
    contact_name: '',
    contact_phone: '',
    closing_date: '',
    net_rate_validity: '',
    pc_rate_validity: '',
    is_family: false,
    family_type: '',
    is_direct: true,
    platform_name: '',
    notes: '',
  })

  const [rates, setRates] = useState<Record<string, Record<string, string>>>({
    'SGL': { '26-27': '', '24-25': '', 'nt_26-27': '', 'nt_24-25': '' },
    'DBL': { '26-27': '', '24-25': '', 'nt_26-27': '', 'nt_24-25': '' },
    'TPL': { '26-27': '', '24-25': '', 'nt_26-27': '', 'nt_24-25': '' },
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/login')
      const { data } = await supabase.from('destinations').select('id, code, name, country').eq('active', true).order('country').order('name')
      setDestinations((data ?? []) as Destination[])
    }
    load()
  }, [])

  function setField(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setRate(base: string, key: string, value: string) {
    setRates(r => ({ ...r, [base]: { ...r[base], [key]: value } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.destination_id) { setError('Seleccioná un destino'); return }
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }

    setLoading(true)

    // Get max priority for this destination + category
    const { data: existing } = await supabase
      .from('hotels')
      .select('priority')
      .eq('destination_id', form.destination_id)
      .eq('category', form.category)
      .order('priority', { ascending: false })
      .limit(1) as any

    const nextPriority = existing?.[0]?.priority ? existing[0].priority + 1 : 1

    const { data: hotel, error: hotelErr } = await supabase
      .from('hotels')
      .insert({
        destination_id: form.destination_id,
        name: form.name.trim(),
        category: form.category,
        currency: form.currency,
        priority: nextPriority,
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
        active: true,
      })
      .select()
      .single() as any

    if (hotelErr || !hotel) {
      setError('Error al crear el hotel: ' + (hotelErr?.message ?? 'desconocido'))
      setLoading(false)
      return
    }

    // Insert rates
    const rateRows: any[] = []
    for (const base of BASES) {
      for (const season of SEASONS) {
        const pc = parseFloat(rates[base][season])
        const nt = parseFloat(rates[base][`nt_${season}`])
        if (!isNaN(pc) || !isNaN(nt)) {
          rateRows.push({
            hotel_id: hotel.id,
            season,
            room_base: base,
            pc_rate: isNaN(pc) ? null : pc,
            net_rate: isNaN(nt) ? null : nt,
          })
        }
      }
    }

    if (rateRows.length > 0) {
      await supabase.from('rates').insert(rateRows)
    }

    setSuccess(true)
    setTimeout(() => router.push(`/hoteles/${hotel.id}`), 1200)
  }

  const label = (text: string) => (
    <div style={{ fontSize: '9px', fontWeight: 700, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{text}</div>
  )

  const input = (props: any) => (
    <input {...props} style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #e0e0d8', borderRadius: '6px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fafaf8', ...props.style }} />
  )

  const select = (props: any, children: React.ReactNode) => (
    <select {...props} style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #e0e0d8', borderRadius: '6px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fafaf8', ...props.style }}>
      {children}
    </select>
  )

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

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f6', fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      {/* Header */}
      <div style={{ background: '#1a1a1a', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '11px' }}>← Volver</button>
        <span style={{ color: '#333' }}>|</span>
        <span style={{ color: '#aaa', fontSize: '11px' }}>Nuevo hotel</span>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 20px' }}>

        {section('Identificación', <>
          <div style={{ marginBottom: '12px' }}>
            {label('Destino *')}
            {select({ value: form.destination_id, onChange: (e: any) => setField('destination_id', e.target.value), required: true },
              <>
                <option value="">Seleccionar destino...</option>
                {['AR','CL','BR','PE','UY','PY','CO','EC','BO'].map(country => {
                  const dests = destinations.filter(d => d.country === country)
                  if (!dests.length) return null
                  return (
                    <optgroup key={country} label={country}>
                      {dests.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                    </optgroup>
                  )
                })}
              </>
            )}
          </div>
          <div style={{ marginBottom: '12px' }}>
            {label('Nombre completo del hotel *')}
            {input({ value: form.name, onChange: (e: any) => setField('name', e.target.value), placeholder: 'Ej: Dazzler Palermo (Classic) - FREE SALE', required: true })}
          </div>
          {grid2(<>
            <div>
              {label('Categoría')}
              {select({ value: form.category, onChange: (e: any) => setField('category', e.target.value) },
                CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)
              )}
            </div>
            <div>
              {label('Moneda')}
              {select({ value: form.currency, onChange: (e: any) => setField('currency', e.target.value) },
                CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)
              )}
            </div>
          </>)}
        </>)}

        {section('Contacto', <>
          {grid2(<>
            <div>
              {label('Email de contacto')}
              {input({ type: 'email', value: form.contact_email, onChange: (e: any) => setField('contact_email', e.target.value), placeholder: 'reservas@hotel.com' })}
            </div>
            <div>
              {label('Nombre contacto')}
              {input({ value: form.contact_name, onChange: (e: any) => setField('contact_name', e.target.value) })}
            </div>
          </>)}
          <div style={{ marginTop: '12px' }}>
            {label('Teléfono')}
            {input({ value: form.contact_phone, onChange: (e: any) => setField('contact_phone', e.target.value) })}
          </div>
        </>)}

        {section('Logística', <>
          {grid2(<>
            <div>
              {label('Distancia al centro')}
              {input({ value: form.distance_center, onChange: (e: any) => setField('distance_center', e.target.value), placeholder: 'Ej: 5 min, En el centro' })}
            </div>
            <div>
              {label('Fecha de cierre')}
              {input({ type: 'date', value: form.closing_date, onChange: (e: any) => setField('closing_date', e.target.value) })}
            </div>
          </>)}
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
              {input({ value: form.platform_name, onChange: (e: any) => setField('platform_name', e.target.value), placeholder: 'Ej: Senderos Nativos' })}
            </div>
          )}
        </>)}

        {section('Vigencias', <>
          {grid2(<>
            <div>
              {label('Vigencia tarifa neta')}
              {input({ type: 'date', value: form.net_rate_validity, onChange: (e: any) => setField('net_rate_validity', e.target.value) })}
            </div>
            <div>
              {label('Vigencia tarifa PC')}
              {input({ type: 'date', value: form.pc_rate_validity, onChange: (e: any) => setField('pc_rate_validity', e.target.value) })}
            </div>
          </>)}
        </>)}

        {section('Tarifas', <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '9px', color: '#888', fontWeight: 700 }}>BASE</th>
                {SEASONS.flatMap(s => [
                  <th key={`${s}-pc`} style={{ padding: '6px 8px', textAlign: 'center', fontSize: '9px', color: '#1a1a1a', fontWeight: 700 }}>PC {s}</th>,
                  <th key={`${s}-nt`} style={{ padding: '6px 8px', textAlign: 'center', fontSize: '9px', color: '#9ca3af', fontWeight: 700 }}>NT {s}</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {BASES.map(base => (
                <tr key={base} style={{ borderTop: '1px solid #f0f0ec' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#555' }}>{base}</td>
                  {SEASONS.flatMap(season => [
                    <td key={`${base}-${season}-pc`} style={{ padding: '4px 8px' }}>
                      <input
                        type="number" step="0.01" min="0"
                        value={rates[base][season]}
                        onChange={e => setRate(base, season, e.target.value)}
                        placeholder="—"
                        style={{ width: '80px', padding: '5px 6px', fontSize: '11px', border: '1px solid #e0e0d8', borderRadius: '4px', fontFamily: 'inherit', textAlign: 'right', background: '#fafaf8' }}
                      />
                    </td>,
                    <td key={`${base}-${season}-nt`} style={{ padding: '4px 8px' }}>
                      <input
                        type="number" step="0.01" min="0"
                        value={rates[base][`nt_${season}`]}
                        onChange={e => setRate(base, `nt_${season}`, e.target.value)}
                        placeholder="—"
                        style={{ width: '80px', padding: '5px 6px', fontSize: '11px', border: '1px solid #e0e0d8', borderRadius: '4px', fontFamily: 'inherit', textAlign: 'right', background: '#fafaf8' }}
                      />
                    </td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </>)}

        {section('Notas', <>
          <textarea
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            placeholder="Notas internas sobre el hotel..."
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
            ✓ Hotel creado correctamente. Redirigiendo...
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} style={{ padding: '9px 20px', fontSize: '12px', border: '1px solid #e0e0d8', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading} style={{ padding: '9px 24px', fontSize: '12px', background: loading ? '#555' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Guardando...' : 'Crear hotel'}
          </button>
        </div>

      </form>
    </div>
  )
}
