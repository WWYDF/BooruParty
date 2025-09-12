import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/core/authServer";
import { checkPermissions } from "@/components/serverSide/permCheck";
import UserSettingsClient from "@/components/clientSide/Profile/UserSettings";
import { prisma } from '@/core/prisma';
import { setAvatarUrl } from "@/core/reformatProfile";

export default async function ProfileSettingsPage({ searchParams }: { searchParams: Promise<{ as?: string }>; }) {
  const prams = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const impersonatingUser = prams?.as as string | undefined;
  let user;

  const cookie = (await headers()).get("cookie") || "";

  // Impersonating another user
  if (impersonatingUser && impersonatingUser !== session.user.username) {
    const perms = await checkPermissions(["profile_edit_others"]);
    if (!perms["profile_edit_others"]) notFound();

    const sensUser = await prisma.user.findUnique({
      where: { username: impersonatingUser },
      select: {
        id: true,
        username: true,
        email: true,
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
            }
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

    if (!sensUser) notFound();

    user = {
      ...sensUser,
      avatar: setAvatarUrl(sensUser.avatar)
    };

  } else {
    // Viewing own profile
    const res = await fetch(`${process.env.NEXTAUTH_URL}/api/users/self`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (!res.ok) notFound();
    user = await res.json();
  }

  if (!user) {
    redirect(`/profile`);
    return;
  }

  return <UserSettingsClient user={user} impersonating={user.username !== session.user.username} />;
}