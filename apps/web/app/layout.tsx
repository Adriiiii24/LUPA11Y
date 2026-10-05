import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { PALETTE } from '@/components/palette';
import { siteUrl } from '@/lib/site';
import './globals.css';

/** Geist para leer y titular; Geist Mono para lo que el motor mide o el usuario copia. */
const sans = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

const title = 'LupA11y · Auditoría de accesibilidad que pulsa Tab';
const description =
  'Agentic Accessibility Auditing: Deterministic Precision meets Visual Intelligence. LupA11y audita una URL con axe-core, el reflujo a 320 px, un agente que la recorre con el teclado y Gemini Vision.';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title,
  description,
  applicationName: 'LupA11y',
  authors: [{ name: 'Adrián Martínez Panés' }],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'es_ES', siteName: 'LupA11y', title, description, url: '/' },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport: Viewport = {
  themeColor: PALETTE.bg,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
