import { checkPermissions, checkRoleDominance } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

// Changes the role of a user
export async function PATCH(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const prams = await params;
  const { roleId } = await req.json();
  const username = prams.username;

  const hasPerms = (await checkPermissions(['profile_edit_others']))['profile_edit_others'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  if (!roleId || !username) {
    return NextResponse.json({ error: "Missing roleId or username" }, { status: 400 });
  }

  const canApplyTargetRole = await checkRoleDominance(roleId); // Is this user's role 'higher' than that they are trying to assign?
  // console.log(canApplyTargetRole)

  // Can this user access this target role? (e.g. Mods cannot access Admin roles)
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/${username}/role`, {
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "Unable to fetch the target user's current role" }, { status: 403 });
  const pRoles = await res.json();
  const targetUserRoleId = pRoles.user.role?.id;
  const targetUserRolePower = pRoles.user.role?.index;
  const canEditThisUser = await checkRoleDominance(targetUserRoleId, targetUserRolePower); // Is this user's role 'higher' than the role of the person they are trying to modify?
  // console.log(canEditThisUser)

  if (!canEditThisUser || !canApplyTargetRole) { return NextResponse.json({ error: "Insufficient role power" }, { status: 403 }); }

  const user = await prisma.user.update({
    where: { username },
    data: { roleId },
  });

  return NextResponse.json({ ok: true, user });
}

// Get basic role & permissive info on a user
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const prams = await params;
  const username = prams.username;

  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      role: {
        include: {
          permissions: {
            select: { name: true }
          }
        }
      },
    }
  });

  return NextResponse.json({ ok: true, user });
}
