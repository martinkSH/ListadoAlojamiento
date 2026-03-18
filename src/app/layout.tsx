import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Say Hueque — Alojamiento',
  description: 'Plataforma interna de gestión de alojamiento',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
