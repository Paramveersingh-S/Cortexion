import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cortexion — Connected Vehicle Intelligence',
  description: 'Real-time V2V safety mesh dashboard with OBD diagnostics, LoRa communication, and camera-free cabin sensing.',
  keywords: ['V2V', 'vehicle intelligence', 'LoRa', 'OBD-II', 'WiFi CSI', 'IoT', 'connected vehicle'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
