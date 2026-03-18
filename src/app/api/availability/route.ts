import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/gmail/client'
import { availabilityRequestEmail } from '@/lib/emails/availability'

const schema = z.object({
  hotelId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paxCount: z.number().int().min(1).max(20),
  roomBase: z.enum(['SGL', 'DBL', 'TPL']),
  roomCount: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  const checkIn = new Date(data.checkIn)
  const checkOut = new Date(data.checkOut)
  if (checkOut <= checkIn) {
    return NextResponse.json({ error: 'Check-out debe ser posterior al check-in' }, { status: 400 })
  }

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .select('id, name, contact_email')
    .eq('id', data.hotelId)
    .eq('active', true)
    .single() as any

  if (hotelError || !hotel) {
    return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 })
  }
  if (!hotel.contact_email) {
    return NextResponse.json({ error: 'El hotel no tiene email de contacto configurado' }, { status: 422 })
  }

  const { data: request, error: insertError } = await supabase
    .from('availability_requests')
    .insert({
      hotel_id: data.hotelId,
      operator_id: user.id,
      operator_email: user.email!,
      operator_name: user.user_metadata?.full_name ?? user.email,
      check_in: data.checkIn,
      check_out: data.checkOut,
      pax_count: data.paxCount,
      room_base: data.roomBase,
      room_count: data.roomCount,
      notes: data.notes,
    })
    .select()
    .single() as any

  if (insertError || !request) {
    return NextResponse.json({ error: 'Error al crear el pedido' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  const confirmUrl = `${baseUrl}/api/availability/confirm?token=${request.confirm_token}`
  const declineUrl = `${baseUrl}/api/availability/decline?token=${request.decline_token}`

  const html = availabilityRequestEmail({
    hotelName: hotel.name,
    operatorName: request.operator_name ?? request.operator_email,
    checkIn,
    checkOut,
    paxCount: data.paxCount,
    roomBase: data.roomBase,
    roomCount: data.roomCount,
    notes: data.notes,
    confirmUrl,
    declineUrl,
  })

  try {
    await sendMail({
      to: hotel.contact_email,
      subject: `Consulta de disponibilidad — ${hotel.name}`,
      html,
    })
    await supabase
      .from('availability_requests')
      .update({ hotel_email_sent_at: new Date().toISOString() })
      .eq('id', request.id) as any
  } catch (mailError) {
    console.error('Error enviando mail:', mailError)
    return NextResponse.json(
      { error: 'Pedido guardado pero hubo un error enviando el mail', requestId: request.id },
      { status: 207 }
    )
  }

  return NextResponse.json({ success: true, requestId: request.id }, { status: 201 })
}
