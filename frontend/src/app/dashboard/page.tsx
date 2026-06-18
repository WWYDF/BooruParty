import AnalyticsOverview from "@/components/clientSide/Dashboard/AnalyticsBox";
import DatabaseBackup from "@/components/clientSide/Dashboard/Backup";
import BoostCooldown from "@/components/clientSide/Dashboard/BoostCooldown";
import IntegrityCheck from "@/components/clientSide/Dashboard/IntegrityCheck";
import PermissionSync from "@/components/clientSide/Dashboard/UpdatePerms";
import UpdaterBox from "@/components/clientSide/Dashboard/Updater";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";

export default async function AdminDashboard() {

  const perms = await checkPermissions([
    'dashboard_view',
    'dashboard_analytics',
    'dashboard_update',
    'dashboard_backups',
    'dashboard_checks',
    'administrator'
  ]);

  const settings = await prisma.siteSettings.findFirst();

  const canViewDashboard = perms['dashboard_view'];
  const canViewAnalytics = perms['dashboard_analytics'];
  const canUpdateSite = perms['dashboard_update'];
  const canBackupDatabase = perms['dashboard_backups'];
  const canRunChecks = perms['dashboard_checks'];
  const isAdmin = perms['administrator'];

  // Hide page if user lacks base perm or all widget perms.
  if (!canViewDashboard || !canViewAnalytics && !canUpdateSite && !canBackupDatabase && !canRunChecks) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-red-400">
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-base text-subtle max-w-md">You lack the proper permissions to view this page.</p>
      </main>
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        {/* Analytics Component */}
        {canViewAnalytics && (
          <AnalyticsOverview />
        )}
      </div>

      <div className="space-y-4">
        {/* Updater Component */}
        {canUpdateSite && (
          <UpdaterBox />
        )}

        {/* Perms Component */}
        {canUpdateSite && (
          <PermissionSync />
        )}

        {/* Backup Component */}
        {canBackupDatabase && (
          <DatabaseBackup />
        )}

        {/* Integrity Component */}
        {canRunChecks && (
          <IntegrityCheck />
        )}

        {/* Boost Cooldown Component */}
        {isAdmin && (
          <BoostCooldown initialValue={settings?.boostCooldown ?? 86400} />
        )}
      </div>
    </div>
  );
}
