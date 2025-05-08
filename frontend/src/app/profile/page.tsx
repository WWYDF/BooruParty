import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { UserSelf } from "@/core/types/users";
import { auth } from "@/core/authServer";
import { checkPermissions } from "@/components/serverSide/permCheck";
import ProfileSettingsClient from "@/components/clientSide/Profile/Profile";

export default async function ProfileSettingsPage({ searchParams }: { searchParams: Promise<{ as?: string }>; }) {
  const prams = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const impersonatingUser = prams.as;
  let user: UserSelf | null = null;

  const cookie = (await headers()).get("cookie") || "";

  // Impersonating another user
  if (impersonatingUser && impersonatingUser !== session.user.username) {
    const perms = await checkPermissions(["profile_edit_others"]);
    if (!perms["profile_edit_others"]) notFound();

    const res = await fetch(`${process.env.NEXTAUTH_URL}/api/users/${impersonatingUser}`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (!res.ok) notFound();
    user = await res.json();
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

  return <ProfileSettingsClient user={user} impersonating={user.username !== session.user.username} />;
}