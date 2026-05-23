import type { Metadata } from 'next';

import { AuthFragmentHandler } from '@/components/auth-fragment-handler';
import { NavBar } from '@/components/nav-bar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Longform',
  description: 'Discovery and reading lists for long-form articles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthFragmentHandler />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
