// Doesn't actually automatically update from GitHub, just updates the database for changes :)

import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/core/prisma';
import { prismaPerms } from "@/core/constants/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  const perms = await checkPermissions(['administrator']);

  // Permissions Check
  const canUpdateDatabase = perms['administrator'];
  if (!session || !canUpdateDatabase) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  // Proceed non-destructively
  let missingInDB: string[];
  let extraInDB: string[];

  try {
    const allPerms = await prisma.permission.findMany();
    const dbNames = allPerms.map(p => p.name);
    const definedNames = prismaPerms.map(p => p.name);
    missingInDB = definedNames.filter(name => !dbNames.includes(name));
    extraInDB = dbNames.filter(name => !definedNames.includes(name));
  
    if (missingInDB.length > 0) {
      await prisma.permission.createMany({
        data: missingInDB.map(name => ({ name })),
      });
    }

    // we dont remove extra ones automatically, instead just tell the user there are extras.
    // you can use prisma studio to remove extra values in the event there are any.
  
    return NextResponse.json({success: true, added_permissions: missingInDB, extra_permissions: extraInDB, message: 'If there are any extra, you have to remove them in Prisma Studio yourself.'});
  } catch (e) {
    console.error(e);
    return NextResponse.json({success: false, added_permissions: 'None', message: 'Something went wrong, please check console for details.'});
  }
}