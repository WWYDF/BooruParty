import { FastifyRequest } from "fastify"
import { Prisma, Safety } from "../../../prisma/client"
import { prisma } from "../plugins/prisma"
import { rolePermissionCheck } from "./permissionCache";
import { getServerSettings } from "./settingsCache";
import { HttpError } from "./errors";


// Everything a public route needs to know about who's asking
export type Viewer = {
  userId: string | null,
  roleId: string | null,
  canView: boolean, // may this viewer see posts at all?
  safety: Safety[], // ratings shown when the search doesn't specify any
  safetyIsCap: boolean, // guests: search may arrow this, but never expand it
  canSeePrivate: boolean, // only admins have this for moderation purposes
}

type VisibilityFields = { safety: Safety, uploader: { id: string, private: boolean } };


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

// Same rules GET /:id uses: guests are capped by guestSafety; private uploaders are only visible to themselves + admins
export function isHiddenFrom(viewer: Viewer, post: { safety: Safety, uploader: { id: string, private: boolean } }): boolean {
  const hiddenBySafety = viewer.safetyIsCap && !viewer.safety.includes(post.safety);
  const hiddenByPrivacy = post.uploader.private && !viewer.canSeePrivate && post.uploader.id !== viewer.userId;
  return hiddenBySafety || hiddenByPrivacy;
}

// Viewer for a route that shows posts: throws 401 (guest, guest access off) or 403 (no posts.view)
export async function getBrowsingViewer(req: FastifyRequest): Promise<Viewer> {
  const viewer = await getViewer(req);
  if (!viewer.canView) {
    throw viewer.userId
      ? new HttpError(403, { error: 'Forbidden', hint: 'Missing permission: posts.view' })
      : new HttpError(401, { error: 'Unauthorized', hint: 'Log in to view posts' });
  }
  return viewer;
}

// Throws 404 if the post is missing OR hidden from this viewer (they must look the same).
// After this line TypeScript knows `post` isn't null.
export function assertPostVisible<T extends VisibilityFields>(viewer: Viewer, post: T | null): asserts post is T {
  if (!post || isHiddenFrom(viewer, post)) {
    throw new HttpError(404, { error: 'Not found', hint: 'No post with that id' });
  }
}