import type { Metadata } from 'next';

import { AuthFragmentHandler } from '@/components/auth-fragment-handler';
import { NavBar } from '@/components/nav-bar';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const SITE_DESCRIPTION =
  'A high-signal library of essays, trip reports, and literary nonfiction. Save what you mean to read. Build lists. Follow people whose taste you trust.';

export const metadata: Metadata = {
  title: { default: 'Longform', template: '%s · Longform' },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: 'Longform',
    description: SITE_DESCRIPTION,
    type: 'website',
    siteName: 'Longform',
  },
  twitter: { card: 'summary_large_image', title: 'Longform', description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AuthFragmentHandler />
          <NavBar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
