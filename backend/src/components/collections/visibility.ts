import { Viewer } from "@/core/utilities/viewer";
import { Prisma } from "../../../prisma/client";
import { AccessTokenPayload } from "@/core/plugins/auth";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";

// Who can see a collection (in lists, and its posts through collection:<id>)
//   - the owner: always
//   - everyone else: public collections whose owner's account isnt private
//   - admins: can see private-account's public collections, but private collections are completely private

export function visibleCollection(viewer: Viewer): Prisma.PostCollectionWhereInput {
  const shared: Prisma.PostCollectionWhereInput = viewer.canSeePrivate
    ? { isPublic: true }
    : { isPublic: true, owner: { private: false } };

  if (!viewer.userId) return shared; // guests can't own anything
  return { OR: [shared, { ownerId: viewer.userId }] };
}


// The collection this user may edit/delete, as a where clause (null = no perms at all)
// Someone else's collection simply doesn't match -> the route answers 404, public or private alike
export function editableCollection(user: AccessTokenPayload, id: string): Prisma.PostCollectionWhereInput | null {
  if (rolePermissionCheck(user.roleId, 'collections.manage.others')) return { id };
  if (rolePermissionCheck(user.roleId, 'collections.manage.own')) return { id, ownerId: user.sub };
  return null;
}