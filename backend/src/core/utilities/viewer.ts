import { FastifyRequest } from "fastify"
import { Safety } from "../../../prisma/client"
import { prisma } from "../plugins/prisma"
import { rolePermissionCheck } from "./permissionCache";
import { getServerSettings } from "./settingsCache";


// Everything a public route needs to know about who's asking
export type Viewer = {
  userId: string | null,
  roleId: string | null,
  canView: boolean, // may this viewer see posts at all?
  safety: Safety[], // ratings shown when the search doesn't specify any
  safetyIsCap: boolean, // guests: search may arrow this, but never expand it
  canSeePrivate: boolean, // only admins have this for moderation purposes
}

// Must run after fastify.identify
export async function getViewer(req: FastifyRequest): Promise<Viewer> {
  if (!req.user) {
    const settings = getServerSettings();

    return {
      userId: null,
      roleId: null,
      canView: settings?.guestAccess ?? false,
      safety: settings?.guestSafety ?? [Safety.SAFE],
      safetyIsCap: true,
      canSeePrivate: false,
    };
  };

  const prefs = await prisma.preferences.findUnique({
    where: { userId: req.user.sub },
    select: { defaultSafety: true }
  });

  return {
    userId: req.user.sub,
    roleId: req.user.roleId,
    canView: rolePermissionCheck(req.user.roleId, 'posts.view'),
    safety: prefs?.defaultSafety ?? [Safety.SAFE],
    safetyIsCap: false,
    canSeePrivate: rolePermissionCheck(req.user.roleId, 'administrator'),
  };
}


// The ratings a query should actually return, given what the search asked for (if anything)
export function effectiveSafety(viewer: Viewer, requested?: Safety[]): Safety[] {
  if (!requested || requested.length === 0) return viewer.safety;
  return viewer.safetyIsCap
    ? requested.filter((s) => viewer.safety.includes(s))
    : requested;
}