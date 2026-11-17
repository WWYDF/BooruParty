import ComingSoon from "@/components/Dashboard/ComingSoon";

// TODO: needs an audit log table + API (on the roadmap: tag delete/merge first)
export default function AuditLogPage() {
  return (
    <ComingSoon
      title="Audit Log"
      description="The audit log comes back once the new API records moderation actions."
      planned={[
        "Tag deletes and merges (first)",
        "Post deletes, file replacements and edits by others",
        "Role and settings changes",
        "Filter by user, action and date",
      ]}
    />
  );
}
