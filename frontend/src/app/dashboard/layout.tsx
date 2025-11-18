import { ReactNode } from "react";
import { DashNav } from "@/components/clientSide/Dashboard/DashNav";
import { Metadata } from "next";

const site_name = process.env.NEXT_PUBLIC_SITE_NAME || 'https://example.com'

export const metadata: Metadata = {
  title: {
    default: `Dashboard`,
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

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full h-full min-h-[90vh] rounded-2xl shadow-lg bg-secondary flex flex-col p-6">
        <DashNav />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}