import '../styles/globals.css';

import { Analytics } from '@vercel/analytics/next';
import { ReactNode } from 'react';

import Providers from '../providers/providers';

export const metadata = {
  title: 'SchoolDMS',
  description: 'Enterprise Document Management System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
