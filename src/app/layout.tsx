import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Providers } from '@/components/providers';
import './globals.css';
export const metadata: Metadata = { title: 'Immich Sorter', description: 'Review photo and video dates, places, albums and descriptions.' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = (await cookies()).get('language')?.value === 'ru' ? 'ru' : 'en';
  return <html lang={language}><body><Providers initialLanguage={language}>{children}</Providers></body></html>;
}
