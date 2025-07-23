import UploadQueue from "@/components/clientSide/Uploads/UploadQueue";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { Metadata } from "next";

const site_name = process.env.NEXT_PUBLIC_SITE_NAME || 'https://example.com'

export const metadata: Metadata = {
  title: {
    default: `Upload`,
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

export default async function UploadPage() {
  const canUpload = (await checkPermissions(['post_create']))['post_create'];
  const canDupe = (await checkPermissions(['post_create_dupes']))['post_create_dupes'];

  if (!canUpload) { 
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-red-400">
        <h1 className="text-3xl font-bold mb-2">Unauthorized</h1>
        <p className="text-base text-subtle max-w-md">Sorry, but you are not allowed to create posts.</p>
      </main>
    );
  }

  return (
    <div className="p-8">
      <UploadQueue canDupe={canDupe} />
    </div>
  )
}