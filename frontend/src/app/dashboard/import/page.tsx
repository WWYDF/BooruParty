import ComingSoon from "@/components/Dashboard/ComingSoon";

// TODO: importer rework (see the roadmap: posts keep v0.14 ids, tags re-created via the API, recount counts)
export default function ImportPage() {
  return (
    <ComingSoon
      title="Importer"
      description="The importer is being rebuilt to bring a v0.14 site over with its post ids and files intact."
      planned={[
        "Posts keep their original ids and files (no re-encoding)",
        "Tags, aliases and implications re-created",
        "Post and tag counts recalculated at the end",
        "Progress view while it runs",
      ]}
    />
  );
}
