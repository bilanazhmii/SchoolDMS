import '../styles/globals.css';

import { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';

import Providers from '../providers/providers';

export const metadata = {
  title: 'SchoolDMS',
  description: 'Enterprise Document Management System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
