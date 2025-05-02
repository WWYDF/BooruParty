import UploadQueue from "@/components/clientSide/Uploads/UploadQueue";
import { checkPermissions } from "@/components/serverSide/permCheck";


export default async function UploadPage() {
  const canUpload = (await checkPermissions(['post_create']))['post_create'];
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
      <UploadQueue />
    </div>
  )
}