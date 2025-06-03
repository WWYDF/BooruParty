import AnalyticsOverview from "@/components/clientSide/Dashboard/AnalyticsBox";
import DatabaseBackup from "@/components/clientSide/Dashboard/Backup";
import UpdaterBox from "@/components/clientSide/Dashboard/Updater";

export default function AdminDashboard() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        {/* Analytics Component */}
        <AnalyticsOverview />
      </div>

      <div className="space-y-4">
        {/* Updater Component */}
        <UpdaterBox />
        <DatabaseBackup />
      </div>
    </div>
  );
}
