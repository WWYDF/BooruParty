import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { Metadata } from 'next';
import AuthProvider from '@/components/clientSide/AuthProvider';
import Navbar from '@/components/clientSide/Navbar';
import { ToastProvider } from '@/components/clientSide/Toast';
import Footer from '@/components/clientSide/Footer';

const inter = Inter({ subsets: ['latin'] });
const site_name = process.env.SITE_NAME || 'https://example.com'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'),
  title: {
    default: `Home | ${site_name}`,
    template: `%s | ${site_name}`
  },
  description: "A Modern Imageboard written with NextJS & Fastify.",
  icons: { // Favicon
   icon: '/i/party.png'
  },
  openGraph: {  // The preview image for Discord, Twitter, etc.
    images: []
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
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <AuthProvider>
          <Navbar />
          <ToastProvider>
            <main className="flex-grow">
              {children}
            </main>
          </ToastProvider>
        </AuthProvider>
        <Footer />
      </body>
    </html>
  )
}