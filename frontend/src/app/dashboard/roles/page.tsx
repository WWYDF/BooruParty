import ComingSoon from "@/components/Dashboard/ComingSoon";

// TODO: needs a roles API (list/create/edit/reorder roles, set permissions; reload the permission cache after edits)
export default function RolesPage() {
  return (
    <ComingSoon
      title="Roles"
      description="Role management is being rebuilt for the new API."
      planned={[
        "Create, rename, recolor and reorder roles",
        "Pick each role's permissions",
        "Choose the default role for new accounts",
      ]}
    />
  );
}
