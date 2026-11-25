export type TagFlag = 'REACTION';

// Implications / suggestions only carry the category id; colors come from /api/tag-categories
export type RelatedTag = { id: number; name: string; categoryId: number };

// GET /api/tags/:name item
export type TagDetail = {
  id: number;
  name: string;
  description: string | null;
  categoryId: number;
  category: { id: number; name: string; color: string; index: number; isDefault: boolean };
  postCount: number;
  flags: TagFlag[];
  aliases: string[];              // other names that resolve to this tag (the main name excluded)
  implications: RelatedTag[];     // direct: adding this tag also adds these
  suggestions: RelatedTag[];
  allImplications: RelatedTag[];  // the full chain (implications of implications)
  matchedAlias: string | null;    // set when the page was opened through an alias
  createdAt: string;
  updatedAt: string;
};

// A tag as the API's tagSummarySelect returns it
export type TagSummary = {
  id: number;
  name: string;
  categoryId: number;
  postCount: number;
  poolCount: number;
};

// GET /api/tag-categories item (only the fields the frontend uses; the list also carries isDefault)
export type CategoryInfo = { id: number; name: string; color: string; index: number };

// The API's tagChipSelect: a tag that renders on its own (favorites, blacklist), no category lookup needed
export type ColoredTag = {
  id: number;
  name: string;
  categoryId: number;
  postCount: number;
  category: { name: string; color: string };
};

// GET /api/me/tags, and what both PUTs return. Sorted by category order, then name.
export type UserTagLists = {
  favorites: ColoredTag[];
  blacklist: ColoredTag[];
  limits: { favorites: number; blacklist: number }; // ServerSettings.maxFavoriteTags / maxBlacklistTags
};

// Marks a category as a well-known kind, whatever its name ("Artists" / "Creators" are both CREATOR)
export type CategoryFlag = 'CREATOR' | 'SUBJECT';

// GET /api/tags item
export type TagResult = {
  id: number;
  name: string;
  postCount: number;
  category: { color: string };
  names?: { name: string }[]; // only the names that matched the search
};