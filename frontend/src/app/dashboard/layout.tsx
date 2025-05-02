import { ReactNode } from "react";
import { DashNav } from "@/components/clientSide/Dashboard/DashNav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full h-full min-h-[90vh] rounded-2xl shadow-lg bg-secondary flex flex-col p-6">
        <DashNav />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}