import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { Metadata } from 'next';
import AuthProvider from '@/components/clientSide/AuthProvider';
import Navbar from '@/components/clientSide/Navbar';
import { ToastProvider } from '@/components/clientSide/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'),
  title: {
    default: 'Home | Imageboard',
    template: '%s | Imageboard'
  },
  description: "Description.",
  icons: { // Favicon
   icon: '/i/misc/logo.svg'
  },
  openGraph: {  // The preview image for Discord, Twitter, etc.
    images: [
      {
        url: '/i/misc/logo.webp',
        width: 500,
        height: 500
      }
    ]
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body className={inter.className}>
        <Navbar />
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}