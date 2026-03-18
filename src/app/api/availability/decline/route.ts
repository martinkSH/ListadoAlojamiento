import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/gmail/client'
import { availabilityResultEmail } from '@/lib/emails/availability'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return new NextResponse('Token inválido', { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: request, error } = await supabase
    .from('availability_requests')
    .select('*, hotels ( name )')
    .eq('decline_token', token)
    .single() as any

  if (error || !request) {
    return new NextResponse(tokenPage('error', 'El link no es válido o ya fue usado.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (request.status !== 'pending') {
    return new NextResponse(tokenPage('already', 'Esta consulta ya fue respondida. ¡Gracias!'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (new Date(request.expires_at) < new Date()) {
    return new NextResponse(tokenPage('expired', 'Esta consulta expiró.'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  await supabase
    .from('availability_requests')
    .update({ status: 'unavailable', responded_at: new Date().toISOString() })
    .eq('id', request.id) as any

  const html = availabilityResultEmail({
    hotelName: request.hotels?.name ?? '',
    status: 'unavailable',
    checkIn: new Date(request.check_in),
    checkOut: new Date(request.check_out),
    paxCount: request.pax_count,
    roomBase: request.room_base as 'SGL' | 'DBL' | 'TPL',
    roomCount: request.room_count,
  })

  try {
    await sendMail({
      to: request.operator_email,
      subject: `✗ Sin disponibilidad — ${request.hotels?.name}`,
      html,
    })
    await supabase
      .from('availability_requests')
      .update({ operator_notified_at: new Date().toISOString() })
      .eq('id', request.id) as any
  } catch (e) {
    console.error('Error notificando operador:', e)
  }

  return new NextResponse(
    tokenPage('declined', 'Gracias por informarnos. Ya notificamos al operador que no hay disponibilidad.'),
    { headers: { 'Content-Type': 'text/html' } }
  )
}

function tokenPage(type: 'declined' | 'error' | 'expired' | 'already', message: string): string {
  const colors: Record<string, string> = {
    declined: '#b91c1c', error: '#6b7280', expired: '#b45309', already: '#1d4ed8',
  }
  const icons: Record<string, string> = {
    declined: '✗', error: '!', expired: '⏱', already: 'ℹ',
  }
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Say Hueque</title></head>
<body style="margin:0;padding:40px 20px;background:#f4f4f5;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;box-sizing:border-box;">
  <div style="background:#fff;border-radius:10px;padding:48px 40px;max-width:480px;width:100%;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="width:64px;height:64px;border-radius:50%;background:${colors[type]};color:#fff;font-size:28px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">${icons[type]}</div>
    <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Say Hueque</h1>
    <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body></html>`
}
