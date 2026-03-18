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

  if (confirming) return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
      <span style={{ fontSize:'11px', color:'#b91c1c' }}>¿Eliminar?</span>
      <button onClick={handleDelete} disabled={loading} style={{ background:'#fee2e2', color:'#b91c1c', border:'0.5px solid #fca5a5', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>
        {loading ? 'Eliminando...' : 'Confirmar'}
      </button>
      <button onClick={() => setConfirming(false)} style={{ background:'#f5f0eb', color:'#8c7d72', border:'0.5px solid #e2ddd6', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>
        Cancelar
      </button>
    </div>
  )

  return (
    <button onClick={() => setConfirming(true)} style={{ background:'transparent', color:'#b91c1c', border:'0.5px solid #fca5a5', borderRadius:'6px', padding:'5px 12px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>
      Eliminar
    </button>
  )
}
