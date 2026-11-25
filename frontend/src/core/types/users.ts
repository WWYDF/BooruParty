import { Safety } from "./posts"
import { ColoredTag } from "./tags"

// Basic Public Stuff
export type UserSimpleSummary = {
  id: string,
  username: string,
  avatar: string | null,
  about: string | null,
  private: boolean,
  lastSeen: string | null, // like last activity (e.g. "viewing post #33")
  updatedAt: Date,
  createdAt: Date,
  role: {
    name: string,
    color: string,
    index: number,
  }
}

// GET /api/users/:username
export type UserProfile = UserSimpleSummary & {
  preferences: { profileBackground: number | null } | null,
  favoriteTags: ColoredTag[], // by category order, then name; [] for private accounts (unless it's you or an admin)
}

// Private Stuff
export type UserPrivateSummary = UserSimpleSummary & {
  email: string,
  lastLogin: Date,
  permissions: string[],
  boost: BoostState,
}

// GET /api/me's `boost` (also returned by PUT/DELETE /api/posts/:id/boost). Both null = free to boost.
export type BoostState = {
  nextBoostAt: string | null,       // ISO time the cooldown ends
  activeBoostPostId: number | null, // the post whose boost can still be undone (null if it was deleted)
}

// PATCH /api/me/preferences (and GET /api/me's `preferences`)
export type AccountPreferences = {
  blurUnsafeEmbeds: boolean,
  defaultSafety: Safety[],
  profileBackground: number | null,
}

// GET /api/me (the parts the account page uses)
export type AccountDetails = {
  id: string,
  username: string,
  email: string,
  private: boolean,
  avatar: string | null, // URL, null = default avatar
  about: string | null,  // short bio, max 64 chars
  createdAt: string,
  role: { name: string, color: string },
  preferences?: AccountPreferences | null, // null/missing = no row yet, so the server defaults apply
}