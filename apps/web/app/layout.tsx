import type { Metadata } from 'next';
import { Bagel_Fat_One, Inter, Spectral } from 'next/font/google';

import { AuthFragmentHandler } from '@/components/auth-fragment-handler';
import { NavBar } from '@/components/nav-bar';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/toast';
import './globals.css';

// See DESIGN.md §4 for the rationale on these three faces.
const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const bagelFatOne = Bagel_Fat_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bagel',
  display: 'swap',
});

const SITE_DESCRIPTION =
  'Zola is a discovery surface for long-form essays, reporting, and criticism. Save what you mean to read, build lists, follow taste you trust.';

export const metadata: Metadata = {
  title: { default: 'Zola', template: '%s · Zola' },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: 'Zola',
    description: SITE_DESCRIPTION,
    type: 'website',
    siteName: 'Zola',
  },
  twitter: { card: 'summary_large_image', title: 'Zola', description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spectral.variable} ${inter.variable} ${bagelFatOne.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ToastProvider>
            <AuthFragmentHandler />
            <NavBar />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
