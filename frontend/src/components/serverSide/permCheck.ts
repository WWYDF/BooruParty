import { cookies } from "next/headers";

export async function checkPermissions(
  perms: string | string[]
): Promise<Record<string, boolean>> {
  const permissions = Array.isArray(perms) ? perms : [perms];

  // Shortcut: allow all if permission is posts_view and GUEST_VIEWING is enabled
  if (
    permissions.includes("posts_view") &&
    process.env.GUEST_VIEWING === "true"
  ) {
    return Object.fromEntries(permissions.map((p) => [p, true]));
  }

  const cookieStore = cookies();
  const cookieHeader = (await cookieStore).getAll()
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/permissions`, {
    headers: {
      Cookie: cookieHeader,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return Object.fromEntries(permissions.map((p) => [p, false]));
  }

  const data = await res.json();
  const userPerms: string[] = data.permissions ?? [];

  const hasAdmin = userPerms.includes("administrator");

  return Object.fromEntries(
    permissions.map((p) => [p, hasAdmin || userPerms.includes(p)])
  );
}
