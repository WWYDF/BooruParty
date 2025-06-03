import AnalyticsOverview from "@/components/clientSide/Dashboard/AnalyticsBox";

export default function AdminDashboard() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        {/* Analytics Component */}
        <AnalyticsOverview />
      </div>

      <div className="space-y-4">
        {/* Updater Component */}
        {/* <UpdaterBox /> */}
      </div>
    </div>
  );
}
