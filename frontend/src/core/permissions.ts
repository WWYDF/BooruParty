'use client';

import { getSession } from 'next-auth/react';

// Client Side Component/Page -> This
export async function checkPermissions(
  perms: string | string[]
): Promise<Record<string, boolean>> {
  const permissions = Array.isArray(perms) ? perms : [perms];

  try {
    const session = await getSession();
    const userPerms = session?.user?.permissions ?? [];
    const hasAdmin = userPerms.includes("administrator");

    return Object.fromEntries(
      permissions.map((p) => [p, hasAdmin || userPerms.includes(p)])
    );
  } catch (err) {
    console.error("checkPermissions error:", err);
    return Object.fromEntries(permissions.map((p) => [p, false]));
  }
}