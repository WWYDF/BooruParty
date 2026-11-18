import { Metadata } from 'next';

const site_name = process.env.NEXT_PUBLIC_SITE_NAME || 'https://example.com'

export const metadata: Metadata = {
  title: {
    default: `Pools`,
    template: `%s | ${site_name}`
  },
  description: `Browse comics, series and collections on ${site_name}.`,
  icons: { // Favicon
   icon: '/i/party.png'
  },
  openGraph: {  // The preview image for Discord, Twitter, etc.
    images: []
  },
}

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return children;
}