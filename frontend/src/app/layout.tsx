import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'App',
  description: 'auranest-app-template',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
