import ImportSoftwares from "@/components/clientSide/Dashboard/Importer/ImportPage";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";

export default async function Page() {
  const hasPerms = (await checkPermissions(['dashboard_import']))['dashboard_import'];

  if (!hasPerms) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-red-400">
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-base text-subtle max-w-md">You lack the proper permissions to view this page.</p>
      </main>
    );
  }

  const sessions = await prisma.importSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return <ImportSoftwares previous={sessions} />;
}
