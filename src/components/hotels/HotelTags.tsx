'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type HotelTag = {
  id: string
  tag_type: 'new' | 'free_sale' | 'preferred' | 'family' | 'min_nights' | 'custom'
  tag_value: string | null
  tag_link: string | null
}

export const TAG_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new:        { bg: '#dcfce7', text: '#14532d', label: 'NEW' },
  free_sale:  { bg: '#dbeafe', text: '#1e3a8a', label: 'FREE SALE' },
  preferred:  { bg: '#fef3c7', text: '#78350f', label: 'PREFERRED' },
  family:     { bg: '#fce7f3', text: '#831843', label: 'FAMILY' },
  min_nights: { bg: '#ede9fe', text: '#4c1d95', label: 'MIN NTS' },
  custom:     { bg: '#f1f5f9', text: '#334155', label: '' },
}

// ── Render inline tags (para el listado) ─────────────
export function HotelTagBadges({ tags }: { tags: HotelTag[] }) {
  if (!tags?.length) return null
  return (
    <>
      {tags.map(tag => {
        const s = TAG_STYLES[tag.tag_type]
        let label = s.label
        if (tag.tag_type === 'family') label = `F${tag.tag_value ?? '1'}`
        if (tag.tag_type === 'min_nights') label = `MIN ${tag.tag_value} NTS`
        if (tag.tag_type === 'custom') label = tag.tag_value ?? ''
        if (!label) return null

        const badge = (
          <span key={tag.id} style={{
            marginLeft: '5px', fontSize: '9px', fontStyle: 'italic',
            color: s.text, background: s.bg,
            padding: '0 5px', borderRadius: '3px', fontWeight: 500,
            whiteSpace: 'nowrap',
            textDecoration: tag.tag_link ? 'underline' : 'none',
            cursor: tag.tag_link ? 'pointer' : 'default',
          }}>
            {label}{tag.tag_link ? ' ↗' : ''}
          </span>
        )

        if (tag.tag_link) {
          return (
            <a
              key={tag.id}
              href={tag.tag_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ textDecoration: 'none' }}
            >
              {badge}
            </a>
          )
        }
        return badge
      })}
    </>
  )
}

// ── Editor de tags ────────────────────────────────────
const FAMILY_LEVELS = ['F1', 'F2', 'F3']
const MIN_NIGHTS_OPTIONS = ['2', '3', '4', '5', '6', '7']

const font = "'Inter','Helvetica Neue',system-ui,sans-serif"
const C = { text: '#2c2420', muted: '#7a6e65', label: '#9a8d82', inputBorder: '#ccc5bb', input: '#faf7f3' }

