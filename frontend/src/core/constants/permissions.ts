// The up-to-date list of permissions
// For the explanation of each, visit https://docs.booru.party/permissions

/**
 * Formatted to Prisma's structure. Use map to destructure.
*/
export const prismaPerms = [
  { name: "post_view" },
  { name: "post_create" },
  { name: "post_create_dupes" },
  { name: "post_edit_own" },
  { name: "post_edit_others" },
  { name: "post_autotag" },
  { name: "post_delete_own" },
  { name: "post_delete_others" },
  { name: "post_feature" },
  { name: "post_vote" },
  { name: "post_favorite" },
  { name: "comment_create" },
  { name: "comment_embed_url" },
  { name: "comment_embed_post" },
  { name: "comment_edit_own" },
  { name: "comment_edit_others" },
  { name: "comment_delete_own" },
  { name: "comment_delete_others" },
  { name: "comment_vote" },
  { name: "pool_create" },
  { name: "pool_manage" },
  { name: "pool_delete" },
  { name: "pool_vote" },
  { name: "profile_create" }, // Registration
  { name: "profile_view" },
  { name: "profile_edit_avatar" },
  { name: "profile_edit_background" },
  { name: "profile_edit_others" }, // Includes editing user's avatar & bg
  { name: "profile_edit_roles" }, // Includes other users
  { name: "profile_archive_others" }, // Delete user but not posts
  { name: "profile_delete_others" },  // Delete user and posts
  { name: "upload_type_image" },
  { name: "upload_type_animated" },
  { name: "upload_type_video" },
  { name: "limit_upload_ignore" }, // Unused currently, though planned
  { name: "tags_create" },
  { name: "tags_edit" },
  { name: "tags_delete" },
  { name: "tags_categories_manage" }, // Create, Edit, and Delete
  { name: "dashboard_view" },
  { name: "dashboard_analytics" },
  { name: "dashboard_update" },
  { name: "dashboard_backups" }, // Export AND Import
  { name: "dashboard_import" }, // Import from other softwares (e.g. szurubooru)
  { name: "dashboard_roles" },
  { name: "dashboard_audit_log" },
  { name: "dashboard_addons" },
  { name: "administrator" },
]