import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";
import { setAvatarUrl } from "@/core/reformatProfile";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateUserSchema = z.object({
  username: z.string().min(3).max(32).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  description: z.string().max(64).optional(),
  avatar: z.string().url().optional(),
  blurUnsafeEmbeds: z.boolean().optional(),
  defaultSafety: z.array(z.enum(['SAFE', 'SKETCHY', 'UNSAFE'])).optional(),
  blacklistedTags: z.array(z.number()).optional(),
  profileBackground: z.number().optional(),
  privateProfile: z.boolean().optional(),
  favoriteTags: z.array(z.number()).optional(),
});

// Returns non-sensitive information on the user
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      avatar: true,
      description: true,
      lastLogin: true,
      createdAt: true,
      preferences: {
        select: {
          layout: true,
          theme: true,
          postsPerPage: true,
          blurUnsafeEmbeds: true,
          defaultSafety: true,
          blacklistedTags: {
            include: {
              category: true
            }
          },
          favoriteTags: {
            include: {
              category: true
            }
          },
          profileBackground: true,
          private: true,
        }
      },
      _count: {
        select: {
          posts: true,
          comments: true,
          favorites: true,
          votes: {
            where: {
              user: { username }, // Make sure we're only pulling this user's votes.
              type: 'UPVOTE'
            }
          }
        }
      },
      posts: {
        where: { anonymous: false },
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileExt: true,
          score: true,
          createdAt: true
        }
      },
      favorites: {
        select: {
          postId: true,
        },
        orderBy: { createdAt: 'desc' }
      },
      comments: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          postId: true,
          content: true,
          createdAt: true
        }
      },
      role: {
        include: {
          permissions: {
            select: {
              name: true
            }
          }
        }
      }
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // If this is a private account, we don't want to leak info through the public api.
  if (user.preferences?.private == true) {
    const session = await auth();

    if (!session || user.id !== session.user.id) {
      return NextResponse.json({
        error: session ? 403 : 401,
        message: "This account is private."
      }, { status: session ? 403 : 401 });
    }
  }

  return NextResponse.json({
    ...user,
    avatar: setAvatarUrl(user?.avatar)
  });
}



