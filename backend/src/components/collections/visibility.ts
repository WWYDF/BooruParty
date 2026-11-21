import { Viewer } from "@/core/utilities/viewer";
import { Prisma } from "../../../prisma/client";

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