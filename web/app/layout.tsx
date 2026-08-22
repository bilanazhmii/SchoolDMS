import type { Metadata } from 'next';
import { ReactNode } from 'react';

import Providers from '../providers/providers';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SchoolDMS',
    template: '%s | SchoolDMS',
  },
  description: 'Secure document management and multi-device synchronization for schools.',
  applicationName: 'SchoolDMS',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/schooldms-mark.png',
    apple: '/schooldms-mark.png',
  },
  themeColor: '#0b1f3a',
  openGraph: {
    title: 'SchoolDMS',
    description: 'Secure document management and multi-device synchronization for schools.',
    type: 'website',
    siteName: 'SchoolDMS',
    images: [{ url: '/schooldms-mark.png', width: 1920, height: 1920, alt: 'SchoolDMS sync mark' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
