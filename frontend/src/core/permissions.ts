// Client Side Component/Page -> This
export async function checkPermissions(
  perms: string | string[]
): Promise<Record<string, boolean>> {
  const permissions = Array.isArray(perms) ? perms : [perms];

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/permissions`, { cache: "no-store" });
    if (!res.ok) {
      return Object.fromEntries(permissions.map((p) => [p, false]));
    }

    const data = await res.json();
    const userPerms: string[] = Array.isArray(data.permissions) ? data.permissions : [];

    const hasAdmin = userPerms.includes("administrator");

    return Object.fromEntries(
      permissions.map((p) => [p, hasAdmin || userPerms.includes(p)])
    );
  } catch (err) {
    console.error("checkPermissions error:", err);
    return Object.fromEntries(permissions.map((p) => [p, false]));
  }
}