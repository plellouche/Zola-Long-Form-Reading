import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Longform',
  description: 'Discovery and reading lists for long-form articles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
