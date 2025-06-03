import '@/styles/globals.css';
import { Metadata } from 'next';
import { prisma } from '@/core/prisma';

const site_name = process.env.NEXT_PUBLIC_SITE_NAME || 'https://example.com'
const totalPools = await prisma.pools.count();

export const metadata: Metadata = {
  title: {
    default: `Pools`,
    template: `%s | ${site_name}`
  },
  description: `Dive into ${totalPools} pools on ${site_name}.`,
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