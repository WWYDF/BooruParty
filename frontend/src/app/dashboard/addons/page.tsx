import ComingSoon from "@/components/Dashboard/ComingSoon";

// TODO: needs an addons/settings API (autotagger URL + mode, jigsaw, artist tools)
export default function AddonsPage() {
  return (
    <ComingSoon
      title="Addons"
      description="Addon settings are being rebuilt for the new API."
      planned={[
        "Autotagger: server URL and when it runs",
        "Jigsaw game on image posts",
        "Artist tools",
      ]}
    />
  );
}
