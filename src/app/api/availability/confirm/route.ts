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

  // Buscar pedido por confirm_token
  const { data, error } = await supabase
    .from('availability_requests')
    .select(`
      *,
      hotels ( name, contact_email )
    `)
    .eq('confirm_token', token)
    .single()

  const request = data as any

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
    return new NextResponse(tokenPage('expired', 'Esta consulta expiró. El operador deberá enviar una nueva.'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Actualizar estado
  await supabase
    .from('availability_requests')
    .update({ status: 'confirmed', responded_at: new Date().toISOString() })
    .eq('id', request.id)

  // Notificar al operador
  const html = availabilityResultEmail({
    hotelName: (request.hotels as any).name,
    status: 'confirmed',
    checkIn: new Date(request.check_in),
    checkOut: new Date(request.check_out),
    paxCount: request.pax_count,
    roomBase: request.room_base as 'SGL' | 'DBL' | 'TPL',
    roomCount: request.room_count,
  })

  try {
    await sendMail({
      to: request.operator_email,
      subject: `✓ Disponibilidad confirmada — ${(request.hotels as any).name}`,
      html,
    })
    await supabase
      .from('availability_requests')
      .update({ operator_notified_at: new Date().toISOString() })
      .eq('id', request.id)
  } catch (e) {
    console.error('Error notificando operador:', e)
  }

  return new NextResponse(
    tokenPage('confirmed', `¡Gracias! Confirmaste disponibilidad para las fechas del ${request.check_in} al ${request.check_out}. Ya notificamos al operador.`),
    { headers: { 'Content-Type': 'text/html' } }
  )
}

// Página simple que ve el hotel al hacer click
function tokenPage(type: 'confirmed' | 'error' | 'expired' | 'already', message: string): string {
  const colors: Record<string, string> = {
    confirmed: '#15803d',
    error: '#b91c1c',
    expired: '#b45309',
    already: '#1d4ed8',
  }
  const icons: Record<string, string> = {
    confirmed: '✓',
    error: '✗',
    expired: '⏱',
    already: 'ℹ',
  }
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Say Hueque</title></head>
<body style="margin:0;padding:40px 20px;background:#f4f4f5;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;box-sizing:border-box;">
  <div style="background:#fff;border-radius:10px;padding:48px 40px;max-width:480px;width:100%;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="width:64px;height:64px;border-radius:50%;background:${colors[type]};color:#fff;font-size:28px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">${icons[type]}</div>
    <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Say Hueque</h1>
    <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body></html>`
}
