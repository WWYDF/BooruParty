import { ReactNode } from "react";
import { Metadata } from "next";
import DashboardGate from "@/components/Dashboard/DashboardGate";

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
    <div className="flex min-h-screen items-center justify-center px-4 py-6 md:px-6">
      <div className="flex min-h-[90vh] w-full flex-col rounded-2xl border border-secondary-border bg-secondary p-6 shadow-lg">
        <DashboardGate>{children}</DashboardGate>
      </div>
    </div>
  );
}
