import { cookies } from "next/headers";
import { updateLastSeen } from "./lastSeen";
import { auth } from "@/core/authServer";

type RoleDominanceOptions = {
  targetIndex?: number; // optional override to avoid role fetch
};

export async function checkPermissions(
  perms: string | string[]
): Promise<Record<string, boolean>> {
  const permissions = Array.isArray(perms) ? perms : [perms];

  // Shortcut: Allow all to view posts if permission is post_view and GUEST_VIEWING is enabled
  if ( permissions.includes("post_view") && process.env.GUEST_VIEWING === "true" ) {
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

  try {
    await updateLastSeen(data.userId);
  } catch {}

  return Object.fromEntries(
    permissions.map((p) => [p, hasAdmin || userPerms.includes(p)])
  );
}

export async function checkRoleDominance(
  targetRoleId: number,
  options?: RoleDominanceOptions
): Promise<boolean> {
  const session = await auth();
  if (!session) return false;

  // 1. Fetch actor's role index
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/${session.user.username}/role`, {
    cache: "no-store",
  });

  if (!res.ok) return false;

  const data = await res.json();
  const actorIndex = data.user.role?.index;
  if (typeof actorIndex !== "number") return false;

  // 2. Use override index if provided
  if (typeof options?.targetIndex === "number") {
    return actorIndex < options.targetIndex;
  }

  // 3. Otherwise, resolve index from roleId
  const roleRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/roles`, {
    cache: "no-store",
  });

  if (!roleRes.ok) return false;

  const roles = await roleRes.json();
  const target = roles.find((r: any) => r.id === targetRoleId);
  if (!target) return false;

  // console.log(`permCheck: ${actorIndex} < ${target.index}: ${actorIndex <= target.index}`);

  // Lower index means more power
  return actorIndex <= target.index;
}