import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface AvailabilityRequestEmailProps {
  hotelName: string
  operatorName: string
  checkIn: Date
  checkOut: Date
  paxCount: number
  roomBase: 'SGL' | 'DBL' | 'TPL'
  roomCount: number
  notes?: string
  confirmUrl: string
  declineUrl: string
}

const roomBaseLabel: Record<string, string> = {
  SGL: 'Single',
  DBL: 'Doble',
  TPL: 'Triple',
}

export function availabilityRequestEmail({
  hotelName,
  operatorName,
  checkIn,
  checkOut,
  paxCount,
  roomBase,
  roomCount,
  notes,
  confirmUrl,
  declineUrl,
}: AvailabilityRequestEmailProps): string {
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
  )
  const fmt = (d: Date) => format(d, "d 'de' MMMM yyyy", { locale: es })

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Consulta de disponibilidad — Say Hueque</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:28px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">
                Say Hueque
              </p>
              <p style="margin:4px 0 0;color:#a0a0b8;font-size:13px;">
                Consulta de disponibilidad
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;">
                Estimado equipo de <strong>${hotelName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                El operador <strong>${operatorName}</strong> de Say Hueque les consulta disponibilidad para la siguiente reserva:
              </p>

              <!-- Detalle -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">Check-in</td>
                        <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:bold;">${fmt(checkIn)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;">Check-out</td>
                        <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:bold;">${fmt(checkOut)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;">Noches</td>
                        <td style="padding:6px 0;color:#111827;font-size:14px;">${nights}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;">Pasajeros</td>
                        <td style="padding:6px 0;color:#111827;font-size:14px;">${paxCount}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;">Habitación</td>
                        <td style="padding:6px 0;color:#111827;font-size:14px;">${roomCount}x ${roomBaseLabel[roomBase]}</td>
                      </tr>
                      ${notes ? `
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;vertical-align:top;">Comentarios</td>
                        <td style="padding:6px 0;color:#111827;font-size:14px;">${notes}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
                Por favor confirmá la disponibilidad haciendo click en uno de estos botones:
              </p>

              <!-- Botones -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 8px 0 0;">
                    <a href="${confirmUrl}"
                       style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:6px;text-decoration:none;width:100%;text-align:center;box-sizing:border-box;">
                      ✓ Disponible
                    </a>
                  </td>
                  <td align="center" style="padding:0 0 0 8px;">
                    <a href="${declineUrl}"
                       style="display:inline-block;background:#dc2626;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:6px;text-decoration:none;width:100%;text-align:center;box-sizing:border-box;">
                      ✗ No disponible
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">
                Esta consulta expira en 7 días. Si tenés alguna duda podés responder directamente a este mail.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Say Hueque — reservas@sayhueque.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

// =============================================
// Mail al OPERADOR con el resultado
// =============================================
interface AvailabilityResultEmailProps {
  hotelName: string
  status: 'confirmed' | 'unavailable'
  checkIn: Date
  checkOut: Date
  paxCount: number
  roomBase: 'SGL' | 'DBL' | 'TPL'
  roomCount: number
}

export function availabilityResultEmail({
  hotelName,
  status,
  checkIn,
  checkOut,
  paxCount,
  roomBase,
  roomCount,
}: AvailabilityResultEmailProps): string {
  const fmt = (d: Date) => format(d, "d 'de' MMMM yyyy", { locale: es })
  const isConfirmed = status === 'confirmed'

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${isConfirmed ? 'Disponibilidad confirmada' : 'Sin disponibilidad'} — Say Hueque</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header con color según resultado -->
          <tr>
            <td style="background:${isConfirmed ? '#15803d' : '#b91c1c'};padding:28px 40px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">
                ${isConfirmed ? '✓ Disponibilidad confirmada' : '✗ Sin disponibilidad'}
              </p>
              <p style="margin:4px 0 0;color:${isConfirmed ? '#bbf7d0' : '#fecaca'};font-size:13px;">
                ${hotelName}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
                ${isConfirmed
                  ? `El hotel confirmó disponibilidad para tu consulta.`
                  : `El hotel informó que <strong>no tiene disponibilidad</strong> para las fechas solicitadas.`
                }
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;color:#6b7280;font-size:13px;width:140px;">Hotel</td>
                        <td style="padding:5px 0;color:#111827;font-size:14px;font-weight:bold;">${hotelName}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#6b7280;font-size:13px;">Check-in</td>
                        <td style="padding:5px 0;color:#111827;font-size:14px;">${fmt(checkIn)}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#6b7280;font-size:13px;">Check-out</td>
                        <td style="padding:5px 0;color:#111827;font-size:14px;">${fmt(checkOut)}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#6b7280;font-size:13px;">Pasajeros</td>
                        <td style="padding:5px 0;color:#111827;font-size:14px;">${paxCount}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#6b7280;font-size:13px;">Habitación</td>
                        <td style="padding:5px 0;color:#111827;font-size:14px;">${roomCount}x ${roomBaseLabel[roomBase]}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Say Hueque · Sistema de alojamiento
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