export function HotelTagEditor({ hotelId, initialTags }: { hotelId: string; initialTags: HotelTag[] }) {
  const supabase = createClient()
  const [tags, setTags] = useState<HotelTag[]>(initialTags)
  const [saving, setSaving] = useState(false)
  const [freeSaleLink, setFreeSaleLink] = useState(
    initialTags.find(t => t.tag_type === 'free_sale')?.tag_link ?? ''
  )

  const hasTag = (type: string) => tags.find(t => t.tag_type === type)

  async function toggleSimpleTag(type: 'new' | 'preferred') {
    const existing = hasTag(type)
    setSaving(true)
    if (existing) {
      await supabase.from('hotel_tags').delete().eq('id', existing.id)
      setTags(t => t.filter(x => x.id !== existing.id))
    } else {
      const { data } = await supabase.from('hotel_tags')
        .insert({ hotel_id: hotelId, tag_type: type, tag_value: null, tag_link: null })
        .select().single() as any
      if (data) setTags(t => [...t, data])
    }
    setSaving(false)
  }

  async function toggleFreeSale() {
    const existing = hasTag('free_sale')
    setSaving(true)
    if (existing) {
      await supabase.from('hotel_tags').delete().eq('id', existing.id)
      setTags(t => t.filter(x => x.id !== existing.id))
      setFreeSaleLink('')
    } else {
      const { data } = await supabase.from('hotel_tags')
        .insert({ hotel_id: hotelId, tag_type: 'free_sale', tag_value: null, tag_link: freeSaleLink || null })
        .select().single() as any
      if (data) setTags(t => [...t, data])
    }
    setSaving(false)
  }

  async function saveFreeSaleLink(link: string) {
    const existing = hasTag('free_sale')
    if (!existing) return
    setSaving(true)
    await supabase.from('hotel_tags').update({ tag_link: link || null }).eq('id', existing.id)
    setTags(t => t.map(x => x.id === existing.id ? { ...x, tag_link: link || null } : x))
    setSaving(false)
  }

  async function setFamilyTag(level: string | null) {
    const existing = hasTag('family')
    setSaving(true)
    if (existing) {
      if (!level) {
        await supabase.from('hotel_tags').delete().eq('id', existing.id)
        setTags(t => t.filter(x => x.id !== existing.id))
      } else {
        await supabase.from('hotel_tags').update({ tag_value: level }).eq('id', existing.id)
        setTags(t => t.map(x => x.id === existing.id ? { ...x, tag_value: level } : x))
      }
    } else if (level) {
      const { data } = await supabase.from('hotel_tags')
        .insert({ hotel_id: hotelId, tag_type: 'family', tag_value: level, tag_link: null })
        .select().single() as any
      if (data) setTags(t => [...t, data])
    }
    setSaving(false)
  }

  async function setMinNightsTag(nights: string | null) {
    const existing = hasTag('min_nights')
    setSaving(true)
    if (existing) {
      if (!nights) {
        await supabase.from('hotel_tags').delete().eq('id', existing.id)
        setTags(t => t.filter(x => x.id !== existing.id))
      } else {
        await supabase.from('hotel_tags').update({ tag_value: nights }).eq('id', existing.id)
        setTags(t => t.map(x => x.id === existing.id ? { ...x, tag_value: nights } : x))
      }
    } else if (nights) {
      const { data } = await supabase.from('hotel_tags')
        .insert({ hotel_id: hotelId, tag_type: 'min_nights', tag_value: nights, tag_link: null })
        .select().single() as any
      if (data) setTags(t => [...t, data])
    }
    setSaving(false)
  }

  async function setCustomTag(slot: number, value: string) {
    const customTags = tags.filter(t => t.tag_type === 'custom')
    const existing = customTags[slot]
    setSaving(true)
    if (existing) {
      if (!value.trim()) {
        await supabase.from('hotel_tags').delete().eq('id', existing.id)
        setTags(t => t.filter(x => x.id !== existing.id))
      } else {
        await supabase.from('hotel_tags').update({ tag_value: value.trim() }).eq('id', existing.id)
        setTags(t => t.map(x => x.id === existing.id ? { ...x, tag_value: value.trim() } : x))
      }
    } else if (value.trim()) {
      const { data } = await supabase.from('hotel_tags')
        .insert({ hotel_id: hotelId, tag_type: 'custom', tag_value: value.trim(), tag_link: null })
        .select().single() as any
      if (data) setTags(t => [...t, data])
    }
    setSaving(false)
  }

  const customTags = tags.filter(t => t.tag_type === 'custom')
  const familyTag = hasTag('family')
  const minNightsTag = hasTag('min_nights')
  const freeSaleTag = hasTag('free_sale')

  const inputSx: React.CSSProperties = {
    padding: '6px 10px', fontSize: '11px', border: `1px solid ${C.inputBorder}`,
    borderRadius: '6px', fontFamily: font, outline: 'none',
    background: C.input, color: C.text, boxSizing: 'border-box',
  }

  const ToggleBtn = ({ active, color, bg, onClick, children }: any) => (
    <button type="button" onClick={onClick} style={{
      padding: '5px 12px', fontSize: '11px', fontStyle: 'italic', fontWeight: 600,
      border: `1.5px solid ${active ? color : '#ddd5cb'}`,
      borderRadius: '5px', cursor: 'pointer', fontFamily: font,
      background: active ? bg : '#fff',
      color: active ? color : C.muted,
    }}>
      {children}
    </button>
  )

  const SectionLabel = ({ t }: { t: string }) => (
    <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '8px', fontWeight: 600 }}>{t}</div>
  )

  return (
    <div>
      {saving && <div style={{ fontSize: '10px', color: C.muted, marginBottom: '8px' }}>Guardando...</div>}

      {/* Preview */}
      {tags.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '8px 12px', background: '#faf7f3', borderRadius: '7px', border: '0.5px solid #ddd5cb' }}>
          <div style={{ fontSize: '10px', color: C.label, marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Preview</div>
          <span style={{ fontSize: '12px', color: C.text }}>Nombre del hotel</span>
          <HotelTagBadges tags={tags} />
        </div>
      )}

      {/* NEW + PREFERRED */}
      <div style={{ marginBottom: '14px' }}>
        <SectionLabel t="Etiquetas" />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ToggleBtn active={!!hasTag('new')} color={TAG_STYLES.new.text} bg={TAG_STYLES.new.bg} onClick={() => toggleSimpleTag('new')}>NEW</ToggleBtn>
          <ToggleBtn active={!!hasTag('preferred')} color={TAG_STYLES.preferred.text} bg={TAG_STYLES.preferred.bg} onClick={() => toggleSimpleTag('preferred')}>PREFERRED</ToggleBtn>
        </div>
      </div>

      {/* FREE SALE con link */}
      <div style={{ marginBottom: '14px' }}>
        <SectionLabel t="Free Sale" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <ToggleBtn active={!!freeSaleTag} color={TAG_STYLES.free_sale.text} bg={TAG_STYLES.free_sale.bg} onClick={toggleFreeSale}>FREE SALE</ToggleBtn>
          {freeSaleTag && (
            <div style={{ flex: 1, minWidth: '240px' }}>
              <input
                type="url"
                value={freeSaleLink}
                onChange={e => setFreeSaleLink(e.target.value)}
                onBlur={e => saveFreeSaleLink(e.target.value)}
                placeholder="Link a carpeta de Drive con fechas..."
                style={{ ...inputSx, width: '100%' }}
              />
              {freeSaleLink && (
                <a href={freeSaleLink} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '10px', color: TAG_STYLES.free_sale.text, marginTop: '3px', display: 'inline-block' }}>
                  Abrir link ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Family */}
      <div style={{ marginBottom: '14px' }}>
        <SectionLabel t="Family" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ToggleBtn active={false} color={C.muted} bg="#fff" onClick={() => setFamilyTag(null)}>
            <span style={{ fontStyle: 'normal', fontSize: '11px' }}>✕</span>
          </ToggleBtn>
          {FAMILY_LEVELS.map(level => (
            <ToggleBtn key={level} active={familyTag?.tag_value === level} color={TAG_STYLES.family.text} bg={TAG_STYLES.family.bg} onClick={() => setFamilyTag(level)}>{level}</ToggleBtn>
          ))}
        </div>
      </div>

      {/* Min nights */}
      <div style={{ marginBottom: '14px' }}>
        <SectionLabel t="Mínimo de noches" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleBtn active={false} color={C.muted} bg="#fff" onClick={() => setMinNightsTag(null)}>
            <span style={{ fontStyle: 'normal', fontSize: '11px' }}>✕</span>
          </ToggleBtn>
          {MIN_NIGHTS_OPTIONS.map(n => (
            <ToggleBtn key={n} active={minNightsTag?.tag_value === n} color={TAG_STYLES.min_nights.text} bg={TAG_STYLES.min_nights.bg} onClick={() => setMinNightsTag(n)}>MIN {n} NTS</ToggleBtn>
          ))}
        </div>
      </div>

      {/* Custom */}
      <div>
        <SectionLabel t="Etiquetas personalizadas (máx. 2)" />
        <div style={{ display: 'flex', gap: '10px' }}>
          {[0, 1].map(slot => (
            <input key={slot} type="text"
              defaultValue={customTags[slot]?.tag_value ?? ''}
              onBlur={e => setCustomTag(slot, e.target.value)}
              placeholder={`Etiqueta ${slot + 1}...`}
              maxLength={20}
              style={{ ...inputSx, width: '160px', fontStyle: 'italic' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
