import { cookies } from "next/headers";

export async function checkPermissions(permission: string): Promise<boolean> {
  // Shortcut: allow all if permission is posts_view and GUEST_VIEWING is enabled
  if (permission === 'posts_view' && process.env.GUEST_VIEWING === 'true') {
    return true;
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

  if (!res.ok) return false;

  const data = await res.json();
  const permissions = Array.isArray(data.permissions) ? data.permissions : [];

  return permissions.includes(permission) || permissions.includes('administrator');
}
