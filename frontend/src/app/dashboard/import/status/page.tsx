import { redirect } from "next/navigation";

// The import progress view comes back with the new importer; until then, show the importer page
export default function ImportStatusPage() {
  redirect("/dashboard/import");
}