// Edit Profile
export async function PATCH(req: NextRequest, context: { params: Promise<{ username: string }> }) {
  const prams = await context.params;
  const session = await auth();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { username: prams.username },
    select: { id: true, username: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isSelf = session.user.id === targetUser.id;

  const canEditOthers = (await checkPermissions(['profile_edit_others']))['profile_edit_others'];

  if (!isSelf && !canEditOthers) {
    return NextResponse.json({ error: 'You are unauthorized to edit other users.' }, { status: 403 });
  }

  const json = await req.json();
  const parsed = updateUserSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { username, email, description, password, blurUnsafeEmbeds, defaultSafety, blacklistedTags, profileBackground, privateProfile, favoriteTags } = parsed.data;

  const updates: any = {};
  if (username) updates.username = username;
  if (email) updates.email = email;
  updates.description = description;
  if (password) updates.password = await bcrypt.hash(password, 10);

  const prefUpdates: any = {};
  if (typeof blurUnsafeEmbeds !== 'undefined') { prefUpdates.blurUnsafeEmbeds = blurUnsafeEmbeds };
  if (defaultSafety) prefUpdates.defaultSafety = defaultSafety;
  if (blacklistedTags) {
    prefUpdates.blacklistedTags = {
      set: blacklistedTags.map((id) => ({ id }))
    };
  };
  if (favoriteTags) {
    prefUpdates.favoriteTags = {
      set: favoriteTags.map((id) => ({ id }))
    };
  };
  if (profileBackground) {
    if (profileBackground == 0) prefUpdates.profileBackground = null;
    else prefUpdates.profileBackground = profileBackground;
  }
  if (typeof privateProfile !== 'undefined') { prefUpdates.private = privateProfile };

  try {
    const current = await prisma.user.findUnique({
      where: { id: targetUser.id },
      select: { username: true },
    });

    const update = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        ...updates,
        preferences: Object.keys(prefUpdates).length
        ? {
            upsert: {
              update: {
                ...prefUpdates,
                blacklistedTags: undefined, // we handle these after
                favoriteTags: undefined,
              },
              create: {
                ...prefUpdates,
                blacklistedTags: undefined,
                favoriteTags: undefined,
              },
            },
          }
        : undefined,
      },
      include: { preferences: true }
    });

    if (blacklistedTags) {
      await prisma.userPreferences.update({
        where: { id: targetUser.id },
        data: {
          blacklistedTags: {
            set: blacklistedTags.map((id) => ({ id })),
          },
        },
      });
    }

    if (favoriteTags && favoriteTags.length >= 10) {
      await prisma.userPreferences.update({
        where: { id: targetUser.id },
        data: {
          favoriteTags: {
            set: favoriteTags.map((id) => ({ id })),
          },
        },
      });
    }

    const getNew = await prisma.user.findFirst({ where: { id: targetUser.id }, include: { preferences: { include: { blacklistedTags: { include: { category: true }} } } } });

    if (current?.username !== update.username) {
      const forwarded = req.headers.get('x-forwarded-for');
      const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
      await reportAudit(session.user.id, 'UPDATE', 'PROFILE', ip, `Username Change: (${current!.username}) -> (${update.username})`);
    }

    return NextResponse.json({ success: true, profile: getNew!.preferences });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Duplicate entry: username or email already exists' },
        { status: 409 }
      );
    }

    console.error('Update error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}


// Delete User
export async function DELETE(req: NextRequest, context: { params: Promise<{ username: string }> }) {
  const prams = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode"); // "delete" | "transfer"
  
  const targetUser = await prisma.user.findUnique({
    where: { username: prams.username },
    select: { id: true, username: true },
  });
  
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  
  const targetUserId = targetUser.id;

  const isSelfDelete = targetUserId === session.user.id;
  let ip = undefined; // We don't want to log the IPs of users trying to delete their account.

  // If attempting to delete someone else, check permission
  let canArchiveOthers = false;
  let canDeleteOthers = false;
  if (!isSelfDelete) {
    const perms = await checkPermissions([
      'profile_archive_others',
      'profile_delete_others'
    ]);
    
    canArchiveOthers = perms['profile_archive_others'];
    canDeleteOthers = perms['profile_delete_others'];

    const forwarded = req.headers.get("x-forwarded-for");
    ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  }
  
  try {
    // Remove User's Votes on Posts.
    // Step 1: Get all votes by this user
    const votes = await prisma.votes.findMany({
      where: { userId: targetUserId },
      select: {
        postId: true,
        type: true,
      },
    });

    // Step 2: Calculate vote impact per post
    const postScoreMap = new Map<number, number>();

    for (const vote of votes) {
      const delta = vote.type === "UPVOTE" ? -1 : 1; // Reverse effect of vote
      postScoreMap.set(vote.postId, (postScoreMap.get(vote.postId) ?? 0) + delta);
    }

    // Step 3: Update each post’s score
    await Promise.all(
      Array.from(postScoreMap.entries()).map(([postId, delta]) =>
        prisma.posts.update({
          where: { id: postId },
          data: {
            score: {
              increment: delta,
            },
          },
        })
      )
    );


    if (mode === "transfer") {
      if (!isSelfDelete && !canArchiveOthers) { return NextResponse.json({ error: "You lack the required permissions to archive other users' profiles." }, { status: 403 }); }

      // Retain posts: Reassign to system user with id "0" (deleted)
      await prisma.posts.updateMany({
        where: { uploadedById: targetUserId },
        data: { uploadedById: "0" },
      });

      // Report BEFORE deleting the user lol
      await reportAudit(session.user.id, 'ARCHIVE', 'PROFILE', ip, `Target ID: ${targetUserId}, isOwner: ${isSelfDelete}, Executed From: ${session.user.username}`);

      // Move audits relating to them to deleted user.
      await prisma.audits.updateMany({
        where: { userId: targetUserId },
        data: { userId: '0' }
      })

      // Now run delete function (Settings, favorites, likes, etc.)
      await prisma.user.delete({
        where: { id: targetUserId },
      });

    } else { // User wants to delete everything
      if (!isSelfDelete && !canDeleteOthers) { return NextResponse.json({ error: "You lack the required permissions to delete other users' profiles." }, { status: 403 }); }

      // Gather postIds to ask Fastify to purge them
      const postsToDelete = await prisma.posts.findMany({
        where: { uploadedById: targetUserId },
        select: { id: true },
      });

      const postIds = postsToDelete.map((p) => p.id);

      // If there are posts, notify Fastify of them
      if (postIds.length > 0) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/delete/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postIds }),
          });
        } catch (err) {
          console.error("Failed to notify Fastify to delete post files:", err);
        }
      }

      // Report BEFORE deleting the user lol
      await reportAudit(session.user.id, 'DELETE', 'PROFILE', ip, `Target ID: ${targetUserId}, isOwner: ${isSelfDelete}, Executed From: ${session.user.username}`);

      // Move audits relating to them to deleted user.
      await prisma.audits.updateMany({
        where: { userId: targetUserId },
        data: { userId: '0' }
      })

      // Fully cascade delete (Posts, settings, favorites, likes, etc.)
      await prisma.user.delete({
        where: { id: targetUserId },
      });
    }

    // Regardless, ask Fastify to remove their avatar history
    try {
      await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/delete/avatar/${targetUserId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete avatar files from Fastify:", err);
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("User deletion failed:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}