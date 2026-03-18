'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DeleteHotelButton({ hotelId, hotelName }: { hotelId: string; hotelName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    setLoading(true)
    await supabase.from('rates').delete().eq('hotel_id', hotelId)
    await supabase.from('promotions').delete().eq('hotel_id', hotelId)
    await supabase.from('availability_requests').delete().eq('hotel_id', hotelId)
    await supabase.from('hotels').delete().eq('id', hotelId)
    router.push('/hoteles')
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', color: '#ef4444' }}>¿Eliminar "{hotelName.slice(0, 30)}..."?</span>
        <button onClick={handleDelete} disabled={loading} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
          {loading ? 'Eliminando...' : 'Confirmar'}
        </button>
        <button onClick={() => setConfirming(false)} style={{ background: '#2a2a2a', color: '#aaa', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef444433', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', cursor: 'pointer' }}>
      Eliminar
    </button>
  )
}
